"use client";

import type { RequestLog, PageMeta } from "../lib/api";
import { fmt$, fmtK } from "../lib/format";

interface LogsTableProps {
  logs: RequestLog[];
  meta: PageMeta;
  loading: boolean;
  onPageChange: (page: number) => void;
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ts;
  }
}

export function LogsTable({ logs, meta, loading, onPageChange }: LogsTableProps) {
  const showPagination = meta.pages > 1;

  return (
    <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800/50 text-zinc-500 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left font-medium">Timestamp</th>
              <th className="px-4 py-3 text-left font-medium">Key</th>
              <th className="px-4 py-3 text-left font-medium">Provider</th>
              <th className="px-4 py-3 text-left font-medium">Model</th>
              <th className="px-4 py-3 text-right font-medium">Tokens</th>
              <th className="px-4 py-3 text-right font-medium">Cost</th>
              <th className="px-4 py-3 text-right font-medium">Latency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {loading ? (
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="px-4 py-3">
                    <div className="h-4 bg-zinc-800 animate-pulse rounded" />
                  </td>
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <p className="text-zinc-500 text-sm">No requests found</p>
                </td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="hover:bg-zinc-800/20 transition-colors">
                  <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap font-mono">
                    {formatTimestamp(log.timestamp)}
                  </td>
                  <td className="px-4 py-3 text-zinc-300 max-w-[120px] truncate">
                    {log.key_name}
                  </td>
                  <td className="px-4 py-3 text-zinc-300 capitalize">
                    {log.provider}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 font-mono text-xs">
                    {log.model}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-300 tabular-nums">
                    {fmtK(log.total_tokens)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-300 tabular-nums">
                    ${fmt$(log.cost_usd)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-400 tabular-nums text-xs">
                    {log.latency_ms}ms
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showPagination && (
        <div className="px-4 py-3 border-t border-zinc-800/50 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            Page {meta.page} of {meta.pages}
          </span>
          <div className="flex items-center gap-2">
            <button
              aria-label="Previous page"
              onClick={() => onPageChange(meta.page - 1)}
              disabled={meta.page <= 1}
              className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              aria-label="Next page"
              onClick={() => onPageChange(meta.page + 1)}
              disabled={meta.page >= meta.pages}
              className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
