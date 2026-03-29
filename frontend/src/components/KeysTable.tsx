"use client";

import { useState, Fragment } from "react";
import type { ApiKey } from "../lib/api";
import { keysApi } from "../lib/api";
import { ConfirmDialog } from "./ConfirmDialog";
import type { ToastType } from "./Toast";
import { fmt$, fmtK } from "../lib/format";

const PROVIDERS = ["openai", "anthropic", "gemini", "groq", "azure", "cohere", "mistral", "bedrock"];

interface KeysTableProps {
  keys: ApiKey[];
  loading: boolean;
  onRevoke: (id: number) => Promise<void>;
  onToast: (msg: string, type?: ToastType) => void;
  onRotated: () => void;
}

function statusLabel(k: ApiKey) {
  if (!k.is_active) return { label: "Revoked", cls: "bg-zinc-700/50 text-zinc-400 border-zinc-600/30" };
  if (k.budget > 0) return { label: "Budgeted", cls: "bg-blue-900/40 text-blue-400 border-blue-600/20" };
  return { label: "Active", cls: "bg-emerald-900/40 text-emerald-400 border-emerald-600/20" };
}

interface RotatedKeyBannerProps {
  keyValue: string;
  onDismiss: () => void;
}

function RotatedKeyBanner({ keyValue, onDismiss }: RotatedKeyBannerProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(keyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <tr>
      <td colSpan={7} className="px-6 py-4">
        <div className="bg-amber-900/20 border border-amber-600/30 rounded-xl p-4">
          <p className="text-xs text-amber-400 font-medium mb-2">New key — copy it now, it will not be shown again</p>
          <div className="flex items-center gap-3">
            <code className="flex-1 font-mono text-xs text-emerald-400 bg-zinc-900 border border-zinc-800 rounded-lg p-2 break-all select-all">{keyValue}</code>
            <button
              onClick={copy}
              className="flex-shrink-0 px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <button onClick={onDismiss} className="text-zinc-600 hover:text-zinc-400">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

export function KeysTable({ keys, loading, onRevoke, onToast, onRotated }: KeysTableProps) {
  const [filterProvider, setFilterProvider] = useState("All");
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [rotatedKeys, setRotatedKeys] = useState<Record<number, string>>({});
  const [rotating, setRotating] = useState<number | null>(null);
  const [testingWebhook, setTestingWebhook] = useState<number | null>(null);

  const allProviders = ["All", ...Array.from(new Set(keys.map(k => k.provider)))].filter(
    p => p === "All" || PROVIDERS.includes(p)
  );

  const filteredKeys = filterProvider === "All"
    ? keys
    : keys.filter(k => k.provider.toLowerCase() === filterProvider.toLowerCase());

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await onRevoke(revokeTarget.id);
      onToast(`Key "${revokeTarget.key_name}" revoked`, "success");
    } catch {
      onToast("Failed to revoke key", "error");
    } finally {
      setRevokeTarget(null);
    }
  };

  const handleRotate = async (k: ApiKey) => {
    setRotating(k.id);
    try {
      const res = await keysApi.rotate(k.id);
      setRotatedKeys(prev => ({ ...prev, [k.id]: res.api_key }));
      onRotated();
      onToast(`Key "${k.key_name}" rotated`, "success");
    } catch {
      onToast("Failed to rotate key", "error");
    } finally {
      setRotating(null);
    }
  };

  const handleTestWebhook = async (k: ApiKey) => {
    if (!k.webhook_url) return;

    // Client-side SSRF guard: only allow HTTPS URLs to public-looking hosts
    try {
      const url = new URL(k.webhook_url);
      if (url.protocol !== "https:") {
        onToast("Webhook URL must use HTTPS", "error");
        return;
      }
      // Block loopback / link-local / private ranges at the client layer
      const hostname = url.hostname.toLowerCase();
      const isPrivate =
        hostname === "localhost" ||
        hostname.startsWith("127.") ||
        hostname.startsWith("10.") ||
        hostname.startsWith("192.168.") ||
        hostname === "::1" ||
        hostname.startsWith("169.254.");
      if (isPrivate) {
        onToast("Webhook URL must not target a private/loopback address", "error");
        return;
      }
    } catch {
      onToast("Webhook URL is not a valid URL", "error");
      return;
    }

    setTestingWebhook(k.id);
    try {
      await keysApi.testWebhook(k.webhook_url);
      onToast("Webhook test sent successfully", "success");
    } catch {
      onToast("Webhook test failed", "error");
    } finally {
      setTestingWebhook(null);
    }
  };

  return (
    <>
      <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">API Keys</h2>
            <p className="text-sm text-zinc-400 mt-1">Manage access and configure budgets, alerts, and rate limits.</p>
          </div>
          {allProviders.length > 1 && (
            <select
              value={filterProvider}
              onChange={e => setFilterProvider(e.target.value)}
              className="text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {allProviders.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
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
                  <tr key={i}>
                    <td colSpan={7} className="px-6 py-4">
                      <div className="h-4 bg-zinc-800 animate-pulse rounded" />
                    </td>
                  </tr>
                ))
              ) : filteredKeys.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-zinc-600">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <div>
                        <p className="text-zinc-400 font-medium">No API keys yet</p>
                        <p className="text-sm mt-0.5">Create a key to start routing AI requests through TokenGuard</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredKeys.map(k => {
                const { label, cls } = statusLabel(k);
                const rotatedKey = rotatedKeys[k.id];

                return (
                  <Fragment key={k.id}>
                    {rotatedKey && (
                      <RotatedKeyBanner
                        keyValue={rotatedKey}
                        onDismiss={() => setRotatedKeys(prev => { const next = { ...prev }; delete next[k.id]; return next; })}
                      />
                    )}
                    <tr className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{k.key_name}</div>
                        {k.project_id && <div className="text-xs text-zinc-500 mt-0.5">{k.project_id}</div>}
                      </td>
                      <td className="px-6 py-4 font-mono text-zinc-400 text-xs">{k.key_prefix}…</td>
                      <td className="px-6 py-4 capitalize text-zinc-300">{k.provider}</td>
                      <td className="px-6 py-4 text-zinc-300">{k.budget > 0 ? `$${fmt$(k.budget)}` : "—"}</td>
                      <td className="px-6 py-4 text-zinc-500 text-xs">
                        {[
                          k.rpm_limit > 0 ? `${k.rpm_limit} RPM` : "",
                          k.tpm_limit > 0 ? `${fmtK(k.tpm_limit)} TPM` : ""
                        ].filter(Boolean).join(" / ") || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${cls}`}>{label}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {k.is_active && (
                            <>
                              <button
                                onClick={() => handleRotate(k)}
                                disabled={rotating === k.id}
                                className="text-xs text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
                                title="Rotate key"
                              >
                                {rotating === k.id ? "..." : "Rotate"}
                              </button>
                              {k.webhook_url && (
                                <button
                                  onClick={() => handleTestWebhook(k)}
                                  disabled={testingWebhook === k.id}
                                  className="text-xs text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
                                  title="Test webhook"
                                >
                                  {testingWebhook === k.id ? "..." : "Test"}
                                </button>
                              )}
                              <button
                                onClick={() => setRevokeTarget(k)}
                                className="text-xs text-red-500 hover:text-red-400 transition-colors"
                              >
                                Revoke
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {revokeTarget && (
        <ConfirmDialog
          title="Revoke API Key"
          message={`Are you sure you want to revoke "${revokeTarget.key_name}"? This action cannot be undone and will immediately block all requests using this key.`}
          confirmLabel="Revoke Key"
          danger
          onConfirm={handleRevoke}
          onCancel={() => setRevokeTarget(null)}
        />
      )}
    </>
  );
}
