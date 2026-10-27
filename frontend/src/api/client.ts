const API_BASE = '/api/v1';

class ApiClient {
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    const token = localStorage.getItem('cc_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const headers = { ...this.getHeaders(), ...(options.headers || {}) };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // If unauthorized on protected endpoint, clear stale token
      if (!endpoint.includes('/auth/login')) {
        localStorage.removeItem('cc_token');
        localStorage.removeItem('cc_user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    if (!response.ok) {
      let errorMsg = `HTTP Error ${response.status}`;
      try {
        const errJson = await response.json();
        errorMsg = errJson.detail || errJson.message || errorMsg;
      } catch {
        // fallback to text or status
      }
      throw new Error(errorMsg);
    }

    // Return empty object for 204 or empty responses
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{ access_token: string; token_type: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  async getMe() {
    return this.request<any>('/auth/me');
  }

  // Agents
  async getAgents() {
    return this.request<any[]>('/agents');
  }

  async updateAgentStatus(agentId: number, status: string, reason?: string) {
    return this.request<any>(`/agents/${agentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    });
  }

  async updateAgentSkills(agentId: number, skills: any[]) {
    return this.request<any>(`/agents/${agentId}/skills`, {
      method: 'PUT',
      body: JSON.stringify(skills),
    });
  }

  async updateAgentQueues(agentId: number, queueIds: number[]) {
    return this.request<any>(`/agents/${agentId}/queues`, {
      method: 'PUT',
      body: JSON.stringify(queueIds),
    });
  }

  // Queues
  async getQueues() {
    return this.request<any[]>('/queues');
  }

  async createQueue(queue: any) {
    return this.request<any>('/queues', {
      method: 'POST',
      body: JSON.stringify(queue),
    });
  }

  async updateQueue(queueId: number, data: any) {
    return this.request<any>(`/queues/${queueId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Skills
  async getSkills() {
    return this.request<any[]>('/skills');
  }

  async createSkill(skill: any) {
    return this.request<any>('/skills', {
      method: 'POST',
      body: JSON.stringify(skill),
    });
  }

  // Routing
  async getRoutingRules() {
    return this.request<any[]>('/routing/rules');
  }

  async createRoutingRule(rule: any) {
    return this.request<any>('/routing/rules', {
      method: 'POST',
      body: JSON.stringify(rule),
    });
  }

  async deleteRoutingRule(ruleId: number) {
    return this.request<any>(`/routing/rules/${ruleId}`, {
      method: 'DELETE',
    });
  }

  async simulateContact(params: any) {
    return this.request<any>('/routing/simulate-contact', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Contacts
  async getContacts(params: Record<string, any> = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, String(v));
      }
    });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<any>(`/contacts${qs}`);
  }

  async getContact(contactId: number) {
    return this.request<any>(`/contacts/${contactId}`);
  }

  async addContactInteraction(contactId: number, interaction: any) {
    return this.request<any>(`/contacts/${contactId}/interactions`, {
      method: 'POST',
      body: JSON.stringify(interaction),
    });
  }

  async updateContactStatus(contactId: number, status: string, outcome?: string, notes?: string) {
    return this.request<any>(`/contacts/${contactId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, outcome, notes }),
    });
  }

  // Cases
  async getCases(params: Record<string, any> = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, String(v));
      }
    });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<any>(`/cases${qs}`);
  }

  async getCase(caseId: number) {
    return this.request<any>(`/cases/${caseId}`);
  }

  async createCase(caseData: any) {
    return this.request<any>('/cases', {
      method: 'POST',
      body: JSON.stringify(caseData),
    });
  }

  async updateCase(caseId: number, caseData: any) {
    return this.request<any>(`/cases/${caseId}`, {
      method: 'PATCH',
      body: JSON.stringify(caseData),
    });
  }

  async addCaseNote(caseId: number, note: string) {
    return this.request<any>(`/cases/${caseId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  }

  // SLA
  async getSLAPolicies() {
    return this.request<any[]>('/sla/policies');
  }

  async getSLABreaches() {
    return this.request<any>('/sla/breaches');
  }

  // Analytics
  async getDashboardMetrics() {
    return this.request<any>('/analytics/dashboard');
  }

  // Audit Logs
  async getAuditLogs(params: Record<string, any> = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, String(v));
      }
    });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<any>(`/audit${qs}`);
  }

  // Integrations & Health
  async getProviderStatus() {
    return this.request<any>('/integrations/status');
  }

  async ingestEvent(idempotencyKey: string, eventType: string, payload: any) {
    return this.request<any>('/integrations/events', {
      method: 'POST',
      body: JSON.stringify({ idempotency_key: idempotencyKey, event_type: eventType, payload }),
    });
  }
}

export const api = new ApiClient();
