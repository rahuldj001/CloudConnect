from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: int
    request_id: str
    actor_user_id: Optional[int] = None
    actor_name: Optional[str] = None
    action: str
    resource_type: str
    resource_id: str
    details: Dict[str, Any]
    timestamp: datetime

    class Config:
        from_attributes = True


class PaginatedAuditLogs(BaseModel):
    total: int
    items: List[AuditLogResponse]
    page: int
    page_size: int
