import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RoutingSimulator } from '../pages/RoutingSimulator';
import { AuthContext } from '../contexts/AuthContext';
import { api } from '../api/client';
import { UserRole } from '../types';

vi.mock('../api/client', () => ({
  api: {
    getRoutingRules: vi.fn().mockResolvedValue([
      {
        id: 1,
        name: 'Tier 2 Voice Escalations',
        queue_name: 'Tier 2 Technical Support',
        priority: 75,
        required_skills: ['tier_2', 'billing'],
        min_proficiency: 3,
        is_active: true,
      },
    ]),
    getQueues: vi.fn().mockResolvedValue([
      { id: 1, name: 'Tier 1 Support', channel: 'voice', priority: 50, is_active: true, active_contacts_count: 0, assigned_agents_count: 2 },
      { id: 2, name: 'Tier 2 Technical Support', channel: 'voice', priority: 70, is_active: true, active_contacts_count: 0, assigned_agents_count: 1 },
    ]),
    getSkills: vi.fn().mockResolvedValue([
      { id: 1, name: 'Tier 2 Technical', code: 'tier_2' },
      { id: 2, name: 'Billing & Payments', code: 'billing' },
    ]),
    simulateContact: vi.fn().mockResolvedValue({
      contact_id: 101,
      provider_contact_id: 'sim-contact-test-01',
      status: 'ROUTED',
      channel: 'voice',
      queue_id: 2,
      assigned_agent_id: 2,
      is_simulated: true,
      routing_decision: {
        decision: 'ROUTED',
        reasons: ['Matched optimal agent agent-2 (proficiency=4, load=0)'],
        queue_id: 2,
        selected_agent_name: 'Bob Agent',
        eligible_agents_count: 1,
        overflow_triggered: false,
        routed_at: new Date().toISOString(),
      },
    }),
  },
}));

const renderSimulator = (role: UserRole = 'supervisor') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          user: {
            id: 1,
            email: 'supervisor@cloudconnect.dev',
            role,
            full_name: 'Supervisor User',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          token: 'token',
          login: vi.fn(),
          logout: vi.fn(),
          hasRole: (...roles) => roles.includes(role),
          isAuthenticated: true,
          isLoading: false,
        }}
      >
        <BrowserRouter>
          <RoutingSimulator />
        </BrowserRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
};

describe('RoutingSimulator Page', () => {
  it('renders routing simulation console and sandbox disclaimer', async () => {
    renderSimulator();
    expect(screen.getByText(/Deterministic Routing Engine & Simulator/i)).toBeInTheDocument();
    expect(screen.getByText(/Pure software event simulation without telephony carrier dependencies/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dispatch Simulated Contact/i })).toBeInTheDocument();
  });

  it('displays configured routing rules table', async () => {
    renderSimulator();
    expect(await screen.findByText('Tier 2 Voice Escalations')).toBeInTheDocument();
    expect(screen.getByText('Tier 2 Technical Support')).toBeInTheDocument();
  });

  it('dispatches contact and renders deterministic routing decision result', async () => {
    renderSimulator();

    const dispatchBtn = screen.getByRole('button', { name: /Dispatch Simulated Contact/i });
    fireEvent.submit(dispatchBtn.closest('form')!);

    await waitFor(() => {
      expect(api.simulateContact).toHaveBeenCalled();
    });

    expect(await screen.findByText(/Routing Decision:\s*ROUTED/i)).toBeInTheDocument();
    expect(screen.getByText(/Bob Agent/i)).toBeInTheDocument();
    expect(screen.getByText(/Matched optimal agent agent-2/i)).toBeInTheDocument();
  });
});
