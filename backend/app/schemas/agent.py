from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from app.models.agent import AgentStatus
from app.schemas.auth import UserResponse


class AgentSkillItem(BaseModel):
    skill_id: int
    name: str
    code: str
    proficiency_level: int

    class Config:
        from_attributes = True


class AgentQueueItem(BaseModel):
    queue_id: int
    name: str
    channel: str

    class Config:
        from_attributes = True


class AgentProfileResponse(BaseModel):
    id: int
    user_id: int
    user: UserResponse
    current_status: AgentStatus
    status_updated_at: datetime
    max_concurrency_voice: int
    max_concurrency_chat: int
    routing_profile_name: str
    skills: List[AgentSkillItem] = []
    queues: List[AgentQueueItem] = []
    active_contacts_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AgentStatusUpdate(BaseModel):
    status: AgentStatus
    reason: Optional[str] = Field(default=None, max_length=255)


class AgentProfileCreate(BaseModel):
    user_id: int
    max_concurrency_voice: int = Field(default=1, ge=1, le=5)
    max_concurrency_chat: int = Field(default=3, ge=1, le=10)
    routing_profile_name: str = Field(default="Standard Agent", max_length=100)
    skill_ids: List[int] = []
    queue_ids: List[int] = []


class AgentProfileUpdate(BaseModel):
    max_concurrency_voice: Optional[int] = Field(default=None, ge=1, le=5)
    max_concurrency_chat: Optional[int] = Field(default=None, ge=1, le=10)
    routing_profile_name: Optional[str] = None
    skill_ids: Optional[List[int]] = None
    queue_ids: Optional[List[int]] = None
