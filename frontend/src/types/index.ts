export type UserRole = 'admin' | 'supervisor' | 'agent';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type AgentStatus = 'available' | 'busy' | 'away' | 'offline';

export interface AgentSkillItem {
  skill_id: number;
  name: string;
  code: string;
  proficiency_level: number;
}

export interface AgentQueueItem {
  queue_id: number;
  name: string;
  channel: string;
}

export interface AgentProfile {
  id: number;
  user_id: number;
  user: User;
  current_status: AgentStatus;
  status_updated_at: string;
  max_concurrency_voice: number;
  max_concurrency_chat: number;
  routing_profile_name: string;
  skills: AgentSkillItem[];
  queues: AgentQueueItem[];
  active_contacts_count: number;
  created_at: string;
  updated_at: string;
}

export type ChannelType = 'voice' | 'chat';

export interface Queue {
  id: number;
  name: string;
  channel: ChannelType;
  priority: number;
  max_wait_time_seconds: number;
  overflow_queue_id?: number | null;
  is_active: boolean;
  created_at: string;
  active_contacts_count: number;
  assigned_agents_count: number;
}

export interface Skill {
  id: number;
  name: string;
  code: string;
  description: string;
  created_at: string;
}

export interface RoutingRule {
  id: number;
  name: string;
  queue_id: number;
  queue_name?: string;
  priority: number;
  required_skills: string[];
  min_proficiency: number;
  rule_condition: Record<string, any>;
  is_active: boolean;
  created_at: string;
}

export type ContactStatus = 'queued' | 'routing' | 'connected' | 'wrap_up' | 'completed' | 'abandoned' | 'overflowed';

export type ActorType = 'customer' | 'agent' | 'system';

export interface Interaction {
  id: number;
  contact_id: number;
  actor_type: ActorType;
  message: string;
  timestamp: string;
  metadata_json: Record<string, any>;
}

export interface Contact {
  id: number;
  provider_contact_id: string;
  channel: ChannelType;
  customer_name: string;
  customer_phone_masked: string;
  queue_id?: number;
  queue_name?: string;
  assigned_agent_id?: number | null;
  assigned_agent_name?: string | null;
  status: ContactStatus;
  priority: number;
  queued_at: string;
  connected_at?: string | null;
  ended_at?: string | null;
  waiting_time_seconds: number;
  duration_seconds: number;
  routing_reason: string;
  provider: string;
  attributes: Record<string, any>;
  interactions: Interaction[];
}

export type CasePriority = 'low' | 'medium' | 'high' | 'critical';
export type CaseStatus = 'open' | 'in_progress' | 'escalated' | 'resolved' | 'closed';

export interface CaseNote {
  id: number;
  case_id: number;
  author_user_id: number;
  author_name?: string;
  note: string;
  created_at: string;
}

export interface CaseSLA {
  id: number;
  case_id: number;
  sla_policy_id: number;
  policy_name?: string;
  response_deadline: string;
  resolution_deadline: string;
  first_responded_at?: string | null;
  is_response_breached: boolean;
  is_resolution_breached: boolean;
  response_time_remaining_minutes?: number;
  resolution_time_remaining_minutes?: number;
}

export interface Case {
  id: number;
  case_number: string;
  title: string;
  description: string;
  customer_identifier: string;
  priority: CasePriority;
  status: CaseStatus;
  contact_id?: number | null;
  assigned_to_user_id?: number | null;
  assigned_user?: User | null;
  sla?: CaseSLA | null;
  notes: CaseNote[];
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
}

export interface SLAPolicy {
  id: number;
  name: string;
  priority: CasePriority;
  response_time_minutes: number;
  resolution_time_minutes: number;
  is_active: boolean;
}

export interface SLABreachItem {
  case_id: number;
  case_number: string;
  priority: string;
  status: string;
  response_deadline: string;
  resolution_deadline: string;
  is_response_breached: boolean;
  is_resolution_breached: boolean;
  assigned_user_name?: string | null;
}

export interface SLABreachSummary {
  total_active_cases: number;
  approaching_response_breach_count: number;
  approaching_resolution_breach_count: number;
  response_breached_count: number;
  resolution_breached_count: number;
  breached_cases: SLABreachItem[];
}

export interface QueueMetricItem {
  queue_id: number;
  queue_name: string;
  channel: string;
  waiting_count: number;
  active_count: number;
  avg_wait_seconds: number;
}

export interface AgentStatusMetricItem {
  status: string;
  count: number;
}

export interface DashboardMetrics {
  total_agents: number;
  active_agents: number;
  available_agents: number;
  waiting_contacts: number;
  active_contacts: number;
  completed_contacts_today: number;
  open_cases: number;
  escalated_cases: number;
  sla_breached_cases: number;
  average_wait_time_seconds: number;
  average_handle_time_seconds: number;
  resolution_rate_percent: number;
  agent_status_breakdown: AgentStatusMetricItem[];
  queue_metrics: QueueMetricItem[];
  channel_distribution: Record<string, number>;
  is_simulated_environment: boolean;
  generated_at: string;
}

export interface AuditLog {
  id: number;
  request_id: string;
  actor_user_id?: number | null;
  actor_name?: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, any>;
  timestamp: string;
}

export interface ProviderHealth {
  provider_name: string;
  is_connected: boolean;
  is_simulated: boolean;
  details: Record<string, any>;
}

export interface SimulateContactRequest {
  customer_name: string;
  customer_phone: string;
  channel: ChannelType;
  queue_id?: number;
  priority: number;
  required_skills: string[];
  attributes?: Record<string, any>;
  initial_message?: string;
}

export interface RoutingDecisionAudit {
  selected_agent_id?: number | null;
  selected_agent_name?: string | null;
  queue_id: number;
  decision: string;
  reasons: string[];
  eligible_agents_count: number;
  overflow_triggered: boolean;
  routed_at: string;
}

export interface SimulateContactResponse {
  contact_id: number;
  provider_contact_id: string;
  status: string;
  channel: string;
  queue_id: number;
  assigned_agent_id?: number | null;
  routing_decision: RoutingDecisionAudit;
  is_simulated: boolean;
}
