from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db, require_role
from app.core.websocket_manager import ws_manager
from app.models.agent import (
    AgentProfile,
    AgentStatus,
    AgentStatusHistory,
    VALID_AGENT_STATUS_TRANSITIONS,
)
from app.models.contact import Contact, ContactStatus
from app.models.queue import AgentQueue, Queue
from app.models.skill import AgentSkill, Skill
from app.models.user import User, UserRole
from app.schemas.agent import (
    AgentProfileCreate,
    AgentProfileResponse,
    AgentProfileUpdate,
    AgentQueueItem,
    AgentSkillItem,
    AgentStatusUpdate,
)
from app.schemas.auth import UserResponse
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/agents", tags=["Agent Management"])


async def format_agent_response(agent: AgentProfile, db: AsyncSession) -> AgentProfileResponse:
    # Active contacts count
    active_contacts_stmt = select(func.count(Contact.id)).where(
        Contact.assigned_agent_id == agent.id,
        Contact.status.in_([ContactStatus.CONNECTED, ContactStatus.WRAP_UP]),
    )
    active_count = (await db.execute(active_contacts_stmt)).scalar() or 0

    skills = [
        AgentSkillItem(
            skill_id=s.skill_id,
            name=s.skill.name if s.skill else "",
            code=s.skill.code if s.skill else "",
            proficiency_level=s.proficiency_level,
        )
        for s in agent.skills
    ]

    queues = [
        AgentQueueItem(
            queue_id=q.queue_id,
            name=q.queue.name if q.queue else "",
            channel=q.queue.channel.value if q.queue else "voice",
        )
        for q in agent.queues
    ]

    return AgentProfileResponse(
        id=agent.id,
        user_id=agent.user_id,
        user=UserResponse.model_validate(agent.user),
        current_status=agent.current_status,
        status_updated_at=agent.status_updated_at,
        max_concurrency_voice=agent.max_concurrency_voice,
        max_concurrency_chat=agent.max_concurrency_chat,
        routing_profile_name=agent.routing_profile_name,
        skills=skills,
        queues=queues,
        active_contacts_count=active_count,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )


@router.get("", response_model=List[AgentProfileResponse])
async def list_agents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(AgentProfile)
        .options(
            selectinload(AgentProfile.user),
            selectinload(AgentProfile.skills).selectinload(AgentSkill.skill),
            selectinload(AgentProfile.queues).selectinload(AgentQueue.queue),
        )
        .order_by(AgentProfile.id.asc())
    )
    result = await db.execute(stmt)
    agents = result.scalars().all()
    return [await format_agent_response(a, db) for a in agents]


