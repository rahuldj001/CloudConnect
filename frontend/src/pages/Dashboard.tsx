import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Clock,
  PhoneCall,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api/client';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { useWebSocket } from '../contexts/WebSocketContext';
import { DashboardMetrics } from '../types';

export const Dashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const { subscribe } = useWebSocket();

  // Query supervisor dashboard metrics from database
  const {
    data: metrics,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard-metrics'],
    queryFn: () => api.getDashboardMetrics(),
    refetchInterval: 10000, // Background refresh every 10s
  });

  // Real-time WebSocket event listener to instantly invalidate and refresh metrics
  useEffect(() => {
    const unsubscribe = subscribe('all', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    });
    return () => unsubscribe();
  }, [subscribe, queryClient]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <RefreshCw className="w-8 h-8 text-brand-400 animate-spin" />
        <p className="text-sm text-slate-400 font-mono">Aggregating live contact center metrics...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="glass-panel rounded-2xl p-8 border border-rose-500/40 text-center max-w-lg mx-auto mt-12">
        <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-2">Metrics Aggregation Error</h3>
        <p className="text-xs text-rose-300 mb-6">{(error as any)?.message || 'Failed to fetch dashboard records.'}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const agentChartData = metrics?.agent_status_breakdown.map((item) => ({
    name: item.status.toUpperCase(),
    count: item.count,
    color:
      item.status === 'available'
        ? '#10b981'
        : item.status === 'busy'
        ? '#f59e0b'
        : item.status === 'away'
        ? '#eab308'
        : '#64748b',
  })) || [];

  const queueChartData = metrics?.queue_metrics.map((q) => ({
    name: q.queue_name,
    waiting: q.waiting_count,
    active: q.active_count,
  })) || [];

  const channelChartData = [
    { name: 'Voice', value: metrics?.channel_distribution.voice || 0, color: '#06b6d4' },
    { name: 'Chat', value: metrics?.channel_distribution.chat || 0, color: '#6366f1' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Header & Simulation Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Supervisor Operations Dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time contact volume, agent availability, SLA breach alerts, and queue metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Real-time DB Record Sync</span>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors"
            title="Refresh now"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Active Agents"
          value={`${metrics?.active_agents || 0} / ${metrics?.total_agents || 0}`}
          subtitle={`${metrics?.available_agents || 0} Available for routing`}
          icon={<Users className="w-5 h-5" />}
          colorScheme="emerald"
          isSimulated={metrics?.is_simulated_environment}
        />

        <StatCard
          title="Waiting Contacts"
          value={metrics?.waiting_contacts || 0}
          subtitle={`${metrics?.active_contacts || 0} currently connected`}
          icon={<PhoneCall className="w-5 h-5" />}
          colorScheme="blue"
          isSimulated={metrics?.is_simulated_environment}
        />

        <StatCard
          title="Average Wait Time"
          value={`${metrics?.average_wait_time_seconds || 0}s`}
          subtitle={`Avg Handle: ${metrics?.average_handle_time_seconds || 0}s`}
          icon={<Clock className="w-5 h-5" />}
          colorScheme="amber"
          isSimulated={metrics?.is_simulated_environment}
        />

        <StatCard
          title="SLA Breached Cases"
          value={metrics?.sla_breached_cases || 0}
          subtitle={`Resolution Rate: ${metrics?.resolution_rate_percent || 0}%`}
          icon={<ShieldAlert className="w-5 h-5" />}
          colorScheme={metrics?.sla_breached_cases ? 'rose' : 'emerald'}
          isSimulated={metrics?.is_simulated_environment}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Presence Breakdown */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white tracking-wide">Agent Availability</h3>
            <span className="text-[11px] font-mono text-slate-400">Live Status</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agentChartData}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#f8fafc', fontWeight: 600 }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {agentChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Queue Depths Breakdown */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white tracking-wide">Queue Depths</h3>
            <span className="text-[11px] font-mono text-slate-400">Waiting vs Active</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={queueChartData} layout="vertical">
                <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={10} width={100} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#f8fafc', fontWeight: 600 }}
                />
                <Bar dataKey="waiting" name="Waiting" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                <Bar dataKey="active" name="Active" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Channel Distribution */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white tracking-wide">Channel Distribution</h3>
            <span className="text-[11px] font-mono text-slate-400">Voice vs Chat</span>
          </div>
          <div className="h-48 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={channelChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {channelChartData.map((entry, index) => (
                    <Cell key={`pie-cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 text-xs text-slate-400 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
              <span>Voice ({metrics?.channel_distribution.voice || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
              <span>Chat ({metrics?.channel_distribution.chat || 0})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Queue Performance Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white tracking-wide">Live Contact Queues Status</h3>
          <span className="text-xs text-slate-400 font-mono">
            {metrics?.queue_metrics.length || 0} Configured Queues
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Queue Name</th>
                <th className="px-6 py-3.5">Channel</th>
                <th className="px-6 py-3.5">Waiting Contacts</th>
                <th className="px-6 py-3.5">Active Contacts</th>
                <th className="px-6 py-3.5">Average Wait</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {metrics?.queue_metrics.map((queue) => (
                <tr key={queue.queue_id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 font-semibold text-white">{queue.queue_name}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={queue.channel} type="channel" />
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-blue-400">{queue.waiting_count}</td>
                  <td className="px-6 py-4 font-mono font-bold text-emerald-400">{queue.active_count}</td>
                  <td className="px-6 py-4 font-mono text-slate-300">{queue.avg_wait_seconds}s</td>
                </tr>
              ))}
              {(!metrics?.queue_metrics || metrics.queue_metrics.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No active queues found. Configure queues in Queue Management.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
