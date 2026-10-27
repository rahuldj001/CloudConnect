import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Cloud,
  ExternalLink,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../api/client';
import { ProviderHealth } from '../types';

export const Settings: React.FC = () => {
  const [testKey, setTestKey] = useState(`evt-test-${Math.random().toString(36).substring(7)}`);
  const [webhookResult, setWebhookResult] = useState<any>(null);

  // Fetch provider status
  const { data: providerHealth, isLoading, refetch } = useQuery<ProviderHealth>({
    queryKey: ['provider-status'],
    queryFn: () => api.getProviderStatus(),
  });

  // Test webhook idempotency mutation
  const webhookMutation = useMutation({
    mutationFn: () =>
      api.ingestEvent(testKey, 'SIMULATED_HEARTBEAT', {
        test: true,
        source: 'Frontend Settings Test Bench',
        timestamp: new Date().toISOString(),
      }),
    onSuccess: (data) => {
      setWebhookResult(data);
    },
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Cloud Integration & Architecture Settings</h1>
        <p className="text-xs text-slate-400 mt-1">
          Review Contact Center Provider status, AWS Amazon Connect adapter configuration, and webhook idempotency.
        </p>
      </div>

      {/* Provider Architecture Overview Card */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800">
        <div className="flex items-start justify-between pb-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Contact Center Provider Interface</h2>
              <p className="text-xs text-slate-400">
                Plug-and-play provider abstraction layer (<code className="font-mono text-brand-300">ContactCenterProvider</code> ABC)
              </p>
            </div>
          </div>

          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300"
            title="Check Status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Active Provider Card */}
          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-semibold text-slate-400">Active Provider</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ACTIVE
              </span>
            </div>

            <h3 className="text-base font-bold text-white font-mono">
              {isLoading ? 'Checking provider health...' : providerHealth?.provider_name}
            </h3>

            <p className="text-xs text-slate-400 leading-relaxed">
              {providerHealth?.details?.notes ||
                'Local deterministic simulator handles call/chat initiation without third-party telecom costs.'}
            </p>

            <div className="pt-3 border-t border-slate-800 text-xs font-mono text-slate-400 space-y-1">
              <div>
                <span>Simulated Mode: </span>
                <span className="text-cyan-400 font-bold">{providerHealth?.is_simulated ? 'YES (Sandbox)' : 'NO (Live)'}</span>
              </div>
              <div>
                <span>Connectivity: </span>
                <span className="text-emerald-400 font-bold">{providerHealth?.is_connected ? 'CONNECTED' : 'DISCONNECTED'}</span>
              </div>
            </div>
          </div>

          {/* Amazon Connect Cloud Adapter Details */}
          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase font-semibold text-slate-400">AWS Amazon Connect Adapter</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  OPTIONAL CLOUD EXTENSION
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                CloudConnect includes a production-ready <code className="text-brand-300 font-mono">AmazonConnectAdapter</code> implemented with AWS Boto3. It supports outbound call/chat dispatch, CTR streaming via EventBridge, and IAM least-privilege security.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>Setup Guide & Architecture:</span>
              <a
                href="#docs"
                className="text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1"
              >
                <span>docs/amazon-connect-setup.md</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Idempotent Webhook Verification Bench */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800">
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="text-base font-bold text-white">Event Ingestion & Idempotency Test Bench</h2>
            <p className="text-xs text-slate-400">
              Verify that duplicate provider webhooks (CTR events, retries) are safely ignored without duplicate records.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Webhook Idempotency Key (Unique String)
              </label>
              <input
                type="text"
                value={testKey}
                onChange={(e) => setTestKey(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTestKey(`evt-test-${Math.random().toString(36).substring(7)}`)}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold"
              >
                Regenerate Key
              </button>

              <button
                type="button"
                onClick={() => webhookMutation.mutate()}
                disabled={webhookMutation.isPending}
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow-md shadow-brand-500/20 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Dispatch Event</span>
              </button>
            </div>
          </div>

          {webhookResult && (
            <div
              className={`p-4 rounded-xl border text-xs font-mono ${
                webhookResult.status === 'PROCESSED'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
              }`}
            >
              <div className="flex items-center gap-2 font-bold mb-1">
                {webhookResult.status === 'PROCESSED' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                )}
                <span>Response: {webhookResult.status}</span>
              </div>
              <p className="mt-1">
                {webhookResult.status === 'PROCESSED'
                  ? 'First event ingestion succeeded. The idempotency key has been recorded in the database.'
                  : 'Idempotency verified! Duplicate event detected and safely acknowledged without mutating state.'}
              </p>
              <pre className="mt-2 p-2 rounded bg-slate-950/60 overflow-x-auto text-[11px]">
                {JSON.stringify(webhookResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Architecture Documentation Links */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800">
        <h3 className="text-sm font-semibold text-white tracking-wide mb-1 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-brand-400" />
          <span>Engineering Documentation Repository</span>
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Production architecture, database schemas, security posture, and AWS deployment guides.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <h4 className="font-semibold text-white mb-1">docs/architecture.md</h4>
            <p className="text-slate-400 text-[11px]">System components, data flow diagrams, and routing state machine.</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <h4 className="font-semibold text-white mb-1">docs/database.md</h4>
            <p className="text-slate-400 text-[11px]">ER diagram, foreign key constraints, indexes, and migrations.</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <h4 className="font-semibold text-white mb-1">docs/deployment.md</h4>
            <p className="text-slate-400 text-[11px]">Docker Compose, AWS ECS/Fargate, RDS, and cost estimation guide.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
