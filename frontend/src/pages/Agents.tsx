import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  Filter,
  ListOrdered,
  RefreshCw,
  Search,
} from 'lucide-react';
import { api } from '../api/client';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { AgentProfile } from '../types';

export const Agents: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile | null>(null);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState<boolean>(false);
  const [statusChangeError, setStatusChangeError] = useState<string | null>(null);

  // Fetch agents
  const { data: agents = [], isLoading, refetch } = useQuery<AgentProfile[]>({
    queryKey: ['agents'],
    queryFn: () => api.getAgents(),
  });

  // Fetch all skills for modal
  const { data: allSkills = [] } = useQuery({
    queryKey: ['skills'],
    queryFn: () => api.getSkills(),
  });

  // Status transition mutation
  const statusMutation = useMutation({
    mutationFn: ({ agentId, status }: { agentId: number; status: string }) =>
      api.updateAgentStatus(agentId, status),
    onSuccess: () => {
      setStatusChangeError(null);
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    },
    onError: (err: any) => {
      setStatusChangeError(err.message || 'Status transition rejected.');
    },
  });

  // Update skills mutation
  const skillsMutation = useMutation({
    mutationFn: ({ agentId, skills }: { agentId: number; skills: any[] }) =>
      api.updateAgentSkills(agentId, skills),
    onSuccess: () => {
      setIsSkillModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  const filteredAgents = agents.filter((a) => {
    const matchesStatus = statusFilter === 'all' || a.current_status === statusFilter;
    const matchesSearch =
      a.user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.routing_profile_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleStatusChange = (agent: AgentProfile, targetStatus: string) => {
    setStatusChangeError(null);
    statusMutation.mutate({ agentId: agent.id, status: targetStatus });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Agent Presence & Workforce</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time agent availability, routing profiles, skills mapping, and concurrency limits.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {statusChangeError && (
        <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/50 text-xs text-rose-300">
          {statusChangeError}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="glass-panel rounded-xl p-4 border border-slate-800 flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by agent name, email, or profile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900/90 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 px-3 bg-slate-900/90 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-brand-500"
            >
              <option value="all">All Presence States</option>
              <option value="available">Available Only</option>
              <option value="busy">Busy Only</option>
              <option value="away">Away Only</option>
              <option value="offline">Offline Only</option>
            </select>
          </div>
        </div>

        <span className="text-xs font-mono text-slate-400">
          Showing {filteredAgents.length} of {agents.length} Agents
        </span>
      </div>

      {/* Agents Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-500">Loading agent directory...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredAgents.map((agent) => {
          const isCurrentUser = user?.id === agent.user_id;
          const canManage = hasRole('admin', 'supervisor') || isCurrentUser;

          return (
            <div
              key={agent.id}
              className="glass-panel glass-panel-hover rounded-2xl p-5 border border-slate-800 flex flex-col justify-between"
            >
              <div>
                {/* Agent Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center font-bold text-white text-sm">
                      {agent.user.full_name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{agent.user.full_name}</h3>
                      <p className="text-xs text-slate-400">{agent.user.email}</p>
                    </div>
                  </div>
                  <StatusBadge status={agent.current_status} type="agent" />
                </div>

                {/* Routing Profile & Concurrency */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500">Routing Profile</span>
                    <p className="font-medium text-slate-300 truncate">{agent.routing_profile_name}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500">Concurrency</span>
                    <p className="font-medium text-slate-300 font-mono">
                      Voice: {agent.max_concurrency_voice} | Chat: {agent.max_concurrency_chat}
                    </p>
                  </div>
                </div>

                {/* Assigned Skills */}
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] uppercase font-semibold text-slate-500 flex items-center gap-1">
                      <Award className="w-3 h-3 text-brand-400" />
                      Skills ({agent.skills.length})
                    </span>
                    {hasRole('admin', 'supervisor') && (
                      <button
                        onClick={() => {
                          setSelectedAgent(agent);
                          setIsSkillModalOpen(true);
                        }}
                        className="text-[11px] text-brand-400 hover:text-brand-300 font-medium"
                      >
                        Edit Skills
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.skills.map((s) => (
                      <span
                        key={s.skill_id}
                        className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800/90 text-slate-300 border border-slate-700/60"
                      >
                        {s.name} <span className="text-brand-400 font-mono">L{s.proficiency_level}</span>
                      </span>
                    ))}
                    {agent.skills.length === 0 && (
                      <span className="text-xs text-slate-500 italic">No skills assigned</span>
                    )}
                  </div>
                </div>

                {/* Subscribed Queues */}
                <div className="mt-3">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 flex items-center gap-1 mb-1.5">
                    <ListOrdered className="w-3 h-3 text-cyan-400" />
                    Subscribed Queues ({agent.queues.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.queues.map((q) => (
                      <span
                        key={q.queue_id}
                        className="px-2 py-0.5 rounded text-[11px] font-medium bg-cyan-950/40 text-cyan-300 border border-cyan-800/40"
                      >
                        {q.name}
                      </span>
                    ))}
                    {agent.queues.length === 0 && (
                      <span className="text-xs text-slate-500 italic">No queues assigned</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Transition Control */}
              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Active load: <span className="font-mono text-white font-bold">{agent.active_contacts_count}</span>
                </span>

                {canManage ? (
                  <select
                    value={agent.current_status}
                    onChange={(e) => handleStatusChange(agent, e.target.value)}
                    disabled={statusMutation.isPending}
                    className="py-1 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-brand-500 cursor-pointer"
                  >
                    <option value="available">Set Available</option>
                    <option value="busy">Set Busy</option>
                    <option value="away">Set Away</option>
                    <option value="offline">Set Offline</option>
                  </select>
                ) : (
                  <span className="text-xs text-slate-500 italic">Managed by Supervisor</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Skills Management Modal */}
      {selectedAgent && (
        <Modal
          isOpen={isSkillModalOpen}
          onClose={() => setIsSkillModalOpen(false)}
          title={`Edit Skills for ${selectedAgent.user.full_name}`}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Select skills and assign proficiency levels (1-5) used by the deterministic routing engine.
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {allSkills.map((skill: any) => {
                const assigned = selectedAgent.skills.find((s) => s.skill_id === skill.id);
                return (
                  <div
                    key={skill.id}
                    className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{skill.name}</p>
                      <p className="text-[11px] font-mono text-slate-400">{skill.code}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        defaultValue={assigned ? assigned.proficiency_level : 0}
                        id={`skill-${skill.id}`}
                        className="py-1 px-2 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                      >
                        <option value={0}>Not Assigned</option>
                        <option value={1}>Level 1 (Basic)</option>
                        <option value={2}>Level 2 (Novice)</option>
                        <option value={3}>Level 3 (Competent)</option>
                        <option value={4}>Level 4 (Advanced)</option>
                        <option value={5}>Level 5 (Expert)</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsSkillModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const updatedSkills: any[] = [];
                  allSkills.forEach((skill: any) => {
                    const el = document.getElementById(`skill-${skill.id}`) as HTMLSelectElement;
                    if (el && Number(el.value) > 0) {
                      updatedSkills.push({
                        skill_id: skill.id,
                        proficiency_level: Number(el.value),
                      });
                    }
                  });
                  skillsMutation.mutate({ agentId: selectedAgent.id, skills: updatedSkills });
                }}
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white"
              >
                Save Skill Assignments
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
