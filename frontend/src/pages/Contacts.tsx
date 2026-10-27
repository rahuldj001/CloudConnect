import React, { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  RefreshCw,
  Search,
} from 'lucide-react';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { Contact } from '../types';

export const Contacts: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['contacts', page, channelFilter, statusFilter, searchTerm],
    queryFn: () =>
      api.getContacts({
        page,
        page_size: 15,
        channel: channelFilter || undefined,
        contact_status: statusFilter || undefined,
        search: searchTerm || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const contacts: Contact[] = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 15) || 1;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Contact & Interaction History</h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse active and historical voice and chat contacts, agent assignments, and customer timelines.
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
              placeholder="Search by customer name, phone, or contact ID..."
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
              value={channelFilter}
              onChange={(e) => {
                setChannelFilter(e.target.value);
                setPage(1);
              }}
              className="py-2 px-3 bg-slate-900/90 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-brand-500"
            >
              <option value="">All Channels</option>
              <option value="voice">Voice Only</option>
              <option value="chat">Chat Only</option>
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="py-2 px-3 bg-slate-900/90 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-brand-500"
          >
            <option value="">All Statuses</option>
            <option value="connected">Connected</option>
            <option value="queued">Queued</option>
            <option value="completed">Completed</option>
            <option value="wrap_up">Wrap Up</option>
            <option value="overflowed">Overflowed</option>
            <option value="abandoned">Abandoned</option>
          </select>
        </div>

        <span className="text-xs font-mono text-slate-400">Total: {total} Contacts</span>
      </div>

      {/* Contacts Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Contact ID</th>
                <th className="px-6 py-3.5">Customer</th>
                <th className="px-6 py-3.5">Channel</th>
                <th className="px-6 py-3.5">Queue</th>
                <th className="px-6 py-3.5">Assigned Agent</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Wait Time</th>
                <th className="px-6 py-3.5">Duration</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    Loading contact interactions...
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    No matching contacts found. Use the Simulator to dispatch inbound contacts.
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-white">
                      <span className="text-brand-400">{contact.provider_contact_id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-200">{contact.customer_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{contact.customer_phone_masked}</div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={contact.channel} type="channel" />
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-300">{contact.queue_name || '—'}</td>
                    <td className="px-6 py-4">
                      {contact.assigned_agent_name ? (
                        <span className="font-medium text-emerald-400">{contact.assigned_agent_name}</span>
                      ) : (
                        <span className="text-slate-500 italic">Unassigned (Queued)</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={contact.status} type="contact" />
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-300">{contact.waiting_time_seconds}s</td>
                    <td className="px-6 py-4 font-mono text-slate-300">
                      {contact.duration_seconds > 0 ? `${contact.duration_seconds}s` : 'Active'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => navigate(`/contacts/${contact.id}`)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-brand-600 text-slate-300 hover:text-white transition-all shadow-sm"
                        title="View Timeline"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
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
    </div>
  );
};
