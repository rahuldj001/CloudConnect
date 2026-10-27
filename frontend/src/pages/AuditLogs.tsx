import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Code,
  Filter,
  RefreshCw,
  Search,
} from 'lucide-react';
import { api } from '../api/client';
import { Modal } from '../components/Modal';
import { AuditLog } from '../types';

export const AuditLogs: React.FC = () => {
  const [page, setPage] = useState(1);
  const [resourceType, setResourceType] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', page, resourceType, actionFilter, searchTerm],
    queryFn: () =>
      api.getAuditLogs({
        page,
        page_size: 20,
        resource_type: resourceType || undefined,
        action: actionFilter || undefined,
        search: searchTerm || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const logs: AuditLog[] = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20) || 1;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">System & Routing Audit Trail</h1>
          <p className="text-xs text-slate-400 mt-1">
            Immutable log of administrative actions, agent status transitions, routing decisions, and security events.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="p-2 self-start rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel rounded-xl p-4 border border-slate-800 flex flex-col md:flex-row gap-3 justify-between items-center">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by action, resource ID, or correlation ID..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-900/90 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={resourceType}
              onChange={(e) => {
                setResourceType(e.target.value);
                setPage(1);
              }}
              className="py-2 px-3 bg-slate-900/90 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-brand-500"
            >
              <option value="">All Resource Types</option>
              <option value="agent">Agent Profile</option>
              <option value="contact">Contact</option>
              <option value="queue">Queue</option>
              <option value="case">Case</option>
              <option value="routing_rule">Routing Rule</option>
              <option value="user">User</option>
              <option value="integration_event">Integration Event</option>
            </select>

            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="py-2 px-3 bg-slate-900/90 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-brand-500"
            >
              <option value="">All Actions</option>
              <option value="AGENT_STATUS_UPDATE">AGENT_STATUS_UPDATE</option>
              <option value="ROUTING_DECISION">ROUTING_DECISION</option>
              <option value="CASE_CREATED">CASE_CREATED</option>
              <option value="CASE_ESCALATED">CASE_ESCALATED</option>
              <option value="INTEGRATION_EVENT">INTEGRATION_EVENT</option>
            </select>
          </div>
        </div>

        <span className="text-xs font-mono text-slate-400">Total: {total} Audit Events</span>
      </div>

      {/* Audit Logs Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Timestamp (UTC)</th>
                <th className="px-6 py-3.5">Action</th>
                <th className="px-6 py-3.5">Resource</th>
                <th className="px-6 py-3.5">Resource ID</th>
                <th className="px-6 py-3.5">Actor</th>
                <th className="px-6 py-3.5">Correlation ID</th>
                <th className="px-6 py-3.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-sans">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-sans">
                    No audit records matching criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-3.5 text-slate-400 text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 font-bold text-white font-sans">{log.action}</td>
                    <td className="px-6 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {log.resource_type}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-brand-400 font-bold">{log.resource_id}</td>
                    <td className="px-6 py-3.5 font-sans text-slate-300">
                      {log.actor_name || 'System Engine'}
                    </td>
                    <td className="px-6 py-3.5 text-[11px] text-slate-500 truncate max-w-[120px]">
                      {log.request_id}
                    </td>
                    <td className="px-6 py-3.5 text-right font-sans">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                        title="View Payload"
                      >
                        <Code className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* JSON Payload Inspector Modal */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={`Audit Payload: ${selectedLog.action}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-400 pb-3 border-b border-slate-800">
              <div>
                <span>Resource: </span>
                <span className="text-white font-bold">{selectedLog.resource_type} ({selectedLog.resource_id})</span>
              </div>
              <div>
                <span>Actor: </span>
                <span className="text-white font-bold">{selectedLog.actor_name}</span>
              </div>
              <div className="col-span-2">
                <span>Correlation Request ID: </span>
                <span className="text-brand-400">{selectedLog.request_id}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">JSON Details</span>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto max-h-72">
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
