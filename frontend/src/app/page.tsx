"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useDashboard } from "../hooks/useDashboard";
import { useRequestLogs } from "../hooks/useRequestLogs";
import { StatCard } from "../components/StatCard";
import { BarChart } from "../components/BarChart";
import { ProviderPie } from "../components/ProviderPie";
import { ActivityHeatmap } from "../components/ActivityHeatmap";
import { NewKeyModal } from "../components/NewKeyModal";
import { KeysTable } from "../components/KeysTable";
import { LogsTable } from "../components/LogsTable";
import { KeyDrillDown } from "../components/KeyDrillDown";
import { useToast, ToastContainer } from "../components/Toast";
import { fmt$, fmtK } from "../lib/format";
import type { ApiKey } from "../lib/api";

// ---- Icons ----
const IconCost = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
    <circle cx="12" cy="12" r="10" /><path d="M12 6v2m0 8v2m-3-6h6m-4.5-2a1.5 1.5 0 0 1 3 0c0 1.5-3 2.5-3 4h3" />
  </svg>
);
const IconSaved = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
    <path d="M12 22V12m0 10-4-4m4 4 4-4" /><path d="M20 12V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6" />
  </svg>
);
const IconTokens = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400">
    <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8m-4-4v4" />
  </svg>
);
const IconKeys = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);
const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
);

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const [showNewKey, setShowNewKey] = useState(false);
  const [drillDownKey, setDrillDownKey] = useState<ApiKey | null>(null);
  const { keys, overview, providerStats, dailyStats, heatmap, loading, error, refresh, revokeKey, addKey } = useDashboard(days);
  const { logs, meta: logsMeta, loading: logsLoading, setPage: setLogsPage } = useRequestLogs();
  const { toasts, push: pushToast, dismiss: dismissToast } = useToast();

  const handleKeySelect = useCallback((key: ApiKey) => {
    setDrillDownKey(key);
  }, []);

  const activeKeys = keys.filter(k => k.is_active).length;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-indigo-500/30">
      {/* Nav */}
      <nav className="border-b border-zinc-800 bg-[#09090b]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Image src="/logo.png" alt="TokenGuard" height={28} width={120} className="h-7 w-auto" />

          <div className="flex items-center gap-2">
            <button
              onClick={() => refresh()}
              className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
              title="Refresh data (R)"
            >
              <IconRefresh />
            </button>
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="text-sm bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              onClick={() => setShowNewKey(true)}
              className="text-sm px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors flex items-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              New Key
            </button>
          </div>
        </div>
      </nav>

      {error && (
        <div className="bg-red-900/20 border-b border-red-700/30 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-3 text-sm text-red-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><circle cx="12" cy="16" r=".5" fill="currentColor" />
            </svg>
            <span className="flex-1">{error}</span>
            <button onClick={() => refresh()} className="underline hover:no-underline">Retry</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Cost"
            value={`$${fmt$(overview?.total_cost_usd ?? 0)}`}
            sub={`Last ${days} days`}
            icon={<IconCost />}
            accent="bg-indigo-500/10"
          />
          <StatCard
            label="Cost Saved"
            value={`$${fmt$(overview?.total_cost_saved_usd ?? 0)}`}
            sub="From cache hits"
            icon={<IconSaved />}
            accent="bg-emerald-500/10"
          />
          <StatCard
            label="Total Tokens"
            value={fmtK(overview?.total_tokens ?? 0)}
            sub={`${fmtK(overview?.total_requests ?? 0)} requests`}
            icon={<IconTokens />}
            accent="bg-cyan-500/10"
          />
          <StatCard
            label="Active Keys"
            value={String(activeKeys)}
            sub={`of ${keys.length} total`}
            icon={<IconKeys />}
            accent="bg-amber-500/10"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800/50 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-zinc-300 mb-4">Daily Cost (USD)</h2>
            {loading
              ? <div className="h-28 bg-zinc-800 animate-pulse rounded-lg" />
              : <BarChart data={dailyStats} />
            }
            {!loading && dailyStats.length > 0 && (
              <div className="flex justify-between mt-2 text-[10px] text-zinc-600">
                <span>{dailyStats[0]?.date}</span>
                <span>{dailyStats[dailyStats.length - 1]?.date}</span>
              </div>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-zinc-300 mb-4">Cost by Provider</h2>
            {loading
              ? <div className="h-28 bg-zinc-800 animate-pulse rounded-lg" />
              : <ProviderPie data={providerStats} />
            }
          </div>
        </div>

        {/* Activity Heatmap */}
        <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">
            Token Activity — {heatmap?.year ?? new Date().getFullYear()}
          </h2>
          {loading
            ? <div className="h-20 bg-zinc-800 animate-pulse rounded-lg" />
            : heatmap
              ? <ActivityHeatmap data={heatmap} />
              : <p className="text-zinc-600 text-sm">No activity data</p>
          }
        </div>

        {/* Keys Table */}
        <KeysTable
          keys={keys}
          loading={loading}
          onRevoke={revokeKey}
          onToast={pushToast}
          onRotated={() => refresh()}
          onKeySelect={handleKeySelect}
        />

        {/* Request Log Table */}
        <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-zinc-800/50">
            <h2 className="text-xl font-semibold text-white">Request Log</h2>
            <p className="text-sm text-zinc-400 mt-1">Recent requests proxied through TokenGuard.</p>
          </div>
          <LogsTable
            logs={logs}
            meta={logsMeta}
            loading={logsLoading}
            onPageChange={setLogsPage}
          />
        </div>
      </div>

      {showNewKey && (
        <NewKeyModal
          onClose={() => { setShowNewKey(false); refresh(); }}
          onCreate={key => { addKey(key); pushToast(`Key "${key.key_name}" created`, "success"); }}
        />
      )}

      <ToastContainer toasts={toasts} dismiss={dismissToast} />

      <KeyDrillDown apiKey={drillDownKey} onClose={() => setDrillDownKey(null)} />
    </div>
  );
}
