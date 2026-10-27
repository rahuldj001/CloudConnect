from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_role
from app.models.contact import Contact, ContactStatus
from app.models.queue import AgentQueue, Queue
from app.models.user import User, UserRole
from app.schemas.queue import QueueCreate, QueueResponse, QueueUpdate
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/queues", tags=["Queue Management"])


async def format_queue_response(queue: Queue, db: AsyncSession) -> QueueResponse:
    # Active waiting contacts in queue
    waiting_stmt = select(func.count(Contact.id)).where(
        Contact.queue_id == queue.id,
        Contact.status == ContactStatus.QUEUED,
    )
    waiting_count = (await db.execute(waiting_stmt)).scalar() or 0

    # Assigned agents count
    agents_stmt = select(func.count(AgentQueue.id)).where(AgentQueue.queue_id == queue.id)
    agents_count = (await db.execute(agents_stmt)).scalar() or 0

    return QueueResponse(
        id=queue.id,
        name=queue.name,
        channel=queue.channel,
        priority=queue.priority,
        max_wait_time_seconds=queue.max_wait_time_seconds,
        overflow_queue_id=queue.overflow_queue_id,
        is_active=queue.is_active,
        created_at=queue.created_at,
        active_contacts_count=waiting_count,
        assigned_agents_count=agents_count,
    )


@router.get("", response_model=List[QueueResponse])
async def list_queues(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Queue).order_by(Queue.priority.desc(), Queue.id.asc())
    result = await db.execute(stmt)
    queues = result.scalars().all()
    return [await format_queue_response(q, db) for q in queues]


@router.post("", response_model=QueueResponse, status_code=status.HTTP_201_CREATED)
async def create_queue(
    queue_in: QueueCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPERVISOR)),
):
    existing = await db.execute(select(Queue).where(Queue.name == queue_in.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Queue with this name already exists.")

    queue = Queue(
        name=queue_in.name,
        channel=queue_in.channel,
        priority=queue_in.priority,
        max_wait_time_seconds=queue_in.max_wait_time_seconds,
        overflow_queue_id=queue_in.overflow_queue_id,
        is_active=queue_in.is_active,
    )
    db.add(queue)
    await db.flush()

    await log_audit_event(
        db=db,
        action="QUEUE_CREATED",
        resource_type="queue",
        resource_id=str(queue.id),
        actor_user_id=current_user.id,
        details={"name": queue.name, "channel": queue.channel.value},
    )
    await db.commit()
    await db.refresh(queue)
    return await format_queue_response(queue, db)


@router.get("/{queue_id}", response_model=QueueResponse)
async def get_queue(
    queue_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    queue = await db.get(Queue, queue_id)
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found.")
    return await format_queue_response(queue, db)


@router.put("/{queue_id}", response_model=QueueResponse)
async def update_queue(
    queue_id: int,
    queue_in: QueueUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPERVISOR)),
):
    queue = await db.get(Queue, queue_id)
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found.")

    if queue_in.name is not None:
        queue.name = queue_in.name
    if queue_in.channel is not None:
        queue.channel = queue_in.channel
    if queue_in.priority is not None:
        queue.priority = queue_in.priority
    if queue_in.max_wait_time_seconds is not None:
        queue.max_wait_time_seconds = queue_in.max_wait_time_seconds
    if queue_in.overflow_queue_id is not None:
        queue.overflow_queue_id = queue_in.overflow_queue_id
    if queue_in.is_active is not None:
        queue.is_active = queue_in.is_active

    await log_audit_event(
        db=db,
        action="QUEUE_UPDATED",
        resource_type="queue",
        resource_id=str(queue.id),
        actor_user_id=current_user.id,
        details=queue_in.model_dump(exclude_unset=True),
    )
    await db.commit()
    await db.refresh(queue)
    return await format_queue_response(queue, db)
