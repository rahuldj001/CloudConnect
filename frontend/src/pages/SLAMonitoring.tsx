import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  RefreshCw,
  ShieldAlert,
  Timer,
} from 'lucide-react';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { SLABreachSummary, SLAPolicy } from '../types';

export const SLAMonitoring: React.FC = () => {
  const navigate = useNavigate();

  // Fetch SLA breaches summary
  const { data: breachSummary, refetch: refetchBreaches } = useQuery<SLABreachSummary>({
    queryKey: ['sla-breaches'],
    queryFn: () => api.getSLABreaches(),
    refetchInterval: 10000,
  });

  // Fetch SLA policy definitions
  const { data: policies = [] } = useQuery<SLAPolicy[]>({
    queryKey: ['sla-policies'],
    queryFn: () => api.getSLAPolicies(),
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">SLA Breach Engine & Compliance</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time response & resolution deadlines, approaching breach alerts, and compliance thresholds.
          </p>
        </div>

        <button
          onClick={() => refetchBreaches()}
          className="p-2 self-start rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-panel rounded-xl p-5 border border-slate-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Open Cases</p>
              <h3 className="mt-2 text-2xl font-bold font-mono text-white">
                {breachSummary?.total_active_cases || 0}
              </h3>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400">
              <Timer className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">Monitored for compliance</p>
        </div>

        <div className="glass-panel rounded-xl p-5 border border-slate-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Approaching Response</p>
              <h3 className="mt-2 text-2xl font-bold font-mono text-amber-400">
                {breachSummary?.approaching_response_breach_count || 0}
              </h3>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">&lt; 30 minutes to response deadline</p>
        </div>

        <div className="glass-panel rounded-xl p-5 border border-slate-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Response Breached</p>
              <h3 className="mt-2 text-2xl font-bold font-mono text-rose-400">
                {breachSummary?.response_breached_count || 0}
              </h3>
            </div>
            <div className="p-3 rounded-lg bg-rose-500/10 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">Initial response deadline elapsed</p>
        </div>

        <div className="glass-panel rounded-xl p-5 border border-slate-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Resolution Breached</p>
              <h3 className="mt-2 text-2xl font-bold font-mono text-rose-500">
                {breachSummary?.resolution_breached_count || 0}
              </h3>
            </div>
            <div className="p-3 rounded-lg bg-rose-500/15 text-rose-400">
              <AlertOctagon className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">Resolution SLA target elapsed</p>
        </div>
      </div>

      {/* Breached Cases Incident Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Current Breached Cases</span>
            </h3>
            <p className="text-xs text-slate-400">Cases requiring immediate supervisory intervention</p>
          </div>
          <span className="text-xs font-mono text-rose-400 font-bold">
            {breachSummary?.breached_cases?.length || 0} Breaches Detected
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Case #</th>
                <th className="px-6 py-3.5">Priority</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Assigned Agent</th>
                <th className="px-6 py-3.5">Response Deadline</th>
                <th className="px-6 py-3.5">Resolution Deadline</th>
                <th className="px-6 py-3.5">Breach Flags</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {breachSummary?.breached_cases?.map((item) => (
                <tr key={item.case_id} className="hover:bg-rose-950/20 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-brand-400">{item.case_number}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={item.priority} type="priority" />
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-300 uppercase text-[11px]">
                    {item.status.replace('_', ' ')}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-200">
                    {item.assigned_user_name || 'Unassigned'}
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-400">
                    {new Date(item.response_deadline).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-400">
                    {new Date(item.resolution_deadline).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1.5">
                      {item.is_response_breached && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-500/50">
                          Resp Breached
                        </span>
                      )}
                      {item.is_resolution_breached && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-500/50">
                          Resol Breached
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => navigate('/cases')}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-brand-600 text-slate-300 hover:text-white transition-colors"
                      title="Open in Cases"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {(!breachSummary?.breached_cases || breachSummary.breached_cases.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-emerald-400 font-medium">
                    <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-400" />
                    All active cases are currently adhering to SLA response and resolution targets.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SLA Policy Definitions Grid */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800">
        <h3 className="text-sm font-semibold text-white tracking-wide mb-1">Configured SLA Policy Tiers</h3>
        <p className="text-xs text-slate-400 mb-5">
          Deterministic deadlines automatically initialized on case creation based on priority tier.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white text-sm">{policy.name}</span>
                  <StatusBadge status={policy.priority} type="priority" />
                </div>
                <div className="space-y-1.5 mt-3 text-xs font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>Response Deadline:</span>
                    <span className="text-white font-bold">{policy.response_time_minutes} min</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Resolution Deadline:</span>
                    <span className="text-white font-bold">
                      {policy.resolution_time_minutes >= 60
                        ? `${policy.resolution_time_minutes / 60} hrs`
                        : `${policy.resolution_time_minutes} min`}
                    </span>
                  </div>
                </div>
              </div>
              <span className="mt-4 pt-2 border-t border-slate-800 text-[10px] text-slate-500 block uppercase font-bold">
                Auto-Enforced
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
