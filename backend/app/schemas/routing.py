from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.models.queue import ChannelType


class RoutingRuleBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    queue_id: int
    priority: int = Field(default=50, ge=1, le=100)
    required_skills: List[str] = Field(default_factory=list)
    min_proficiency: int = Field(default=1, ge=1, le=5)
    rule_condition: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class RoutingRuleCreate(RoutingRuleBase):
    pass


class RoutingRuleResponse(RoutingRuleBase):
    id: int
    created_at: datetime
    queue_name: Optional[str] = None

    class Config:
        from_attributes = True


class SimulateContactRequest(BaseModel):
    customer_name: str = Field(default="Demo Customer", min_length=2, max_length=100)
    customer_phone: str = Field(default="+1-555-0199", max_length=50)
    channel: ChannelType = ChannelType.VOICE
    queue_id: Optional[int] = None
    priority: int = Field(default=50, ge=1, le=100)
    required_skills: List[str] = Field(default_factory=list)
    attributes: Dict[str, Any] = Field(default_factory=dict)
    initial_message: Optional[str] = Field(default="Inbound contact initiated via simulator", max_length=500)


class RoutingDecisionAudit(BaseModel):
    selected_agent_id: Optional[int] = None
    selected_agent_name: Optional[str] = None
    queue_id: int
    decision: str
    reasons: List[str] = []
    eligible_agents_count: int = 0
    overflow_triggered: bool = False
    routed_at: datetime


class SimulateContactResponse(BaseModel):
    contact_id: int
    provider_contact_id: str
    status: str
    channel: str
    queue_id: int
    assigned_agent_id: Optional[int] = None
    routing_decision: RoutingDecisionAudit
    is_simulated: bool = True
