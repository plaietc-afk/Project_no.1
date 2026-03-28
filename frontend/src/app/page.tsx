"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  keysApi, statsApi,
  type ApiKey, type OverviewStats, type ProviderStat, type DailyStat, type HeatmapData, type CreateKeyPayload
} from "../lib/api";
import { authApi, type AuthUser } from "../lib/auth";

const PROVIDERS = ["openai", "anthropic", "gemini", "groq", "azure", "cohere", "mistral", "bedrock"];

// ---- Utility helpers ----
function fmt$(n: number) { return n.toFixed(n < 0.01 ? 4 : 2); }
function fmtK(n: number) { return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n); }

// ---- Sub-components ----

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl p-5">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-semibold text-white">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}

function BarChart({ data }: { data: DailyStat[] }) {
  if (!data.length) return <div className="h-32 flex items-center justify-center text-zinc-600 text-sm">No data</div>;
  const max = Math.max(...data.map(d => d.total_cost_usd), 0.001);
  return (
    <div className="flex items-end gap-[2px] h-28 w-full">
      {data.map(d => (
        <div key={d.date} className="flex-1 group relative">
          <div
            className="bg-indigo-500/70 hover:bg-indigo-400 rounded-t transition-all"
            style={{ height: `${Math.max(2, (d.total_cost_usd / max) * 100)}%` }}
          />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-zinc-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
            {d.date}: ${fmt$(d.total_cost_usd)}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProviderPie({ data }: { data: ProviderStat[] }) {
  if (!data.length) return <div className="h-32 flex items-center justify-center text-zinc-600 text-sm">No data</div>;
  const total = data.reduce((s, d) => s + d.total_cost_usd, 0);
  if (total === 0) return <div className="h-32 flex items-center justify-center text-zinc-600 text-sm">No spend yet</div>;

  const colors = ["#6366f1","#22d3ee","#f59e0b","#10b981","#f43f5e","#a78bfa","#34d399","#fb923c"];
  return (
    <div className="flex flex-col gap-2">
      {data.map((d, i) => {
        const pct = total > 0 ? (d.total_cost_usd / total) * 100 : 0;
        return (
          <div key={d.provider} className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: colors[i % colors.length] }} />
            <span className="text-sm text-zinc-300 capitalize flex-1">{d.provider}</span>
            <span className="text-xs text-zinc-400">${fmt$(d.total_cost_usd)}</span>
            <div className="w-24 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
            </div>
            <span className="text-xs text-zinc-500 w-8 text-right">{pct.toFixed(0)}%</span>
          </div>
        );
      })}
    </div>
  );
}

const INTENSITY_COLORS = [
  "bg-zinc-800",       // 0 — no activity
  "bg-indigo-900/60",  // 1 — low
  "bg-indigo-600/60",  // 2 — medium
  "bg-indigo-500",     // 3 — high
  "bg-indigo-400"      // 4 — peak
];

function ActivityHeatmap({ data }: { data: HeatmapData }) {
  const { days, year } = data;
  const WEEKS = 53;
  const firstDay = new Date(`${year}-01-01`).getDay(); // 0=Sun

  // Pad front with nulls to align first day to its weekday column
  const grid: (typeof days[0] | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...days
  ];

  // Slice into columns of 7
  const cols: (typeof days[0] | null)[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    cols.push(grid.slice(w * 7, w * 7 + 7));
  }

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = -1;
  cols.forEach((col, w) => {
    const firstReal = col.find(c => c !== null);
    if (firstReal) {
      const m = new Date(firstReal.date).getMonth();
      if (m !== lastMonth) { monthLabels.push({ label: months[m], col: w }); lastMonth = m; }
    }
  });

  return (
    <div className="overflow-x-auto">
      <div className="inline-block">
        <div className="flex gap-[3px] mb-1">
          {monthLabels.map(({ label, col }) => (
            <div key={label} className="text-xs text-zinc-500" style={{ marginLeft: col === 0 ? 0 : undefined, width: 10 * 3 }}>
              {label}
            </div>
          ))}
        </div>
        <div className="flex gap-[3px]">
          {cols.map((col, w) => (
            <div key={w} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }, (_, d) => {
                const cell = col[d] ?? null;
                return (
                  <div
                    key={d}
                    title={cell ? `${cell.date}: ${fmtK(cell.total_tokens)} tokens` : ''}
                    className={`w-[10px] h-[10px] rounded-sm ${cell ? INTENSITY_COLORS[cell.intensity] : 'bg-transparent'}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 mt-2 justify-end">
          <span className="text-xs text-zinc-500 mr-1">Less</span>
          {INTENSITY_COLORS.map((c, i) => (
            <div key={i} className={`w-[10px] h-[10px] rounded-sm ${c} border border-zinc-700/30`} />
          ))}
          <span className="text-xs text-zinc-500 ml-1">More</span>
        </div>
      </div>
    </div>
  );
}

// ---- New Key Modal ----
function NewKeyModal({ onClose, onCreate }: { onClose: () => void; onCreate: (key: ApiKey) => void }) {
  const [form, setForm] = useState<CreateKeyPayload>({
    key_name: "", provider: "openai", budget: 0, project_id: "",
    webhook_url: "", alert_thresholds: [80, 95], rpm_limit: 0, tpm_limit: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const set = (field: keyof CreateKeyPayload) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = e.target.value;
    setForm(prev => ({ ...prev, [field]: field === 'budget' || field === 'rpm_limit' || field === 'tpm_limit' ? Number(v) : v }));
  };

  const handleSubmit = async () => {
    setLoading(true); setError(null);
    try {
      const payload: CreateKeyPayload = {
        ...form,
        project_id: form.project_id || undefined,
        webhook_url: form.webhook_url || undefined
      };
      const res = await keysApi.create(payload);
      setCreatedKey(res.data.api_key ?? null);
      onCreate(res.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create key');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm placeholder:text-zinc-600";
  const labelCls = "block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider";

  if (createdKey) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-md">
          <h3 className="text-lg font-semibold text-white mb-2">Key Created</h3>
          <p className="text-zinc-400 text-sm mb-4">Save this key — it will <span className="text-amber-400 font-medium">never be shown again</span>.</p>
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 font-mono text-sm text-emerald-400 break-all select-all">{createdKey}</div>
          <button onClick={onClose} className="mt-4 w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-sm transition-colors">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-white">Create API Key</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">&times;</button>
        </div>
        {error && <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-400 text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className={labelCls}>Key Name</label><input className={inputCls} value={form.key_name} onChange={set('key_name')} placeholder="Production API" /></div>
          <div className="col-span-2"><label className={labelCls}>Provider</label>
            <select className={inputCls} value={form.provider} onChange={set('provider')}>
              {PROVIDERS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>Project ID</label><input className={inputCls} value={form.project_id} onChange={set('project_id')} placeholder="proj_xyz" /></div>
          <div><label className={labelCls}>Budget ($)</label><input type="number" className={inputCls} value={form.budget ?? ''} onChange={set('budget')} placeholder="50.00" /></div>
          <div className="col-span-2"><label className={labelCls}>Webhook URL</label><input type="url" className={inputCls} value={form.webhook_url} onChange={set('webhook_url')} placeholder="https://hooks.slack.com/..." /></div>
          <div><label className={labelCls}>RPM Limit</label><input type="number" className={inputCls} value={form.rpm_limit ?? ''} onChange={set('rpm_limit')} placeholder="100" /></div>
          <div><label className={labelCls}>TPM Limit</label><input type="number" className={inputCls} value={form.tpm_limit ?? ''} onChange={set('tpm_limit')} placeholder="100000" /></div>
        </div>
        <button onClick={handleSubmit} disabled={loading || !form.key_name} className="mt-6 w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors">
          {loading ? 'Creating...' : 'Create Key'}
        </button>
      </div>
    </div>
  );
}

// ---- Package Quota Bar ----
function QuotaBar({ label, used, total, unit }: { label: string; used: number; total: number; unit: string }) {
  const unlimited = total === 0;
  const pct = unlimited ? 0 : Math.min(100, (used / total) * 100);
  const color = pct >= 95 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-indigo-500";
  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-zinc-400">{label}</span>
        <span className="text-xs text-zinc-500">
          {unlimited ? "Unlimited" : `${fmtK(used)} / ${fmtK(total)} ${unit}`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

// ---- Main Dashboard ----
export default function Dashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [providerStats, setProviderStats] = useState<ProviderStat[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewKey, setShowNewKey] = useState(false);
  const [filterProvider, setFilterProvider] = useState("All");
  const [days, setDays] = useState(30);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, keysRes, overviewRes, provRes, dailyRes, heatRes] = await Promise.allSettled([
        authApi.me(),
        keysApi.list(1, 100),
        statsApi.overview(days),
        statsApi.byProvider(days),
        statsApi.daily(days),
        statsApi.heatmap()
      ]);
      if (meRes.status === 'fulfilled') setCurrentUser(meRes.value.data);
      if (keysRes.status === 'fulfilled') setKeys(keysRes.value.data);
      if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value.data);
      if (provRes.status === 'fulfilled') setProviderStats(provRes.value.data);
      if (dailyRes.status === 'fulfilled') setDailyStats(dailyRes.value.data);
      if (heatRes.status === 'fulfilled') setHeatmap(heatRes.value.data);
    } finally {
      setLoading(false);
    }
  }, [days]);

  const handleLogout = async () => {
    await authApi.logout().catch(() => {});
    router.push("/login");
  };

  useEffect(() => { refresh(); }, [refresh]);

  const handleRevoke = async (id: number) => {
    await keysApi.revoke(id);
    setKeys(prev => prev.map(k => k.id === id ? { ...k, is_active: false } : k));
  };

  const filteredKeys = filterProvider === "All" ? keys : keys.filter(k => k.provider.toLowerCase() === filterProvider.toLowerCase());
  const allProviders = ["All", ...Array.from(new Set(keys.map(k => k.provider)))];

  const statusLabel = (k: ApiKey) => {
    if (!k.is_active) return { label: "Revoked", cls: "bg-zinc-700 text-zinc-300" };
    const spend = 0; // could compute from key stats if available
    if (k.budget > 0 && spend >= k.budget) return { label: "Over Budget", cls: "bg-red-900/50 text-red-400" };
    return { label: "Active", cls: "bg-emerald-900/50 text-emerald-400" };
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-indigo-500/30">
      {/* Nav */}
      <nav className="border-b border-zinc-800 bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-white tracking-tight">TokenGuard</span>
            {currentUser && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                currentUser.package?.name === 'enterprise' ? 'bg-amber-900/40 text-amber-400' :
                currentUser.package?.name === 'pro' ? 'bg-indigo-900/40 text-indigo-400' :
                'bg-zinc-800 text-zinc-400'
              }`}>
                {currentUser.package?.display_name ?? 'Free'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
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
              className="text-sm px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
            >
              + New Key
            </button>
            {currentUser && (
              <div className="flex items-center gap-2">
                <a href="/profile" className="text-sm text-zinc-400 hover:text-white transition-colors hidden md:block">
                  {currentUser.full_name ?? currentUser.email}
                </a>
                <button
                  onClick={handleLogout}
                  className="text-xs px-3 py-1.5 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white rounded-lg transition-colors"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Cost" value={`$${fmt$(overview?.total_cost_usd ?? 0)}`} sub={`Last ${days} days`} />
          <StatCard label="Cost Saved" value={`$${fmt$(overview?.total_cost_saved_usd ?? 0)}`} sub="From cache" />
          <StatCard label="Total Tokens" value={fmtK(overview?.total_tokens ?? 0)} sub={`${fmtK(overview?.total_requests ?? 0)} requests`} />
          <StatCard label="Active Keys" value={String(keys.filter(k => k.is_active).length)} sub={`of ${keys.length} total`} />
        </div>

        {/* Package Quota */}
        {currentUser?.package && (
          <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-300">
                {currentUser.package.display_name} Plan Usage
              </h2>
              <span className="text-xs text-zinc-500">
                Resets monthly
              </span>
            </div>
            <div className="flex gap-6 flex-wrap">
              <QuotaBar
                label="Tokens"
                used={currentUser.usage.tokens_used}
                total={currentUser.package.token_quota}
                unit="tokens"
              />
              <QuotaBar
                label="Budget"
                used={currentUser.usage.usd_spent}
                total={currentUser.package.usd_budget}
                unit="USD"
              />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs text-zinc-400">Rate Limit</span>
                  <span className="text-xs text-zinc-500">{currentUser.package.rpm_limit} RPM</span>
                </div>
                {currentUser.package.allowed_models.length > 0 && (
                  <p className="text-xs text-zinc-600 mt-0.5">
                    Models: {currentUser.package.allowed_models.join(', ')}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800/50 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-zinc-300 mb-4">Daily Cost (USD)</h2>
            {loading ? <div className="h-28 bg-zinc-800 animate-pulse rounded" /> : <BarChart data={dailyStats} />}
            <div className="flex justify-between mt-2 text-xs text-zinc-600">
              <span>{dailyStats[0]?.date}</span>
              <span>{dailyStats[dailyStats.length - 1]?.date}</span>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-zinc-300 mb-4">Cost by Provider</h2>
            {loading ? <div className="h-28 bg-zinc-800 animate-pulse rounded" /> : <ProviderPie data={providerStats} />}
          </div>
        </div>

        {/* Activity Heatmap */}
        <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">
            Token Activity — {heatmap?.year ?? new Date().getFullYear()}
          </h2>
          {loading ? (
            <div className="h-20 bg-zinc-800 animate-pulse rounded" />
          ) : heatmap ? (
            <ActivityHeatmap data={heatmap} />
          ) : (
            <p className="text-zinc-600 text-sm">No data</p>
          )}
        </div>

        {/* Keys Table */}
        <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-zinc-800/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">API Keys</h2>
              <p className="text-sm text-zinc-400 mt-1">Manage access and configure budgets, alerts, and rate limits.</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={filterProvider}
                onChange={e => setFilterProvider(e.target.value)}
                className="text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-3 py-1.5 focus:outline-none"
              >
                {allProviders.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/50 text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-3 text-left font-medium">Name</th>
                  <th className="px-6 py-3 text-left font-medium">Key</th>
                  <th className="px-6 py-3 text-left font-medium">Provider</th>
                  <th className="px-6 py-3 text-left font-medium">Budget</th>
                  <th className="px-6 py-3 text-left font-medium">Limits</th>
                  <th className="px-6 py-3 text-left font-medium">Status</th>
                  <th className="px-6 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {loading ? (
                  Array.from({ length: 3 }, (_, i) => (
                    <tr key={i}><td colSpan={7} className="px-6 py-4"><div className="h-4 bg-zinc-800 animate-pulse rounded" /></td></tr>
                  ))
                ) : filteredKeys.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-zinc-500">No keys yet. Create one to get started.</td></tr>
                ) : filteredKeys.map(k => {
                  const { label, cls } = statusLabel(k);
                  return (
                    <tr key={k.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{k.key_name}</div>
                        {k.project_id && <div className="text-xs text-zinc-500 mt-0.5">{k.project_id}</div>}
                      </td>
                      <td className="px-6 py-4 font-mono text-zinc-400 text-xs">{k.key_prefix}</td>
                      <td className="px-6 py-4 capitalize text-zinc-300">{k.provider}</td>
                      <td className="px-6 py-4 text-zinc-300">{k.budget > 0 ? `$${fmt$(k.budget)}` : "—"}</td>
                      <td className="px-6 py-4 text-zinc-500 text-xs">
                        {k.rpm_limit > 0 ? `${k.rpm_limit} RPM` : ""}
                        {k.rpm_limit > 0 && k.tpm_limit > 0 ? " / " : ""}
                        {k.tpm_limit > 0 ? `${fmtK(k.tpm_limit)} TPM` : ""}
                        {!k.rpm_limit && !k.tpm_limit ? "—" : ""}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}>{label}</span>
                      </td>
                      <td className="px-6 py-4">
                        {k.is_active && (
                          <button
                            onClick={() => handleRevoke(k.id)}
                            className="text-xs text-red-500 hover:text-red-400 transition-colors"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showNewKey && (
        <NewKeyModal
          onClose={() => { setShowNewKey(false); refresh(); }}
          onCreate={newKey => setKeys(prev => [newKey, ...prev])}
        />
      )}
    </div>
  );
}
