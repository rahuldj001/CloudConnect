from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.models.contact import ContactStatus
from app.models.interaction import ActorType
from app.models.queue import ChannelType


class InteractionCreate(BaseModel):
    actor_type: ActorType
    message: str = Field(..., min_length=1)
    metadata_json: Dict[str, Any] = Field(default_factory=dict)


class InteractionResponse(BaseModel):
    id: int
    contact_id: int
    actor_type: ActorType
    message: str
    timestamp: datetime
    metadata_json: Dict[str, Any] = {}

    class Config:
        from_attributes = True


class ContactStatusUpdate(BaseModel):
    status: ContactStatus
    outcome: Optional[str] = None
    notes: Optional[str] = None


class ContactResponse(BaseModel):
    id: int
    provider_contact_id: str
    channel: ChannelType
    customer_name: str
    customer_phone_masked: str
    queue_id: Optional[int] = None
    queue_name: Optional[str] = None
    assigned_agent_id: Optional[int] = None
    assigned_agent_name: Optional[str] = None
    status: ContactStatus
    priority: int
    queued_at: datetime
    connected_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    waiting_time_seconds: int
    duration_seconds: int
    routing_reason: str
    provider: str
    attributes: Dict[str, Any] = {}
    interactions: List[InteractionResponse] = []

    class Config:
        from_attributes = True


class PaginatedContacts(BaseModel):
    total: int
    items: List[ContactResponse]
    page: int
    page_size: int
