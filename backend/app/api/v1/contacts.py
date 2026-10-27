from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db
from app.core.datetime_util import ensure_utc
from app.core.websocket_manager import ws_manager
from app.models.agent import AgentProfile
from app.models.contact import Contact, ContactStatus
from app.models.interaction import ActorType, Interaction
from app.models.queue import ChannelType, Queue
from app.models.user import User, UserRole
from app.schemas.contact import (
    ContactResponse,
    ContactStatusUpdate,
    InteractionCreate,
    InteractionResponse,
    PaginatedContacts,
)
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/contacts", tags=["Contact Management"])


def format_contact_response(c: Contact) -> ContactResponse:
    queue_name = c.queue.name if c.queue else None
    agent_name = None
    if c.assigned_agent and c.assigned_agent.user:
        agent_name = c.assigned_agent.user.full_name

    interactions = [
        InteractionResponse(
            id=i.id,
            contact_id=i.contact_id,
            actor_type=i.actor_type,
            message=i.message,
            timestamp=i.timestamp,
            metadata_json=i.metadata_json,
        )
        for i in c.interactions
    ]

    return ContactResponse(
        id=c.id,
        provider_contact_id=c.provider_contact_id,
        channel=c.channel,
        customer_name=c.customer_name,
        customer_phone_masked=c.customer_phone_masked,
        queue_id=c.queue_id,
        queue_name=queue_name,
        assigned_agent_id=c.assigned_agent_id,
        assigned_agent_name=agent_name,
        status=c.status,
        priority=c.priority,
        queued_at=c.queued_at,
        connected_at=c.connected_at,
        ended_at=c.ended_at,
        waiting_time_seconds=c.waiting_time_seconds,
        duration_seconds=c.duration_seconds,
        routing_reason=c.routing_reason,
        provider=c.provider,
        attributes=c.attributes,
        interactions=interactions,
    )


@router.get("", response_model=PaginatedContacts)
async def list_contacts(
    channel: Optional[ChannelType] = None,
    contact_status: Optional[ContactStatus] = None,
    queue_id: Optional[int] = None,
    assigned_agent_id: Optional[int] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Contact)
        .options(
            selectinload(Contact.queue),
            selectinload(Contact.assigned_agent).selectinload(AgentProfile.user),
            selectinload(Contact.interactions),
        )
        .order_by(Contact.queued_at.desc())
    )

    if channel:
        query = query.where(Contact.channel == channel)
    if contact_status:
        query = query.where(Contact.status == contact_status)
    if queue_id:
        query = query.where(Contact.queue_id == queue_id)
    if assigned_agent_id:
        query = query.where(Contact.assigned_agent_id == assigned_agent_id)
    if search:
        term = f"%{search.lower()}%"
        query = query.where(
            or_(
                func.lower(Contact.customer_name).like(term),
                func.lower(Contact.provider_contact_id).like(term),
                func.lower(Contact.customer_phone_masked).like(term),
            )
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    contacts = result.scalars().all()

    return PaginatedContacts(
        total=total,
        items=[format_contact_response(c) for c in contacts],
        page=page,
        page_size=page_size,
    )


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Contact)
        .where(Contact.id == contact_id)
        .options(
            selectinload(Contact.queue),
            selectinload(Contact.assigned_agent).selectinload(AgentProfile.user),
            selectinload(Contact.interactions),
        )
    )
    result = await db.execute(stmt)
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact record not found.")
    return format_contact_response(contact)


@router.post("/{contact_id}/interactions", response_model=InteractionResponse, status_code=status.HTTP_201_CREATED)
async def add_interaction(
    contact_id: int,
    interaction_in: InteractionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = await db.get(Contact, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found.")

    now = datetime.now(timezone.utc)
    interaction = Interaction(
        contact_id=contact.id,
        actor_type=interaction_in.actor_type,
        message=interaction_in.message,
        timestamp=now,
        metadata_json={
            **interaction_in.metadata_json,
            "added_by_user_id": current_user.id,
        },
    )
    db.add(interaction)
    await db.commit()
    await db.refresh(interaction)

    # Broadcast message to live contact viewers
    await ws_manager.broadcast(
        {
            "event": "new_interaction",
            "contact_id": contact.id,
            "actor_type": interaction.actor_type.value,
            "message": interaction.message,
            "timestamp": interaction.timestamp.isoformat(),
        },
        topic=f"contact_{contact.id}",
    )

    return InteractionResponse.model_validate(interaction)


@router.patch("/{contact_id}/status", response_model=ContactResponse)
async def update_contact_status(
    contact_id: int,
    status_update: ContactStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Contact)
        .where(Contact.id == contact_id)
        .options(
            selectinload(Contact.queue),
            selectinload(Contact.assigned_agent).selectinload(AgentProfile.user),
            selectinload(Contact.interactions),
        )
    )
    result = await db.execute(stmt)
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found.")

    now = datetime.now(timezone.utc)
    old_status = contact.status
    contact.status = status_update.status

    # If completing or wrap-up, compute duration
    if status_update.status in (ContactStatus.COMPLETED, ContactStatus.ABANDONED):
        contact.ended_at = now
        conn_at = ensure_utc(contact.connected_at)
        if conn_at:
            duration = int((now - conn_at).total_seconds())
            contact.duration_seconds = max(duration, 0)

    # Add interaction record
    note_msg = f"Contact status changed from '{old_status.value}' to '{status_update.status.value}'."
    if status_update.outcome:
        note_msg += f" Outcome: {status_update.outcome}."
    if status_update.notes:
        note_msg += f" Notes: {status_update.notes}"

    db.add(
        Interaction(
            contact_id=contact.id,
            actor_type=ActorType.SYSTEM,
            message=note_msg,
            timestamp=now,
            metadata_json={"changed_by_user_id": current_user.id},
        )
    )

    await log_audit_event(
        db=db,
        action="CONTACT_STATUS_CHANGE",
        resource_type="contact",
        resource_id=str(contact.id),
        actor_user_id=current_user.id,
        details={
            "old_status": old_status.value,
            "new_status": status_update.status.value,
            "outcome": status_update.outcome,
        },
    )
    await db.commit()
    await db.refresh(contact)

    await ws_manager.broadcast(
        {
            "event": "contact_status_updated",
            "contact_id": contact.id,
            "new_status": contact.status.value,
        },
        topic="contacts",
    )

    return format_contact_response(contact)
