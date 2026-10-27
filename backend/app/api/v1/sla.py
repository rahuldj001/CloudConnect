from datetime import datetime, timedelta, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db, require_role
from app.models.case import Case, CaseStatus
from app.models.sla_policy import CaseSLA, SLAPolicy
from app.models.user import User, UserRole
from app.schemas.sla import SLABreachItem, SLABreachSummary, SLAPolicyCreate, SLAPolicyResponse
from app.core.datetime_util import ensure_utc
from app.services.audit_service import log_audit_event
from app.services.sla_service import evaluate_sla_breach

router = APIRouter(prefix="/sla", tags=["SLA Management"])


@router.get("/policies", response_model=List[SLAPolicyResponse])
async def list_sla_policies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(SLAPolicy).order_by(SLAPolicy.priority.desc())
    result = await db.execute(stmt)
    return [SLAPolicyResponse.model_validate(p) for p in result.scalars().all()]


@router.post("/policies", response_model=SLAPolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_sla_policy(
    policy_in: SLAPolicyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    existing = await db.execute(select(SLAPolicy).where(SLAPolicy.priority == policy_in.priority))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Policy for this priority tier already exists.")

    policy = SLAPolicy(
        name=policy_in.name,
        priority=policy_in.priority,
        response_time_minutes=policy_in.response_time_minutes,
        resolution_time_minutes=policy_in.resolution_time_minutes,
        is_active=policy_in.is_active,
    )
    db.add(policy)
    await db.flush()

    await log_audit_event(
        db=db,
        action="SLA_POLICY_CREATED",
        resource_type="sla_policy",
        resource_id=str(policy.id),
        actor_user_id=current_user.id,
        details={"name": policy.name, "priority": policy.priority.value},
    )
    await db.commit()
    await db.refresh(policy)
    return SLAPolicyResponse.model_validate(policy)


@router.get("/breaches", response_model=SLABreachSummary)
async def get_sla_breach_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    approaching_window = now + timedelta(minutes=30)

    # Active cases
    active_cases_stmt = (
        select(Case)
        .where(Case.status.in_([CaseStatus.OPEN, CaseStatus.IN_PROGRESS, CaseStatus.ESCALATED]))
        .options(selectinload(Case.sla), selectinload(Case.assigned_user))
    )
    cases = (await db.execute(active_cases_stmt)).scalars().all()

    approaching_response = 0
    approaching_resolution = 0
    response_breached = 0
    resolution_breached = 0
    breached_items: List[SLABreachItem] = []

    for c in cases:
        if not c.sla:
            continue
        await evaluate_sla_breach(c, c.sla)
        # Check approaching
        resp_dl = ensure_utc(c.sla.response_deadline)
        res_dl = ensure_utc(c.sla.resolution_deadline)
        first_resp = ensure_utc(c.sla.first_responded_at)

        if not c.sla.is_response_breached and not first_resp and resp_dl and now <= resp_dl <= approaching_window:
            approaching_response += 1
        if not c.sla.is_resolution_breached and res_dl and now <= res_dl <= approaching_window:
            approaching_resolution += 1

        if c.sla.is_response_breached:
            response_breached += 1
        if c.sla.is_resolution_breached:
            resolution_breached += 1

        if c.sla.is_response_breached or c.sla.is_resolution_breached:
            breached_items.append(
                SLABreachItem(
                    case_id=c.id,
                    case_number=c.case_number,
                    priority=c.priority.value,
                    status=c.status.value,
                    response_deadline=c.sla.response_deadline,
                    resolution_deadline=c.sla.resolution_deadline,
                    is_response_breached=c.sla.is_response_breached,
                    is_resolution_breached=c.sla.is_resolution_breached,
                    assigned_user_name=c.assigned_user.full_name if c.assigned_user else None,
                )
            )

    return SLABreachSummary(
        total_active_cases=len(cases),
        approaching_response_breach_count=approaching_response,
        approaching_resolution_breach_count=approaching_resolution,
        response_breached_count=response_breached,
        resolution_breached_count=resolution_breached,
        breached_cases=breached_items,
    )
