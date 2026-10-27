from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.case import Case, CasePriority, CaseStatus
from app.models.sla_policy import CaseSLA, SLAPolicy

DEFAULT_SLA_MINUTES = {
    CasePriority.CRITICAL: {"response": 15, "resolution": 60},
    CasePriority.HIGH: {"response": 30, "resolution": 240},
    CasePriority.MEDIUM: {"response": 120, "resolution": 480},
    CasePriority.LOW: {"response": 240, "resolution": 1440},
}


async def get_or_create_default_policy(db: AsyncSession, priority: CasePriority) -> SLAPolicy:
    stmt = select(SLAPolicy).where(SLAPolicy.priority == priority)
    result = await db.execute(stmt)
    policy = result.scalar_one_or_none()
    
    if not policy:
        config = DEFAULT_SLA_MINUTES.get(priority, {"response": 60, "resolution": 480})
        policy = SLAPolicy(
            name=f"Standard {priority.value.capitalize()} SLA",
            priority=priority,
            response_time_minutes=config["response"],
            resolution_time_minutes=config["resolution"],
            is_active=True,
        )
        db.add(policy)
        await db.flush()
        
    return policy


async def initialize_case_sla(db: AsyncSession, case: Case) -> CaseSLA:
    policy = await get_or_create_default_policy(db, case.priority)
    now = datetime.now(timezone.utc)
    
    response_deadline = now + timedelta(minutes=policy.response_time_minutes)
    resolution_deadline = now + timedelta(minutes=policy.resolution_time_minutes)
    
    case_sla = CaseSLA(
        case_id=case.id,
        sla_policy_id=policy.id,
        response_deadline=response_deadline,
        resolution_deadline=resolution_deadline,
        is_response_breached=False,
        is_resolution_breached=False,
    )
    db.add(case_sla)
    await db.flush()
    return case_sla


from app.core.datetime_util import ensure_utc


async def evaluate_sla_breach(case: Case, sla: CaseSLA) -> None:
    now = datetime.now(timezone.utc)
    resp_deadline = ensure_utc(sla.response_deadline)
    res_deadline = ensure_utc(sla.resolution_deadline)
    first_resp = ensure_utc(sla.first_responded_at)
    resolved_at = ensure_utc(case.resolved_at)

    # Evaluate response breach
    if not first_resp:
        if resp_deadline and now > resp_deadline:
            sla.is_response_breached = True
    else:
        if resp_deadline and first_resp > resp_deadline:
            sla.is_response_breached = True

    # Evaluate resolution breach
    if case.status not in (CaseStatus.RESOLVED, CaseStatus.CLOSED):
        if res_deadline and now > res_deadline:
            sla.is_resolution_breached = True
    else:
        if resolved_at and res_deadline and resolved_at > res_deadline:
            sla.is_resolution_breached = True
