"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { authApi, type AuthUser } from "../../lib/auth";

function fmt$(n: number) { return n.toFixed(n < 0.01 ? 4 : 2); }
function fmtK(n: number) { return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n); }

function QuotaBar({ label, used, total, format }: { label: string; used: number; total: number; format: "tokens" | "usd" }) {
  const unlimited = total === 0;
  const pct = unlimited ? 0 : Math.min(100, (used / total) * 100);
  const color = pct >= 95 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-indigo-500";
  const usedStr = format === "usd" ? `$${fmt$(used)}` : fmtK(used);
  const totalStr = format === "usd" ? `$${fmt$(total)}` : fmtK(total);
  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-sm text-zinc-300">{label}</span>
        <span className="text-sm text-zinc-400">
          {unlimited ? "Unlimited" : `${usedStr} / ${totalStr}`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {!unlimited && (
        <p className="text-xs text-zinc-600 mt-1">{pct.toFixed(1)}% used</p>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    authApi.me().then(r => setUser(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { setPwError("Passwords do not match"); return; }
    setPwLoading(true); setPwError(null); setPwSuccess(false);
    try {
      await authApi.changePassword(pwForm.current, pwForm.next);
      setPwSuccess(true);
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : "Failed");
    } finally { setPwLoading(false); }
  };

  const inputCls = "w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm placeholder:text-zinc-600";

  if (loading) return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <div className="text-zinc-500 text-sm">Loading...</div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <div className="text-zinc-500 text-sm">Not signed in</div>
    </div>
  );

  const pkg = user.package;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <nav className="border-b border-zinc-800 bg-[#09090b]/80 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-zinc-500 hover:text-white text-sm transition-colors">← Dashboard</Link>
          </div>
          <span className="font-semibold text-white tracking-tight">Profile</span>
          <div className="w-24" />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Account info */}
        <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">Account</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-zinc-500 mb-1">Name</p><p className="text-white">{user.full_name ?? "—"}</p></div>
            <div><p className="text-zinc-500 mb-1">Email</p><p className="text-white">{user.email}</p></div>
            <div><p className="text-zinc-500 mb-1">Role</p>
              <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${user.role === 'admin' ? 'bg-amber-900/40 text-amber-400' : 'bg-zinc-800 text-zinc-400'}`}>
                {user.role}
              </span>
            </div>
            <div><p className="text-zinc-500 mb-1">Member since</p><p className="text-white">{user.created_at.slice(0, 10)}</p></div>
          </div>
        </div>

        {/* Package */}
        {pkg && (
          <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl p-6">
            <div className="flex justify-between items-start mb-5">
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Package</h2>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                pkg.name === 'enterprise' ? 'bg-amber-900/40 text-amber-400' :
                pkg.name === 'pro' ? 'bg-indigo-900/40 text-indigo-400' :
                'bg-zinc-800 text-zinc-400'
              }`}>{pkg.display_name}</span>
            </div>
            <div className="space-y-5">
              <QuotaBar label="Token Usage" used={user.usage.tokens_used} total={pkg.token_quota} format="tokens" />
              <QuotaBar label="Spend" used={user.usage.usd_spent} total={pkg.usd_budget} format="usd" />
              <div className="flex gap-6 text-sm">
                <div><p className="text-zinc-500 mb-1">Rate Limit</p><p className="text-white">{pkg.rpm_limit} req/min</p></div>
                <div>
                  <p className="text-zinc-500 mb-1">Model Access</p>
                  <p className="text-white">{pkg.allowed_models.length === 0 ? "All models" : pkg.allowed_models.join(", ")}</p>
                </div>
                {user.usage.usage_reset_at && (
                  <div><p className="text-zinc-500 mb-1">Resets on</p><p className="text-white">{user.usage.usage_reset_at.slice(0, 10)}</p></div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Change Password */}
        <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">Change Password</h2>
          {pwError && <div className="mb-3 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-400 text-sm">{pwError}</div>}
          {pwSuccess && <div className="mb-3 p-3 bg-emerald-900/30 border border-emerald-700/50 rounded-lg text-emerald-400 text-sm">Password updated successfully.</div>}
          <form onSubmit={handlePasswordChange} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Current password</label>
              <input type="password" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">New password</label>
              <input type="password" minLength={8} value={pwForm.next} onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Confirm new password</label>
              <input type="password" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} className={inputCls} />
            </div>
            <div className="md:col-span-3">
              <button type="submit" disabled={pwLoading} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                {pwLoading ? "Saving..." : "Update Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