@router.post("", response_model=AgentProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_agent_profile(
    agent_in: AgentProfileCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    user = await db.get(User, agent_in.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    
    existing = await db.execute(select(AgentProfile).where(AgentProfile.user_id == agent_in.user_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Agent profile already exists for this user.")

    agent = AgentProfile(
        user_id=agent_in.user_id,
        current_status=AgentStatus.OFFLINE,
        max_concurrency_voice=agent_in.max_concurrency_voice,
        max_concurrency_chat=agent_in.max_concurrency_chat,
        routing_profile_name=agent_in.routing_profile_name,
    )
    db.add(agent)
    await db.flush()

    # Add skills
    for skill_id in agent_in.skill_ids:
        db.add(AgentSkill(agent_id=agent.id, skill_id=skill_id, proficiency_level=3))

    # Add queues
    for queue_id in agent_in.queue_ids:
        db.add(AgentQueue(agent_id=agent.id, queue_id=queue_id))

    await log_audit_event(
        db=db,
        action="AGENT_CREATED",
        resource_type="agent",
        resource_id=str(agent.id),
        actor_user_id=current_user.id,
        details={"user_id": agent.user_id},
    )
    await db.commit()

    # Re-fetch fully loaded
    stmt = (
        select(AgentProfile)
        .where(AgentProfile.id == agent.id)
        .options(
            selectinload(AgentProfile.user),
            selectinload(AgentProfile.skills).selectinload(AgentSkill.skill),
            selectinload(AgentProfile.queues).selectinload(AgentQueue.queue),
        )
    )
    loaded = (await db.execute(stmt)).scalar_one()
    return await format_agent_response(loaded, db)


@router.get("/{agent_id}", response_model=AgentProfileResponse)
async def get_agent(
    agent_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(AgentProfile)
        .where(AgentProfile.id == agent_id)
        .options(
            selectinload(AgentProfile.user),
            selectinload(AgentProfile.skills).selectinload(AgentSkill.skill),
            selectinload(AgentProfile.queues).selectinload(AgentQueue.queue),
        )
    )
    result = await db.execute(stmt)
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    return await format_agent_response(agent, db)


@router.patch("/{agent_id}/status", response_model=AgentProfileResponse)
async def update_agent_status(
    agent_id: int,
    status_update: AgentStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(AgentProfile)
        .where(AgentProfile.id == agent_id)
        .options(
            selectinload(AgentProfile.user),
            selectinload(AgentProfile.skills).selectinload(AgentSkill.skill),
            selectinload(AgentProfile.queues).selectinload(AgentQueue.queue),
        )
    )
    result = await db.execute(stmt)
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    # Authorization: Agents can only update their own status; Admin/Supervisor can update any
    if current_user.role == UserRole.AGENT and agent.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Agents can only change their own availability status.",
        )

    # Validate state transition
    previous_status = agent.current_status
    target_status = status_update.status
    if previous_status != target_status:
        allowed_next = VALID_AGENT_STATUS_TRANSITIONS.get(previous_status, set())
        if target_status not in allowed_next:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status transition from '{previous_status.value}' to '{target_status.value}'. Allowed: {[s.value for s in allowed_next]}",
            )

        now = datetime.now(timezone.utc)
        agent.current_status = target_status
        agent.status_updated_at = now

        # Record history
        db.add(
            AgentStatusHistory(
                agent_id=agent.id,
                previous_status=previous_status,
                new_status=target_status,
                reason=status_update.reason,
                created_at=now,
            )
        )

        await log_audit_event(
            db=db,
            action="AGENT_STATUS_CHANGE",
            resource_type="agent",
            resource_id=str(agent.id),
            actor_user_id=current_user.id,
            details={
                "previous_status": previous_status.value,
                "new_status": target_status.value,
                "reason": status_update.reason,
            },
        )
        await db.commit()

        # Broadcast live status update via WebSocket
        await ws_manager.broadcast(
            {
                "event": "agent_status_changed",
                "agent_id": agent.id,
                "agent_name": agent.user.full_name,
                "previous_status": previous_status.value,
                "new_status": target_status.value,
                "timestamp": now.isoformat(),
            },
            topic="agents",
        )

    return await format_agent_response(agent, db)


@router.put("/{agent_id}/skills", response_model=AgentProfileResponse)
async def update_agent_skills(
    agent_id: int,
    skill_assignments: List[dict],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPERVISOR)),
):
    stmt = (
        select(AgentProfile)
        .where(AgentProfile.id == agent_id)
        .options(
            selectinload(AgentProfile.user),
            selectinload(AgentProfile.skills).selectinload(AgentSkill.skill),
            selectinload(AgentProfile.queues).selectinload(AgentQueue.queue),
        )
    )
    result = await db.execute(stmt)
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    # Clear existing skills and assign new
    agent.skills.clear()
    for s_item in skill_assignments:
        s_id = s_item.get("skill_id")
        prof = s_item.get("proficiency_level", 3)
        if s_id:
            db.add(AgentSkill(agent_id=agent.id, skill_id=s_id, proficiency_level=prof))

    await log_audit_event(
        db=db,
        action="AGENT_SKILLS_UPDATED",
        resource_type="agent",
        resource_id=str(agent.id),
        actor_user_id=current_user.id,
        details={"skills": skill_assignments},
    )
    await db.commit()

    reloaded = (await db.execute(stmt)).scalar_one()
    return await format_agent_response(reloaded, db)


@router.put("/{agent_id}/queues", response_model=AgentProfileResponse)
async def update_agent_queues(
    agent_id: int,
    queue_ids: List[int],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPERVISOR)),
):
    stmt = (
        select(AgentProfile)
        .where(AgentProfile.id == agent_id)
        .options(
            selectinload(AgentProfile.user),
            selectinload(AgentProfile.skills).selectinload(AgentSkill.skill),
            selectinload(AgentProfile.queues).selectinload(AgentQueue.queue),
        )
    )
    result = await db.execute(stmt)
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    agent.queues.clear()
    for q_id in queue_ids:
        db.add(AgentQueue(agent_id=agent.id, queue_id=q_id))

    await log_audit_event(
        db=db,
        action="AGENT_QUEUES_UPDATED",
        resource_type="agent",
        resource_id=str(agent.id),
        actor_user_id=current_user.id,
        details={"queue_ids": queue_ids},
    )
    await db.commit()

    reloaded = (await db.execute(stmt)).scalar_one()
    return await format_agent_response(reloaded, db)
