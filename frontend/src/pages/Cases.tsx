import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileCheck,
  Filter,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  User,
} from 'lucide-react';
import { api } from '../api/client';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { Case, CasePriority } from '../types';

export const Cases: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);

  // New Case Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [customerIdentifier, setCustomerIdentifier] = useState('');
  const [priority, setPriority] = useState<CasePriority>('medium');
  const [newNote, setNewNote] = useState('');

  // Fetch Cases
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cases', statusFilter, priorityFilter, searchTerm],
    queryFn: () =>
      api.getCases({
        case_status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        search: searchTerm || undefined,
      }),
  });

  const cases: Case[] = data?.items || [];

  // Create Case Mutation
  const createCaseMutation = useMutation({
    mutationFn: (newCase: any) => api.createCase(newCase),
    onSuccess: () => {
      setIsCreateModalOpen(false);
      setTitle('');
      setDescription('');
      setCustomerIdentifier('');
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['sla-breaches'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    },
  });

  // Update Case Mutation
  const updateCaseMutation = useMutation({
    mutationFn: ({ caseId, data }: { caseId: number; data: any }) => api.updateCase(caseId, data),
    onSuccess: (updated) => {
      setSelectedCase(updated);
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['sla-breaches'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    },
  });

  // Add Note Mutation
  const addNoteMutation = useMutation({
    mutationFn: ({ caseId, note }: { caseId: number; note: string }) =>
      api.addCaseNote(caseId, note),
    onSuccess: () => {
      setNewNote('');
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      if (selectedCase) {
        api.getCase(selectedCase.id).then((fresh) => setSelectedCase(fresh));
      }
    },
  });

  const handleCreateCase = (e: React.FormEvent) => {
    e.preventDefault();
    createCaseMutation.mutate({
      title,
      description,
      customer_identifier: customerIdentifier,
      priority,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Customer Support Cases & SLAs</h1>
          <p className="text-xs text-slate-400 mt-1">
            Track escalated customer tickets, assignees, deterministic SLA deadlines, and internal audit notes.
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
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white shadow-md shadow-brand-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Create Case</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel rounded-xl p-4 border border-slate-800 flex flex-col md:flex-row gap-3 justify-between items-center">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by case #, title, or customer..."
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
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="escalated">Escalated</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="py-2 px-3 bg-slate-900/90 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-brand-500"
          >
            <option value="">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <span className="text-xs font-mono text-slate-400">Total Cases: {cases.length}</span>
      </div>

      {/* Main Split Grid (Case Directory + Active Case Detail Pane) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Case Cards List */}
        <div className="lg:col-span-7 space-y-3">
          {isLoading ? (
            <div className="glass-panel rounded-xl p-8 text-center text-slate-500 border border-slate-800">
              Loading support cases...
            </div>
          ) : cases.length === 0 ? (
            <div className="glass-panel rounded-xl p-8 text-center text-slate-500 border border-slate-800">
              No cases matching filter criteria. Click 'Create Case' above to file a new support issue.
            </div>
          ) : (
            cases.map((c) => {
            const isBreached = c.sla?.is_response_breached || c.sla?.is_resolution_breached;
            const isSelected = selectedCase?.id === c.id;

            return (
              <div
                key={c.id}
                onClick={() => setSelectedCase(c)}
                className={`glass-panel rounded-xl p-4 border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-brand-500 shadow-md shadow-brand-500/10 bg-slate-900/90'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-brand-400">{c.case_number}</span>
                      <StatusBadge status={c.priority} type="priority" />
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        {c.status.replace('_', ' ')}
                      </span>
                    </div>
                    <h3 className="font-semibold text-white text-sm mt-1.5">{c.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{c.customer_identifier}</p>
                  </div>

                  {isBreached && (
                    <span className="px-2 py-1 rounded text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-500/40 glow-rose flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-rose-400" />
                      SLA BREACHED
                    </span>
                  )}
                </div>

                {/* SLA Countdown & Assignee Footer */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>{c.assigned_user ? c.assigned_user.full_name : 'Unassigned'}</span>
                  </div>

                  {c.sla && (
                    <div className="flex items-center gap-3">
                      <span>
                        Resp: {c.sla.response_time_remaining_minutes !== undefined && c.sla.response_time_remaining_minutes > 0
                          ? `${c.sla.response_time_remaining_minutes}m`
                          : c.sla.is_response_breached
                          ? 'Breached'
                          : 'Met'}
                      </span>
                      <span>•</span>
                      <span>
                        Res: {c.sla.resolution_time_remaining_minutes !== undefined && c.sla.resolution_time_remaining_minutes > 0
                          ? `${c.sla.resolution_time_remaining_minutes}m`
                          : c.sla.is_resolution_breached
                          ? 'Breached'
                          : 'Met'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
          )}
        </div>

        {/* Right: Selected Case Detail & Actions Pane */}
        <div className="lg:col-span-5">
          {selectedCase ? (
            <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-5 sticky top-6">
              <div className="flex items-start justify-between pb-4 border-b border-slate-800">
                <div>
                  <span className="font-mono text-xs font-bold text-brand-400">{selectedCase.case_number}</span>
                  <h2 className="text-base font-bold text-white mt-1">{selectedCase.title}</h2>
                  <p className="text-xs text-slate-400">{selectedCase.customer_identifier}</p>
                </div>
                <StatusBadge status={selectedCase.priority} type="priority" />
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Issue Description</span>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                  {selectedCase.description}
                </p>
              </div>

              {/* Status & Escalation Controls */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Workflow Transition</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => updateCaseMutation.mutate({ caseId: selectedCase.id, data: { status: 'in_progress' } })}
                    className="py-1.5 px-2 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 font-semibold"
                  >
                    In Progress
                  </button>
                  <button
                    onClick={() => updateCaseMutation.mutate({ caseId: selectedCase.id, data: { status: 'escalated' } })}
                    className="py-1.5 px-2 rounded-lg bg-amber-950/70 border border-amber-500/40 hover:bg-amber-900/60 text-xs text-amber-300 font-semibold"
                  >
                    Escalate
                  </button>
                  <button
                    onClick={() => updateCaseMutation.mutate({ caseId: selectedCase.id, data: { status: 'resolved' } })}
                    className="py-1.5 px-2 rounded-lg bg-emerald-950/70 border border-emerald-500/40 hover:bg-emerald-900/60 text-xs text-emerald-300 font-semibold"
                  >
                    Resolve
                  </button>
                </div>
              </div>

              {/* SLA Target Card */}
              {selectedCase.sla && (
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Response Deadline:</span>
                    <span className={selectedCase.sla.is_response_breached ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                      {new Date(selectedCase.sla.response_deadline).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Resolution Deadline:</span>
                    <span className={selectedCase.sla.is_resolution_breached ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                      {new Date(selectedCase.sla.resolution_deadline).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Notes Stream */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-2">
                  Internal Notes & Audit History ({selectedCase.notes?.length || 0})
                </span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedCase.notes?.map((n) => (
                    <div key={n.id} className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span className="font-semibold text-slate-400">{n.author_name}</span>
                        <span>{new Date(n.created_at).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-300">{n.note}</p>
                    </div>
                  ))}
                </div>

                {/* Add Note Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newNote.trim()) return;
                    addNoteMutation.mutate({ caseId: selectedCase.id, note: newNote });
                  }}
                  className="mt-3 flex gap-2"
                >
                  <input
                    type="text"
                    placeholder="Add an internal note or diagnostic finding..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                  <button
                    type="submit"
                    disabled={addNoteMutation.isPending || !newNote.trim()}
                    className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    Post
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl p-8 border border-slate-800 text-center text-slate-500">
              <FileCheck className="w-10 h-10 mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-semibold text-slate-400">No Case Selected</p>
              <p className="text-xs text-slate-500 mt-1">Select any case on the left to review its SLA countdown, notes, and lifecycle actions.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Case Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create Customer Support Case">
        <form onSubmit={handleCreateCase} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Case Title</label>
            <input
              type="text"
              required
              placeholder="e.g. S3 Bucket Replication Access Denied"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Customer / Account</label>
              <input
                type="text"
                required
                placeholder="e.g. Acme Corp (Jordan Reed)"
                value={customerIdentifier}
                onChange={(e) => setCustomerIdentifier(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Priority Tier</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as CasePriority)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="critical">Critical (15m Response / 60m Resolution)</option>
                <option value="high">High (30m Response / 4h Resolution)</option>
                <option value="medium">Medium (2h Response / 8h Resolution)</option>
                <option value="low">Low (4h Response / 24h Resolution)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Detailed Description</label>
            <textarea
              rows={3}
              required
              placeholder="Describe symptoms, impact, and diagnostic logs..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-800 text-xs font-semibold text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createCaseMutation.isPending}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white"
            >
              File Support Case
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
