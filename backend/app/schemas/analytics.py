from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel


class QueueMetricItem(BaseModel):
    queue_id: int
    queue_name: str
    channel: str
    waiting_count: int
    active_count: int
    avg_wait_seconds: float


class AgentStatusMetricItem(BaseModel):
    status: str
    count: int


class WaitTimeTrendItem(BaseModel):
    hour: str
    avg_wait_seconds: float
    contacts_count: int


class DashboardMetricsResponse(BaseModel):
    total_agents: int
    active_agents: int
    available_agents: int
    waiting_contacts: int
    active_contacts: int
    completed_contacts_today: int
    open_cases: int
    escalated_cases: int
    sla_breached_cases: int
    average_wait_time_seconds: float
    average_handle_time_seconds: float
    resolution_rate_percent: float
    agent_status_breakdown: List[AgentStatusMetricItem]
    queue_metrics: List[QueueMetricItem]
    channel_distribution: Dict[str, int]
    is_simulated_environment: bool = True
    generated_at: datetime
