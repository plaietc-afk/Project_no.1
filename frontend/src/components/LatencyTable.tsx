"use client";

import type { LatencyStat } from "../lib/api";
import { fmtK } from "../lib/format";

interface LatencyTableProps {
  data: LatencyStat[];
  loading: boolean;
}

function latencyColor(ms: number): string {
  if (ms >= 1000) return "text-red-400";
  if (ms >= 500) return "text-amber-400";
  return "text-emerald-400";
}

function LatencyBar({ ms, max }: { ms: number; max: number }) {
  const pct = max > 0 ? Math.min((ms / max) * 100, 100) : 0;
  const color = ms >= 1000 ? "bg-red-500" : ms >= 500 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-mono w-14 text-right ${latencyColor(ms)}`}>{ms}ms</span>
      <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function LatencyTable({ data, loading }: LatencyTableProps) {
  const maxP95 = data.reduce((m, d) => Math.max(m, d.p95_ms), 0);

  return (
    <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl overflow-hidden">
      <div className="p-6 border-b border-zinc-800/50">
        <h2 className="text-sm font-semibold text-zinc-300">Response Latency by Provider</h2>
        <p className="text-xs text-zinc-500 mt-0.5">P50 / P95 over the selected period. Green &lt;500ms · Amber 500–1000ms · Red &gt;1000ms</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800/50 text-zinc-500 text-xs uppercase tracking-wider">
              <th className="px-6 py-3 text-left font-medium">Provider</th>
              <th className="px-6 py-3 text-left font-medium">P50</th>
              <th className="px-6 py-3 text-left font-medium">P95</th>
              <th className="px-6 py-3 text-left font-medium w-20">Avg</th>
              <th className="px-6 py-3 text-left font-medium">Requests</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {loading ? (
              Array.from({ length: 3 }, (_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-6 py-3">
                    <div className="h-4 bg-zinc-800 animate-pulse rounded" />
                  </td>
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-zinc-600 text-sm">
                  No latency data yet — make some proxy requests to see results
                </td>
              </tr>
            ) : data.map(row => (
              <tr key={row.provider} className="hover:bg-zinc-800/20 transition-colors">
                <td className="px-6 py-3 capitalize text-zinc-300 font-medium">{row.provider}</td>
                <td className="px-6 py-3 min-w-[140px]">
                  <LatencyBar ms={row.p50_ms} max={maxP95} />
                </td>
                <td className="px-6 py-3 min-w-[140px]">
                  <LatencyBar ms={row.p95_ms} max={maxP95} />
                </td>
                <td className={`px-6 py-3 text-xs font-mono ${latencyColor(row.avg_ms)}`}>{row.avg_ms}ms</td>
                <td className="px-6 py-3 text-zinc-500 text-xs">{fmtK(row.request_count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
