import type { ProviderStat } from "../lib/api";

function fmt$(n: number) { return n.toFixed(n < 0.01 ? 4 : 2); }

const COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e", "#a78bfa", "#34d399", "#fb923c"];

function DonutChart({ data, total }: { data: ProviderStat[]; total: number }) {
  const R = 36;
  const STROKE = 10;
  const C = 2 * Math.PI * R;

  // Pre-compute cumulative offsets so we never mutate inside map
  const offsets = data.reduce<number[]>((acc, d) => {
    const prev = acc[acc.length - 1] ?? 0;
    return [...acc, prev + (total > 0 ? d.total_cost_usd / total : 0)];
  }, []);

  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
      <circle cx="50" cy="50" r={R} fill="none" stroke="#27272a" strokeWidth={STROKE} />
      {data.map((d, i) => {
        const pct = total > 0 ? d.total_cost_usd / total : 0;
        const dash = pct * C;
        const gap = C - dash;
        const offsetPct = i === 0 ? 0 : offsets[i - 1];
        return (
          <circle
            key={d.provider}
            cx="50" cy="50" r={R}
            fill="none"
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={STROKE}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offsetPct * C}
            strokeLinecap="butt"
          />
        );
      })}
    </svg>
  );
}

export function ProviderPie({ data }: { data: ProviderStat[] }) {
  if (!data.length) {
    return (
      <div className="h-32 flex flex-col items-center justify-center text-zinc-600 text-sm gap-2">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-zinc-700">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity=".4" />
          <path d="M12 3 A9 9 0 0 1 21 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span>No spend yet</span>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.total_cost_usd, 0);
  if (total === 0) {
    return <div className="h-32 flex items-center justify-center text-zinc-600 text-sm">No spend yet</div>;
  }

  return (
    <div className="flex items-center gap-5">
      <div className="relative flex-shrink-0">
        <DonutChart data={data} total={total} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] text-zinc-400 font-medium">${fmt$(total)}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 min-w-0">
        {data.map((d, i) => {
          const pct = total > 0 ? (d.total_cost_usd / total) * 100 : 0;
          return (
            <div key={d.provider} className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="text-zinc-300 capitalize truncate flex-1">{d.provider}</span>
              <span className="text-zinc-500 tabular-nums">{pct.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
