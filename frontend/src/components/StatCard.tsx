interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: string; // tailwind color class for icon bg
}

export function StatCard({ label, value, sub, icon, accent = "bg-indigo-500/10" }: StatCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl p-5 flex items-start gap-4">
      <div className={`${accent} rounded-xl p-2.5 flex-shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-semibold text-white leading-none">{value}</p>
        {sub && <p className="text-xs text-zinc-500 mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}
