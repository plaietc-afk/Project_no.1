"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authApi } from "../../lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.register(form.email, form.password, form.full_name || undefined);
      setApiKey(res.data.api_key ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm placeholder:text-zinc-600";

  if (apiKey) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-emerald-400 text-xl">✓</span>
            </div>
            <h2 className="text-lg font-semibold text-white mb-1">Account Created</h2>
            <p className="text-zinc-400 text-sm mb-4">
              Save your API key — it will <span className="text-amber-400 font-medium">never be shown again</span>.
              Use it as the <code className="text-xs bg-zinc-800 px-1 py-0.5 rounded">Authorization: Bearer</code> header when calling the proxy.
            </p>
            <div className="bg-zinc-950 border border-zinc-700 rounded-lg p-3 font-mono text-xs text-emerald-400 break-all select-all text-left mb-4">
              {apiKey}
            </div>
            <button
              onClick={() => router.push("/")}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-sm transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="TokenGuard" height={40} width={160} className="h-10 w-auto mx-auto" />
          <p className="text-zinc-500 text-sm mt-1">Create your account</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Name</label>
              <input type="text" value={form.full_name} onChange={set("full_name")} placeholder="Your name" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Email</label>
              <input type="email" required value={form.email} onChange={set("email")} placeholder="you@example.com" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Password</label>
              <input type="password" required minLength={8} value={form.password} onChange={set("password")} placeholder="Min 8 characters" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Confirm Password</label>
              <input type="password" required value={form.confirm} onChange={set("confirm")} placeholder="••••••••" className={inputCls} />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors mt-2"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
          <p className="text-center text-sm text-zinc-500 mt-4">
            Already have an account?{" "}
            <a href="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">Sign in</a>
          </p>
        </div>
        <p className="text-center text-xs text-zinc-600 mt-4">
          Unlimited AI access · Usage tracked per account
        </p>
      </div>
    </div>
  );
}
