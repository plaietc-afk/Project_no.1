"use client";

import { useState } from "react";
import { keysApi, type ApiKey, type CreateKeyPayload } from "../lib/api";

const PROVIDERS = ["openai", "anthropic", "gemini", "groq", "azure", "cohere", "mistral", "bedrock"];

const inputCls = "w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm placeholder:text-zinc-600";
const labelCls = "block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider";

interface NewKeyModalProps {
  onClose: () => void;
  onCreate: (key: ApiKey) => void;
}

function KeyCreatedView({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Key Created</h3>
            <p className="text-xs text-zinc-400">Copy it now — it will never be shown again</p>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-700/50 rounded-xl p-4 mb-4">
          <p className="font-mono text-sm text-emerald-400 break-all select-all leading-relaxed">{apiKey}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={copy}
            className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {copied ? "Copied!" : "Copy Key"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function NewKeyModal({ onClose, onCreate }: NewKeyModalProps) {
  const [form, setForm] = useState<CreateKeyPayload>({
    key_name: "", provider: "openai", budget: 0, project_id: "",
    webhook_url: "", alert_thresholds: [80, 95], rpm_limit: 0, tpm_limit: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const set = (field: keyof CreateKeyPayload) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = e.target.value;
    setForm(prev => ({
      ...prev,
      [field]: field === "budget" || field === "rpm_limit" || field === "tpm_limit" ? Number(v) : v
    }));
  };

  const handleSubmit = async () => {
    if (!form.key_name.trim()) return;
    setLoading(true);
    setError(null);
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
      setError(e instanceof Error ? e.message : "Failed to create key");
    } finally {
      setLoading(false);
    }
  };

  if (createdKey) {
    return <KeyCreatedView apiKey={createdKey} onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Create API Key</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Configure routing, limits, and budget alerts</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-700/40 rounded-xl text-red-400 text-sm flex items-start gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><circle cx="12" cy="16" r=".5" fill="currentColor" />
            </svg>
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className={labelCls}>Key Name <span className="text-red-500">*</span></label>
            <input
              className={inputCls}
              value={form.key_name}
              onChange={set("key_name")}
              placeholder="Production API"
              autoFocus
            />
          </div>

          <div>
            <label className={labelCls}>Provider</label>
            <select className={inputCls} value={form.provider} onChange={set("provider")}>
              {PROVIDERS.map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Project ID</label>
              <input className={inputCls} value={form.project_id} onChange={set("project_id")} placeholder="proj_xyz" />
            </div>
            <div>
              <label className={labelCls}>Budget ($)</label>
              <input type="number" min="0" step="0.01" className={inputCls} value={form.budget || ""} onChange={set("budget")} placeholder="50.00" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Webhook URL <span className="text-zinc-600 normal-case text-xs font-normal ml-1">for budget alerts</span></label>
            <input type="url" className={inputCls} value={form.webhook_url} onChange={set("webhook_url")} placeholder="https://hooks.slack.com/..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>RPM Limit</label>
              <input type="number" min="0" className={inputCls} value={form.rpm_limit || ""} onChange={set("rpm_limit")} placeholder="0 = unlimited" />
            </div>
            <div>
              <label className={labelCls}>TPM Limit</label>
              <input type="number" min="0" className={inputCls} value={form.tpm_limit || ""} onChange={set("tpm_limit")} placeholder="0 = unlimited" />
            </div>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !form.key_name.trim()}
          className="mt-6 w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
              </svg>
              Creating...
            </>
          ) : "Create Key"}
        </button>
      </div>
    </div>
  );
}
