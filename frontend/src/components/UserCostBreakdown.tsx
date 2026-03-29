"use client";

import type { UserStat } from "../lib/api";
import { fmt$, fmtK } from "../lib/format";

interface UserCostBreakdownProps {
  data: UserStat[];
  loading: boolean;
}

export function UserCostBreakdown({ data, loading }: UserCostBreakdownProps) {
  const maxCost = data.reduce((m, d) => Math.max(m, d.total_cost_usd), 0);

  if (!loading && data.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl overflow-hidden">
      <div className="p-6 border-b border-zinc-800/50">
        <h2 className="text-sm font-semibold text-zinc-300">Cost by User</h2>
        <p className="text-xs text-zinc-500 mt-0.5">AI spend breakdown per team member for the selected period</p>
      </div>
      <div className="p-6 space-y-3">
        {loading ? (
          Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-8 bg-zinc-800 animate-pulse rounded-lg" />
          ))
        ) : data.map(row => {
          const pct = maxCost > 0 ? (row.total_cost_usd / maxCost) * 100 : 0;
          return (
            <div key={row.user_id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-zinc-300">{row.display_name}</span>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span>{fmtK(row.total_tokens)} tokens</span>
                  <span className="text-zinc-300 font-medium">${fmt$(row.total_cost_usd)}</span>
                </div>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
