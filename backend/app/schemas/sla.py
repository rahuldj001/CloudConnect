from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from app.models.case import CasePriority


class SLAPolicyBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    priority: CasePriority
    response_time_minutes: int = Field(..., ge=1, le=10080)  # max 7 days
    resolution_time_minutes: int = Field(..., ge=1, le=43200)  # max 30 days
    is_active: bool = True


class SLAPolicyCreate(SLAPolicyBase):
    pass


class SLAPolicyResponse(SLAPolicyBase):
    id: int

    class Config:
        from_attributes = True


class SLABreachItem(BaseModel):
    case_id: int
    case_number: str
    priority: str
    status: str
    response_deadline: datetime
    resolution_deadline: datetime
    is_response_breached: bool
    is_resolution_breached: bool
    assigned_user_name: Optional[str] = None


class SLABreachSummary(BaseModel):
    total_active_cases: int
    approaching_response_breach_count: int
    approaching_resolution_breach_count: int
    response_breached_count: int
    resolution_breached_count: int
    breached_cases: List[SLABreachItem] = []
