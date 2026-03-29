"use client";

import { useState, useEffect, useCallback } from "react";
import { statsApi } from "../lib/api";
import type { ApiKey, RequestLog, PageMeta, DailyStat, ProviderStat } from "../lib/api";
import { BarChart } from "./BarChart";
import { ProviderPie } from "./ProviderPie";
import { LogsTable } from "./LogsTable";

interface KeyDrillDownProps {
  apiKey: ApiKey | null;
  onClose: () => void;
}

interface DrillDownData {
  dailyStats: DailyStat[];
  providerStats: ProviderStat[];
  logs: RequestLog[];
  meta: PageMeta;
}

const EMPTY_META: PageMeta = { total: 0, page: 1, limit: 50, pages: 1 };

export function KeyDrillDown({ apiKey, onClose }: KeyDrillDownProps) {
  const [data, setData] = useState<DrillDownData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchData = useCallback(
    async (keyId: number, currentPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const [logsRes, dailyRes, providerRes] = await Promise.allSettled([
          statsApi.logs(currentPage, 50, keyId),
          statsApi.daily(30),
          statsApi.byProvider(30),
        ]);

        const logs = logsRes.status === "fulfilled" ? logsRes.value.data : [];
        const meta = logsRes.status === "fulfilled" ? logsRes.value.meta : EMPTY_META;
        const dailyStats = dailyRes.status === "fulfilled" ? dailyRes.value.data : [];
        const providerStats = providerRes.status === "fulfilled" ? providerRes.value.data : [];

        const allFailed =
          logsRes.status === "rejected" &&
          dailyRes.status === "rejected" &&
          providerRes.status === "rejected";

        if (allFailed) {
          setError("Failed to load key details. Check that the backend is running.");
          return;
        }

        setData({ logs, meta, dailyStats, providerStats });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load key details");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!apiKey) return;
    setData(null);
    fetchData(apiKey.id, 1);
  }, [apiKey, fetchData]);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (!apiKey) return;
      fetchData(apiKey.id, nextPage);
    },
    [apiKey, fetchData]
  );

  if (!apiKey) return null;

  return (
    <div
      data-testid="drilldown-backdrop"
      className="fixed inset-0 bg-black/70 z-50 flex justify-end"
      onClick={onClose}
    >
      {/* Side panel */}
      <div
        className="relative bg-zinc-950 border-l border-zinc-800 w-full max-w-2xl h-full overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-base font-semibold text-white">{apiKey.key_name}</h2>
            <p className="text-xs text-zinc-500 mt-0.5 capitalize">{apiKey.provider} · {apiKey.key_prefix}…</p>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 space-y-6">
          {error && (
            <div className="bg-red-900/20 border border-red-700/30 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Daily Cost Chart */}
          <section>
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">Daily Cost (USD)</h3>
            {loading && !data ? (
              <div className="h-28 bg-zinc-800 animate-pulse rounded-lg" />
            ) : (
              <BarChart data={data?.dailyStats ?? []} />
            )}
          </section>

          {/* Provider Breakdown */}
          <section>
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">Cost by Provider</h3>
            {loading && !data ? (
              <div className="h-24 bg-zinc-800 animate-pulse rounded-lg" />
            ) : (
              <ProviderPie data={data?.providerStats ?? []} />
            )}
          </section>

          {/* Recent Requests */}
          <section>
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">Recent Requests</h3>
            <LogsTable
              logs={data?.logs ?? []}
              meta={data?.meta ?? EMPTY_META}
              loading={loading && !data}
              onPageChange={handlePageChange}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
