import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  GitMerge,
  Info,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Zap,
} from 'lucide-react';
import { api } from '../api/client';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { ChannelType, RoutingRule, SimulateContactResponse } from '../types';

export const RoutingSimulator: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();

  // Simulation form state
  const [customerName, setCustomerName] = useState('Alex Henderson');
  const [customerPhone, setCustomerPhone] = useState('+1-555-0149');
  const [channel, setChannel] = useState<ChannelType>('voice');
  const [queueId, setQueueId] = useState<number | undefined>(undefined);
  const [priority, setPriority] = useState<number>(75);
  const [selectedSkills, setSelectedSkills] = useState<string[]>(['tier_2']);
  const [initialMessage, setInitialMessage] = useState('Customer requesting assistance with cloud service configuration.');

  // Simulation result state
  const [simResult, setSimResult] = useState<SimulateContactResponse | null>(null);

  // Create rule modal state
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleQueueId, setRuleQueueId] = useState<number>(1);
  const [rulePriority, setRulePriority] = useState<number>(70);
  const [ruleSkills, setRuleSkills] = useState<string[]>([]);
  const [minProficiency, setMinProficiency] = useState<number>(3);

  // Queries
  const { data: rules = [], refetch: refetchRules } = useQuery<RoutingRule[]>({
    queryKey: ['routing-rules'],
    queryFn: () => api.getRoutingRules(),
  });

  const { data: queues = [] } = useQuery({
    queryKey: ['queues'],
    queryFn: () => api.getQueues(),
  });

  const { data: skills = [] } = useQuery({
    queryKey: ['skills'],
    queryFn: () => api.getSkills(),
  });

  // Simulation mutation
  const simulateMutation = useMutation({
    mutationFn: (data: any) => api.simulateContact(data),
    onSuccess: (res: SimulateContactResponse) => {
      setSimResult(res);
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    },
  });

  // Create rule mutation
  const createRuleMutation = useMutation({
    mutationFn: (newRule: any) => api.createRoutingRule(newRule),
    onSuccess: () => {
      setIsRuleModalOpen(false);
      setRuleName('');
      setRuleSkills([]);
      queryClient.invalidateQueries({ queryKey: ['routing-rules'] });
    },
  });

  // Delete rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId: number) => api.deleteRoutingRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routing-rules'] });
    },
  });

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    simulateMutation.mutate({
      customer_name: customerName,
      customer_phone: customerPhone,
      channel,
      queue_id: queueId || (queues.length > 0 ? queues[0].id : undefined),
      priority,
      required_skills: selectedSkills,
      initial_message: initialMessage,
    });
  };

  const toggleSkill = (code: string) => {
    if (selectedSkills.includes(code)) {
      setSelectedSkills(selectedSkills.filter((s) => s !== code));
    } else {
      setSelectedSkills([...selectedSkills, code]);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Deterministic Routing Engine & Simulator
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Test real-time skill matching, queue priority routing, concurrency enforcement, and overflow mechanics.
        </p>
      </div>

      {/* Simulator Section Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Interactive Inbound Contact Dispatcher */}
        <div className="lg:col-span-5 glass-panel rounded-2xl p-6 border border-slate-800">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
            <Zap className="w-5 h-5 text-brand-400" />
            <div>
              <h2 className="text-base font-semibold text-white">Inbound Contact Dispatcher</h2>
              <p className="text-xs text-slate-400">Generate a simulated customer interaction</p>
            </div>
          </div>

          <form onSubmit={handleSimulate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Customer Name</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Customer Phone</label>
                <input
                  type="text"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Channel</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as ChannelType)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="voice">Voice Call</option>
                  <option value="chat">Digital Chat</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target Queue</label>
              <select
                value={queueId || ''}
                onChange={(e) => setQueueId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="">Default Queue (Auto-match channel)</option>
                {queues.map((q: any) => (
                  <option key={q.id} value={q.id}>
                    {q.name} ({q.channel} - Priority {q.priority})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-slate-300">Contact Priority</label>
                <span className="text-xs font-mono font-bold text-brand-400">{priority} / 100</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full accent-brand-500 cursor-pointer"
              />
            </div>

            {/* Required Skills Picker */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Required Agent Skills
              </label>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill: any) => {
                  const isSelected = selectedSkills.includes(skill.code);
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => toggleSkill(skill.code)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-brand-600 text-white border border-brand-400 shadow-sm shadow-brand-500/20'
                          : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {skill.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Initial Utterance / Message</label>
              <textarea
                rows={2}
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <button
              type="submit"
              disabled={simulateMutation.isPending}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 hover:from-brand-500 hover:to-cyan-400 text-white font-semibold text-xs tracking-wide shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{simulateMutation.isPending ? 'Evaluating Routing Engine...' : 'Dispatch Simulated Contact'}</span>
            </button>
          </form>
        </div>

        {/* Right: Live Decision Audit Trail */}
        <div className="lg:col-span-7 glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <GitMerge className="w-5 h-5 text-cyan-400" />
                <div>
                  <h2 className="text-base font-semibold text-white">Routing Engine Decision Trail</h2>
                  <p className="text-xs text-slate-400">Step-by-step deterministic decision log</p>
                </div>
              </div>

              {simResult && (
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-cyan-950/70 text-cyan-300 border border-cyan-500/30">
                  {simResult.provider_contact_id}
                </span>
              )}
            </div>

            {simResult ? (
              <div className="space-y-4">
                {/* Decision Outcome Card */}
                <div
                  className={`p-4 rounded-xl border ${
                    simResult.status === 'connected'
                      ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                      : simResult.status === 'overflowed'
                      ? 'bg-purple-950/40 border-purple-500/30 text-purple-300'
                      : 'bg-blue-950/40 border-blue-500/30 text-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider font-mono">
                      Routing Decision: {simResult.routing_decision?.decision || simResult.status}
                    </span>
                    <StatusBadge status={simResult.status} type="contact" />
                  </div>

                  {simResult.assigned_agent_id ? (
                    <p className="mt-2 text-sm text-white font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Assigned Agent:{' '}
                      <span className="text-emerald-400">
                        {simResult.routing_decision?.selected_agent_name || 'Agent'} (ID: {simResult.assigned_agent_id})
                      </span>
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-300">
                      No matching available agent currently meets all concurrency and skill proficiency thresholds.
                    </p>
                  )}
                </div>

                {/* Step-by-Step Reason Log */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Evaluation Steps & Decision Audit
                  </h4>
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs font-mono">
                    {(simResult.routing_decision?.reasons || []).map((reason, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-slate-300">
                        <span className="text-brand-400 font-bold">{idx + 1}.</span>
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <Info className="w-10 h-10 mb-2 text-slate-600" />
                <p className="text-sm font-semibold text-slate-400">Simulator Idle</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Click 'Dispatch Simulated Contact' on the left to execute deterministic routing, view
                  skill matching, concurrency checks, and step-by-step decision auditing.
                </p>
              </div>
            )}
          </div>

          {/* Sandbox Disclaimer */}
          <div className="mt-6 pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center gap-2 font-mono">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span>Deterministic Sandbox. Pure software event simulation without telephony carrier dependencies.</span>
          </div>
        </div>
      </div>

      {/* Routing Rules Table Section */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide">Configured Routing Rules</h3>
            <p className="text-xs text-slate-400">Deterministic skill requirements and queue bindings</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetchRules()}
              title="Refresh Rules"
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-white"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {hasRole('admin', 'supervisor') && (
              <button
                onClick={() => setIsRuleModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Routing Rule</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Rule Name</th>
                <th className="px-6 py-3.5">Queue Target</th>
                <th className="px-6 py-3.5">Rule Priority</th>
                <th className="px-6 py-3.5">Required Skills</th>
                <th className="px-6 py-3.5">Min Proficiency</th>
                <th className="px-6 py-3.5">Status</th>
                {hasRole('admin', 'supervisor') && <th className="px-6 py-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 font-semibold text-white">{rule.name}</td>
                  <td className="px-6 py-4 font-medium text-slate-300">{rule.queue_name}</td>
                  <td className="px-6 py-4 font-mono font-bold text-brand-400">{rule.priority}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {rule.required_skills.map((s, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-300">Level {rule.min_proficiency}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                      ACTIVE
                    </span>
                  </td>
                  {hasRole('admin', 'supervisor') && (
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => deleteRuleMutation.mutate(rule.id)}
                        className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                        title="Delete rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Rule Modal */}
      <Modal isOpen={isRuleModalOpen} onClose={() => setIsRuleModalOpen(false)} title="Create Routing Rule">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createRuleMutation.mutate({
              name: ruleName,
              queue_id: ruleQueueId,
              priority: rulePriority,
              required_skills: ruleSkills,
              min_proficiency: minProficiency,
              rule_condition: {},
              is_active: true,
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Rule Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Tier 2 Support Skill Rule"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Queue Target</label>
              <select
                value={ruleQueueId}
                onChange={(e) => setRuleQueueId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-brand-500"
              >
                {queues.map((q: any) => (
                  <option key={q.id} value={q.id}>
                    {q.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Priority (1-100)</label>
              <input
                type="number"
                min={1}
                max={100}
                required
                value={rulePriority}
                onChange={(e) => setRulePriority(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Required Skills</label>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill: any) => {
                const isSelected = ruleSkills.includes(skill.code);
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) setRuleSkills(ruleSkills.filter((s) => s !== skill.code));
                      else setRuleSkills([...ruleSkills, skill.code]);
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-medium ${
                      isSelected
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {skill.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Min Proficiency Level (1-5)</label>
            <input
              type="number"
              min={1}
              max={5}
              value={minProficiency}
              onChange={(e) => setMinProficiency(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsRuleModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-800 text-xs font-semibold text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createRuleMutation.isPending}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white"
            >
              Save Rule
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
