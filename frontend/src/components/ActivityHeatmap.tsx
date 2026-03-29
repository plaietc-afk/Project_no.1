import type { HeatmapData } from "../lib/api";
import { fmtK } from "../lib/format";

const INTENSITY_COLORS = [
  "bg-zinc-800",
  "bg-indigo-900/60",
  "bg-indigo-600/60",
  "bg-indigo-500",
  "bg-indigo-400"
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ActivityHeatmap({ data }: { data: HeatmapData }) {
  const { days, year } = data;
  const WEEKS = 53;
  const firstDay = new Date(`${year}-01-01`).getDay();

  const grid: (typeof days[0] | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...days
  ];

  const cols: (typeof days[0] | null)[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    cols.push(grid.slice(w * 7, w * 7 + 7));
  }

  // Build month labels — one label per month, positioned at the week where it first appears
  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = -1;
  cols.forEach((col, w) => {
    const firstReal = col.find(c => c !== null);
    if (firstReal) {
      const m = new Date(firstReal.date).getMonth();
      if (m !== lastMonth) {
        monthLabels.push({ label: MONTHS[m], col: w });
        lastMonth = m;
      }
    }
  });

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-3">
        {/* Weekday labels */}
        <div className="flex flex-col pt-5 gap-[3px]">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={`h-[10px] text-[9px] text-zinc-600 leading-[10px] ${i % 2 === 0 ? "opacity-0" : ""}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="inline-block">
          {/* Month labels */}
          <div className="flex gap-[3px] mb-1 h-4 relative">
            {monthLabels.map(({ label, col }) => (
              <div
                key={label}
                className="absolute text-[10px] text-zinc-500 leading-none"
                style={{ left: col * (10 + 3) }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div className="flex gap-[3px]">
            {cols.map((col, w) => (
              <div key={w} className="flex flex-col gap-[3px]">
                {Array.from({ length: 7 }, (_, d) => {
                  const cell = col[d] ?? null;
                  return (
                    <div
                      key={d}
                      title={cell ? `${cell.date}: ${fmtK(cell.total_tokens)} tokens, ${cell.total_requests} requests` : ""}
                      className={`w-[10px] h-[10px] rounded-sm ${cell ? INTENSITY_COLORS[cell.intensity] : "bg-transparent"}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1 mt-2 justify-end">
            <span className="text-[10px] text-zinc-600 mr-1">Less</span>
            {INTENSITY_COLORS.map((c, i) => (
              <div key={i} className={`w-[10px] h-[10px] rounded-sm ${c} border border-zinc-700/30`} />
            ))}
            <span className="text-[10px] text-zinc-600 ml-1">More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
