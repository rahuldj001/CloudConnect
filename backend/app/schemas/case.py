from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from app.models.case import CasePriority, CaseStatus
from app.schemas.auth import UserResponse


class CaseNoteCreate(BaseModel):
    note: str = Field(..., min_length=2)


class CaseNoteResponse(BaseModel):
    id: int
    case_id: int
    author_user_id: int
    author_name: Optional[str] = None
    note: str
    created_at: datetime

    class Config:
        from_attributes = True


class CaseSLAResponse(BaseModel):
    id: int
    case_id: int
    sla_policy_id: int
    policy_name: Optional[str] = None
    response_deadline: datetime
    resolution_deadline: datetime
    first_responded_at: Optional[datetime] = None
    is_response_breached: bool
    is_resolution_breached: bool
    response_time_remaining_minutes: Optional[int] = None
    resolution_time_remaining_minutes: Optional[int] = None

    class Config:
        from_attributes = True


class CaseBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=5)
    customer_identifier: str = Field(..., min_length=2, max_length=100)
    priority: CasePriority = CasePriority.MEDIUM
    contact_id: Optional[int] = None
    assigned_to_user_id: Optional[int] = None


class CaseCreate(CaseBase):
    pass


class CaseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[CasePriority] = None
    status: Optional[CaseStatus] = None
    assigned_to_user_id: Optional[int] = None


class CaseResponse(CaseBase):
    id: int
    case_number: str
    status: CaseStatus
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    assigned_user: Optional[UserResponse] = None
    sla: Optional[CaseSLAResponse] = None
    notes: List[CaseNoteResponse] = []

    class Config:
        from_attributes = True


class PaginatedCases(BaseModel):
    total: int
    items: List[CaseResponse]
    page: int
    page_size: int
