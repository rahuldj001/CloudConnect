from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db
from app.models.agent import AgentProfile, AgentStatus
from app.models.case import Case, CasePriority, CaseStatus
from app.models.contact import Contact, ContactStatus
from app.models.queue import AgentQueue, ChannelType, Queue
from app.models.sla_policy import CaseSLA
from app.models.user import User
from app.schemas.analytics import (
    AgentStatusMetricItem,
    DashboardMetricsResponse,
    QueueMetricItem,
)
from app.services.sla_service import evaluate_sla_breach

router = APIRouter(prefix="/analytics", tags=["Analytics & Dashboard"])


@router.get("/dashboard", response_model=DashboardMetricsResponse)
async def get_dashboard_metrics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)

    # 1. Agents Breakdown
    agents_stmt = select(AgentProfile.current_status, func.count(AgentProfile.id)).group_by(AgentProfile.current_status)
    agent_counts_res = await db.execute(agents_stmt)
    status_map = {row[0]: row[1] for row in agent_counts_res.all()}

    total_agents = sum(status_map.values())
    available_agents = status_map.get(AgentStatus.AVAILABLE, 0)
    busy_agents = status_map.get(AgentStatus.BUSY, 0)
    away_agents = status_map.get(AgentStatus.AWAY, 0)
    active_agents = available_agents + busy_agents + away_agents

    agent_status_breakdown = [
        AgentStatusMetricItem(status=s.value, count=status_map.get(s, 0))
        for s in AgentStatus
    ]

    # 2. Contacts Metrics
    # Waiting contacts (currently QUEUED)
    waiting_stmt = select(func.count(Contact.id)).where(Contact.status == ContactStatus.QUEUED)
    waiting_contacts = (await db.execute(waiting_stmt)).scalar() or 0

    # Active contacts (CONNECTED, WRAP_UP)
    active_c_stmt = select(func.count(Contact.id)).where(
        Contact.status.in_([ContactStatus.CONNECTED, ContactStatus.WRAP_UP])
    )
    active_contacts = (await db.execute(active_c_stmt)).scalar() or 0

    # Completed contacts today
    completed_today_stmt = select(func.count(Contact.id)).where(
        Contact.status == ContactStatus.COMPLETED,
        Contact.ended_at >= today_start,
    )
    completed_today = (await db.execute(completed_today_stmt)).scalar() or 0

    # Average wait time & handle time
    wait_time_stmt = select(func.avg(Contact.waiting_time_seconds)).where(
        Contact.status.in_([ContactStatus.CONNECTED, ContactStatus.COMPLETED, ContactStatus.WRAP_UP])
    )
    avg_wait = (await db.execute(wait_time_stmt)).scalar() or 0.0

    handle_time_stmt = select(func.avg(Contact.duration_seconds)).where(
        Contact.status == ContactStatus.COMPLETED,
        Contact.duration_seconds > 0,
    )
    avg_handle = (await db.execute(handle_time_stmt)).scalar() or 0.0

    # Channel distribution
    chan_stmt = select(Contact.channel, func.count(Contact.id)).group_by(Contact.channel)
    chan_res = await db.execute(chan_stmt)
    channel_distribution = {c.value: count for c, count in chan_res.all()}
    if "voice" not in channel_distribution:
        channel_distribution["voice"] = 0
    if "chat" not in channel_distribution:
        channel_distribution["chat"] = 0

    # 3. Cases & SLA Metrics
    open_cases_stmt = select(func.count(Case.id)).where(
        Case.status.in_([CaseStatus.OPEN, CaseStatus.IN_PROGRESS])
    )
    open_cases = (await db.execute(open_cases_stmt)).scalar() or 0

    escalated_cases_stmt = select(func.count(Case.id)).where(Case.status == CaseStatus.ESCALATED)
    escalated_cases = (await db.execute(escalated_cases_stmt)).scalar() or 0

    # Calculate resolution rate
    total_cases_stmt = select(func.count(Case.id))
    total_cases = (await db.execute(total_cases_stmt)).scalar() or 0

    resolved_cases_stmt = select(func.count(Case.id)).where(
        Case.status.in_([CaseStatus.RESOLVED, CaseStatus.CLOSED])
    )
    resolved_cases = (await db.execute(resolved_cases_stmt)).scalar() or 0

    resolution_rate = round((resolved_cases / total_cases * 100.0) if total_cases > 0 else 100.0, 1)

    # Calculate SLA breaches dynamically
    active_cases_stmt = (
        select(Case)
        .where(Case.status.in_([CaseStatus.OPEN, CaseStatus.IN_PROGRESS, CaseStatus.ESCALATED]))
        .options(selectinload(Case.sla))
    )
    cases_for_sla = (await db.execute(active_cases_stmt)).scalars().all()
    sla_breached_count = 0
    for c in cases_for_sla:
        if c.sla:
            await evaluate_sla_breach(c, c.sla)
            if c.sla.is_response_breached or c.sla.is_resolution_breached:
                sla_breached_count += 1

    # 4. Queue Metrics
    queues_stmt = select(Queue).where(Queue.is_active.is_(True)).order_by(Queue.priority.desc())
    queues = (await db.execute(queues_stmt)).scalars().all()
    queue_metrics: List[QueueMetricItem] = []

    for q in queues:
        q_waiting_stmt = select(func.count(Contact.id)).where(
            Contact.queue_id == q.id,
            Contact.status == ContactStatus.QUEUED,
        )
        q_waiting = (await db.execute(q_waiting_stmt)).scalar() or 0

        q_active_stmt = select(func.count(Contact.id)).where(
            Contact.queue_id == q.id,
            Contact.status.in_([ContactStatus.CONNECTED, ContactStatus.WRAP_UP]),
        )
        q_active = (await db.execute(q_active_stmt)).scalar() or 0

        q_avg_wait_stmt = select(func.avg(Contact.waiting_time_seconds)).where(Contact.queue_id == q.id)
        q_avg_wait = (await db.execute(q_avg_wait_stmt)).scalar() or 0.0

        queue_metrics.append(
            QueueMetricItem(
                queue_id=q.id,
                queue_name=q.name,
                channel=q.channel.value,
                waiting_count=q_waiting,
                active_count=q_active,
                avg_wait_seconds=round(float(q_avg_wait), 1),
            )
        )

    return DashboardMetricsResponse(
        total_agents=total_agents,
        active_agents=active_agents,
        available_agents=available_agents,
        waiting_contacts=waiting_contacts,
        active_contacts=active_contacts,
        completed_contacts_today=completed_today,
        open_cases=open_cases,
        escalated_cases=escalated_cases,
        sla_breached_cases=sla_breached_count,
        average_wait_time_seconds=round(float(avg_wait), 1),
        average_handle_time_seconds=round(float(avg_handle), 1),
        resolution_rate_percent=resolution_rate,
        agent_status_breakdown=agent_status_breakdown,
        queue_metrics=queue_metrics,
        channel_distribution=channel_distribution,
        is_simulated_environment=True,
        generated_at=now,
    )
