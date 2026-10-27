from typing import Any, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logging import logger, request_id_ctx
from app.models.audit_log import AuditLog


async def log_audit_event(
    db: AsyncSession,
    action: str,
    resource_type: str,
    resource_id: str,
    actor_user_id: Optional[int] = None,
    details: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    req_id = request_id_ctx.get()
    audit_entry = AuditLog(
        request_id=req_id,
        actor_user_id=actor_user_id,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id),
        details=details or {},
    )
    db.add(audit_entry)
    logger.info(f"Audit event logged: {action} on {resource_type}/{resource_id} by user {actor_user_id}")
    return audit_entry
