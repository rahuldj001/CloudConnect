import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRightLeft,
  Clock,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api/client';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { ChannelType, Queue } from '../types';

export const Queues: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<ChannelType>('voice');
  const [priority, setPriority] = useState<number>(50);
  const [maxWaitTime, setMaxWaitTime] = useState<number>(180);
  const [overflowQueueId, setOverflowQueueId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch queues
  const { data: queues = [], isLoading, refetch } = useQuery<Queue[]>({
    queryKey: ['queues'],
    queryFn: () => api.getQueues(),
  });

  // Create queue mutation
  const createQueueMutation = useMutation({
    mutationFn: (newQueue: any) => api.createQueue(newQueue),
    onSuccess: () => {
      setIsCreateModalOpen(false);
      setName('');
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['queues'] });
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to create queue.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Queue name is required.');
      return;
    }
    createQueueMutation.mutate({
      name,
      channel,
      priority: Number(priority),
      max_wait_time_seconds: Number(maxWaitTime),
      overflow_queue_id: overflowQueueId,
      is_active: true,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Contact Queues & Distribution</h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure inbound call and chat queues, priority weights, SLA thresholds, and overflow routing.
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
          {hasRole('admin', 'supervisor') && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white shadow-md shadow-brand-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Create Contact Queue</span>
            </button>
          )}
        </div>
      </div>

      {/* Queues Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-500">Loading queues...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {queues.map((q) => {
          const overflowQueue = queues.find((other) => other.id === q.overflow_queue_id);

          return (
            <div
              key={q.id}
              className="glass-panel glass-panel-hover rounded-2xl p-6 border border-slate-800 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-white text-base">{q.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={q.channel} type="channel" />
                      <span className="text-[11px] font-mono font-bold text-brand-400 bg-brand-950/60 px-2 py-0.5 rounded border border-brand-500/30">
                        Priority {q.priority}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      q.is_active
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {q.is_active ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </div>

                {/* Queue Metrics */}
                <div className="mt-5 grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs font-mono">
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 block">Waiting Contacts</span>
                    <span className="text-lg font-bold text-blue-400">{q.active_contacts_count || 0}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 block">Subscribed Agents</span>
                    <span className="text-lg font-bold text-emerald-400">{q.assigned_agents_count || 0}</span>
                  </div>
                </div>

                {/* SLA Threshold & Overflow */}
                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Max Queue Wait Time:
                    </span>
                    <span className="font-mono text-white font-semibold">{q.max_wait_time_seconds}s</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400" />
                      Overflow Target:
                    </span>
                    <span className="font-semibold text-slate-200">
                      {overflowQueue ? overflowQueue.name : 'None (Hold in queue)'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                <span>ID: {q.id}</span>
                <span>Deterministic Distribution</span>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Create Queue Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Contact Queue"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Queue Name</label>
            <input
              type="text"
              required
              placeholder="e.g. VIP Accounts Inbound"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Channel</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as ChannelType)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
              >
                <option value="voice">Voice Call</option>
                <option value="chat">Digital Chat</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Priority (1 - 100)</label>
              <input
                type="number"
                min={1}
                max={100}
                required
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Max Wait Time (Seconds)</label>
              <input
                type="number"
                min={10}
                max={3600}
                required
                value={maxWaitTime}
                onChange={(e) => setMaxWaitTime(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Overflow Queue</label>
              <select
                value={overflowQueueId || ''}
                onChange={(e) => setOverflowQueueId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
              >
                <option value="">No Overflow (Hold in queue)</option>
                {queues.map((other) => (
                  <option key={other.id} value={other.id}>
                    {other.name} ({other.channel})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createQueueMutation.isPending}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white shadow-md shadow-brand-500/20 disabled:opacity-50"
            >
              {createQueueMutation.isPending ? 'Creating...' : 'Save Queue'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
