import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db, require_role
from app.models.contact import Contact, ContactStatus
from app.models.interaction import ActorType, Interaction
from app.models.queue import Queue
from app.models.routing_rule import RoutingRule
from app.models.user import User, UserRole
from app.providers import get_contact_center_provider
from app.schemas.routing import (
    RoutingRuleCreate,
    RoutingRuleResponse,
    SimulateContactRequest,
    SimulateContactResponse,
)
from app.services.audit_service import log_audit_event
from app.services.routing_engine import RoutingEngine

router = APIRouter(prefix="/routing", tags=["Routing Engine"])


@router.get("/rules", response_model=List[RoutingRuleResponse])
async def list_routing_rules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(RoutingRule).options(selectinload(RoutingRule.queue)).order_by(RoutingRule.priority.desc())
    result = await db.execute(stmt)
    rules = result.scalars().all()
    
    responses = []
    for r in rules:
        resp = RoutingRuleResponse.model_validate(r)
        resp.queue_name = r.queue.name if r.queue else None
        responses.append(resp)
    return responses


@router.post("/rules", response_model=RoutingRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_routing_rule(
    rule_in: RoutingRuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPERVISOR)),
):
    queue = await db.get(Queue, rule_in.queue_id)
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found.")

    rule = RoutingRule(
        name=rule_in.name,
        queue_id=rule_in.queue_id,
        priority=rule_in.priority,
        required_skills=[s.lower() for s in rule_in.required_skills],
        min_proficiency=rule_in.min_proficiency,
        rule_condition=rule_in.rule_condition,
        is_active=rule_in.is_active,
    )
    db.add(rule)
    await db.flush()

    await log_audit_event(
        db=db,
        action="ROUTING_RULE_CREATED",
        resource_type="routing_rule",
        resource_id=str(rule.id),
        actor_user_id=current_user.id,
        details={"name": rule.name, "queue_id": rule.queue_id},
    )
    await db.commit()
    await db.refresh(rule)

    resp = RoutingRuleResponse.model_validate(rule)
    resp.queue_name = queue.name
    return resp


@router.delete("/rules/{rule_id}")
async def delete_routing_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPERVISOR)),
):
    rule = await db.get(RoutingRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Routing rule not found.")

    await log_audit_event(
        db=db,
        action="ROUTING_RULE_DELETED",
        resource_type="routing_rule",
        resource_id=str(rule.id),
        actor_user_id=current_user.id,
        details={"name": rule.name},
    )
    await db.delete(rule)
    await db.commit()
    return {"message": "Routing rule deleted."}


@router.post("/simulate-contact", response_model=SimulateContactResponse)
async def simulate_contact_routing(
    request: SimulateContactRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Simulates an incoming customer contact (Voice or Chat) using the SimulatorProvider.
    Explicitly labeled as a local deterministic simulation.
    Routes contact through the deterministic routing engine and returns audit trail.
    """
    provider = get_contact_center_provider()

    # Determine target queue
    target_queue_id = request.queue_id
    if not target_queue_id:
        # Default to first active queue matching channel
        q_stmt = select(Queue).where(Queue.channel == request.channel, Queue.is_active.is_(True)).order_by(Queue.priority.desc())
        q_res = await db.execute(q_stmt)
        default_q = q_res.scalars().first()
        if not default_q:
            raise HTTPException(status_code=400, detail=f"No active queue configured for channel '{request.channel.value}'.")
        target_queue_id = default_q.id

    # Mask customer phone for privacy
    raw_phone = request.customer_phone
    masked_phone = raw_phone
    if len(raw_phone) >= 7:
        masked_phone = f"{raw_phone[:3]}-***-{raw_phone[-4:]}"

    # Generate simulated provider contact
    init_res = await provider.initiate_contact(
        customer_identifier=request.customer_phone,
        channel=request.channel.value,
        queue_id=target_queue_id,
        attributes=request.attributes,
    )

    now = datetime.now(timezone.utc)
    contact = Contact(
        provider_contact_id=init_res.provider_contact_id,
        channel=request.channel,
        customer_name=request.customer_name,
        customer_phone_masked=masked_phone,
        queue_id=target_queue_id,
        status=ContactStatus.QUEUED,
        priority=request.priority,
        queued_at=now,
        provider="simulator" if provider.is_simulated else "amazon_connect",
        attributes={
            **request.attributes,
            "required_skills": [s.lower() for s in request.required_skills],
            "simulated": True,
            "notes": "Simulated contact - does not connect to PSTN carrier network.",
        },
    )
    db.add(contact)
    await db.flush()

    # Initial interaction message
    initial_msg = request.initial_message or f"Simulated {request.channel.value} session initiated."
    db.add(
        Interaction(
            contact_id=contact.id,
            actor_type=ActorType.CUSTOMER,
            message=initial_msg,
            timestamp=now,
            metadata_json={"simulated": True},
        )
    )
    await db.flush()

    # Execute deterministic routing
    decision = await RoutingEngine.route_contact(
        db=db,
        contact=contact,
        actor_user_id=current_user.id,
    )
    await db.commit()
    await db.refresh(contact)

    return SimulateContactResponse(
        contact_id=contact.id,
        provider_contact_id=contact.provider_contact_id,
        status=contact.status.value,
        channel=contact.channel.value,
        queue_id=contact.queue_id or target_queue_id,
        assigned_agent_id=contact.assigned_agent_id,
        routing_decision=decision,
        is_simulated=True,
    )
