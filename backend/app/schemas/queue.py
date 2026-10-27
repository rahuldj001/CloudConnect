from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.queue import ChannelType


# Skill Schemas
class SkillBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    code: str = Field(..., min_length=2, max_length=50)
    description: str = Field(default="", max_length=255)


class SkillCreate(SkillBase):
    pass


class SkillResponse(SkillBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class AgentSkillAssign(BaseModel):
    skill_id: int
    proficiency_level: int = Field(default=3, ge=1, le=5)


# Queue Schemas
class QueueBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    channel: ChannelType = ChannelType.VOICE
    priority: int = Field(default=50, ge=1, le=100)
    max_wait_time_seconds: int = Field(default=300, ge=10, le=3600)
    overflow_queue_id: Optional[int] = None
    is_active: bool = True


class QueueCreate(QueueBase):
    pass


class QueueUpdate(BaseModel):
    name: Optional[str] = None
    channel: Optional[ChannelType] = None
    priority: Optional[int] = Field(default=None, ge=1, le=100)
    max_wait_time_seconds: Optional[int] = Field(default=None, ge=10, le=3600)
    overflow_queue_id: Optional[int] = None
    is_active: Optional[bool] = None


class QueueResponse(QueueBase):
    id: int
    created_at: datetime
    active_contacts_count: Optional[int] = 0
    assigned_agents_count: Optional[int] = 0

    class Config:
        from_attributes = True
