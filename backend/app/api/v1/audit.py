from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db, require_role
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole
from app.schemas.audit import AuditLogResponse, PaginatedAuditLogs

router = APIRouter(prefix="/audit", tags=["Audit Logs"])


@router.get("", response_model=PaginatedAuditLogs)
async def list_audit_logs(
    resource_type: Optional[str] = None,
    action: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPERVISOR)),
):
    query = select(AuditLog).options(selectinload(AuditLog.actor)).order_by(AuditLog.timestamp.desc())

    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if action:
        query = query.where(AuditLog.action == action)
    if search:
        term = f"%{search.lower()}%"
        query = query.where(
            or_(
                func.lower(AuditLog.action).like(term),
                func.lower(AuditLog.resource_id).like(term),
                func.lower(AuditLog.request_id).like(term),
            )
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    logs = result.scalars().all()

    items = [
        AuditLogResponse(
            id=log.id,
            request_id=log.request_id,
            actor_user_id=log.actor_user_id,
            actor_name=log.actor.full_name if log.actor else "System Engine",
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            details=log.details,
            timestamp=log.timestamp,
        )
        for log in logs
    ]

    return PaginatedAuditLogs(
        total=total,
        items=items,
        page=page,
        page_size=page_size,
    )
