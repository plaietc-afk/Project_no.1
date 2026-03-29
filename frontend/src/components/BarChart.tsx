import type { DailyStat } from "../lib/api";
import { fmt$ } from "../lib/format";

export function BarChart({ data }: { data: DailyStat[] }) {
  if (!data.length) {
    return (
      <div className="h-36 flex flex-col items-center justify-center text-zinc-600 text-sm gap-2">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-zinc-700">
          <rect x="3" y="12" width="4" height="9" rx="1" fill="currentColor" opacity=".4" />
          <rect x="10" y="7" width="4" height="14" rx="1" fill="currentColor" opacity=".6" />
          <rect x="17" y="3" width="4" height="18" rx="1" fill="currentColor" opacity=".3" />
        </svg>
        <span>No data for this period</span>
      </div>
    );
  }

  const max = Math.max(...data.map(d => d.total_cost_usd), 0.001);
  const yLabels = [max, max * 0.5, 0];

  return (
    <div className="flex gap-3">
      {/* Y-axis */}
      <div className="flex flex-col justify-between h-28 text-right pr-1 pb-0" style={{ minWidth: 38 }}>
        {yLabels.map((v, i) => (
          <span key={i} className="text-[10px] text-zinc-600 leading-none">${fmt$(v)}</span>
        ))}
      </div>

      {/* Bars */}
      <div className="flex items-end gap-[2px] h-28 w-full">
        {data.map(d => (
          <div key={d.date} className="flex-1 group relative">
            <div
              className="bg-indigo-500/60 hover:bg-indigo-400 rounded-t transition-all"
              style={{ height: `${Math.max(2, (d.total_cost_usd / max) * 100)}%` }}
            />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap z-10 shadow-xl">
              <span className="font-medium">${fmt$(d.total_cost_usd)}</span>
              <span className="text-zinc-400">{d.date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
