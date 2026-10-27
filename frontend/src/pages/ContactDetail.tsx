import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  Headphones,
  MessageSquare,
  Send,
  User,
  Zap,
} from 'lucide-react';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { ActorType, Contact } from '../types';

export const ContactDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const [actorType, setActorType] = useState<ActorType>('agent');

  const contactId = Number(id);

  const { data: contact, isLoading } = useQuery<Contact>({
    queryKey: ['contact', contactId],
    queryFn: () => api.getContact(contactId),
    enabled: !!contactId,
    refetchInterval: 5000,
  });

  // Add interaction mutation
  const addInteractionMutation = useMutation({
    mutationFn: (interaction: any) => api.addContactInteraction(contactId, interaction),
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ status, outcome }: { status: string; outcome?: string }) =>
      api.updateContactStatus(contactId, status, outcome),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    },
  });

  if (isLoading || !contact) {
    return <div className="p-8 text-center text-slate-400 font-mono">Loading contact details...</div>;
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    addInteractionMutation.mutate({
      actor_type: actorType,
      message: newMessage,
      metadata_json: {},
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      {/* Top Navigation */}
      <button
        onClick={() => navigate('/contacts')}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Contacts</span>
      </button>

      {/* Contact Overview Card */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white font-mono">{contact.provider_contact_id}</h1>
              <StatusBadge status={contact.channel} type="channel" />
              <StatusBadge status={contact.status} type="contact" />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Customer: <span className="text-slate-200 font-semibold">{contact.customer_name}</span> ({contact.customer_phone_masked})
            </p>
          </div>

          {/* Wrap Up / Complete Controls */}
          {contact.status !== 'completed' && contact.status !== 'abandoned' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateStatusMutation.mutate({ status: 'wrap_up', outcome: 'Inquiry addressed' })}
                disabled={contact.status === 'wrap_up'}
                className="px-3.5 py-1.5 rounded-lg bg-amber-950/70 border border-amber-500/40 text-amber-300 hover:bg-amber-900/60 text-xs font-semibold disabled:opacity-40"
              >
                Set Wrap-Up
              </button>
              <button
                onClick={() => updateStatusMutation.mutate({ status: 'completed', outcome: 'Resolved successfully' })}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-500/20"
              >
                Resolve & Complete
              </button>
            </div>
          )}
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-5 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Queue Target</span>
            <span className="font-semibold text-slate-200">{contact.queue_name || 'Unassigned'}</span>
          </div>

          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Assigned Agent</span>
            <span className="font-semibold text-emerald-400 font-mono">
              {contact.assigned_agent_name || 'Queued / No Agent'}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Wait Time</span>
            <span className="font-semibold text-slate-200 font-mono">{contact.waiting_time_seconds}s</span>
          </div>

          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Call Duration</span>
            <span className="font-semibold text-slate-200 font-mono">
              {contact.duration_seconds > 0 ? `${contact.duration_seconds}s` : 'In Progress'}
            </span>
          </div>
        </div>

        {/* Routing Reason Audit Callout */}
        <div className="mt-5 p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 font-mono flex items-start gap-2">
          <Zap className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-slate-400 text-[10px] uppercase block font-sans font-bold">
              Routing Engine Decision
            </span>
            <span>{contact.routing_reason}</span>
          </div>
        </div>
      </div>

      {/* Interaction Timeline Stream */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden flex flex-col h-[500px]">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-brand-400" />
            <span>Interaction Timeline & Transcripts</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {contact.interactions?.length || 0} Events
          </span>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {contact.interactions?.map((item) => {
            const isCustomer = item.actor_type === 'customer';
            const isSystem = item.actor_type === 'system';

            if (isSystem) {
              return (
                <div key={item.id} className="flex justify-center my-2">
                  <div className="px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{item.message}</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={item.id}
                className={`flex gap-3 ${isCustomer ? 'justify-start' : 'justify-end'}`}
              >
                {isCustomer && (
                  <div className="w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-500/40 flex items-center justify-center text-blue-400 flex-shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed ${
                    isCustomer
                      ? 'bg-slate-900 border border-slate-800 text-slate-200'
                      : 'bg-brand-600/20 border border-brand-500/40 text-brand-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-75 font-mono">
                    <span className="font-semibold uppercase">{item.actor_type}</span>
                    <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p>{item.message}</p>
                </div>

                {!isCustomer && (
                  <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0">
                    <Headphones className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Message Input Bar */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center gap-3">
          <select
            value={actorType}
            onChange={(e) => setActorType(e.target.value as ActorType)}
            className="py-2 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs font-semibold text-white focus:outline-none"
          >
            <option value="agent">As Agent</option>
            <option value="customer">As Customer</option>
            <option value="system">As System</option>
          </select>

          <input
            type="text"
            placeholder="Type a simulated message or consultation transcript note..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />

          <button
            type="submit"
            disabled={addInteractionMutation.isPending || !newMessage.trim()}
            className="p-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-40 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
