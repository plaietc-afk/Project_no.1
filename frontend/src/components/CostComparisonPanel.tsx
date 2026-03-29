"use client";

import { useState, useEffect, useCallback } from "react";
import { statsApi } from "../lib/api";
import type { CostComparisonResult, ModelClass } from "../lib/api";

const TOKEN_PRESETS = [
  { label: "100K", prompt: 75_000, completion: 25_000 },
  { label: "1M",   prompt: 750_000, completion: 250_000 },
  { label: "5M",   prompt: 3_750_000, completion: 1_250_000 },
  { label: "10M",  prompt: 7_500_000, completion: 2_500_000 },
];

function fmt$(n: number): string {
  if (n >= 100) return n.toFixed(2);
  if (n >= 1)   return n.toFixed(3);
  return n.toFixed(4);
}

export function CostComparisonPanel() {
  const [open, setOpen] = useState(false);
  const [classes, setClasses] = useState<ModelClass[]>([]);
  const [selectedClass, setSelectedClass] = useState("standard");
  const [promptTokens, setPromptTokens] = useState(750_000);
  const [completionTokens, setCompletionTokens] = useState(250_000);
  const [results, setResults] = useState<CostComparisonResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    statsApi.costComparisonClasses().then(r => setClasses(r.data)).catch(() => { /* non-critical */ });
  }, []);

  const runComparison = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await statsApi.costComparison(promptTokens, completionTokens, selectedClass);
      setResults(r.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load comparison");
    } finally {
      setLoading(false);
    }
  }, [promptTokens, completionTokens, selectedClass]);

  useEffect(() => {
    if (open) runComparison();
  }, [open, runComparison]);

  const cheapest = results[0]?.total_cost_usd ?? Infinity;

  return (
    <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full p-6 flex items-center justify-between text-left hover:bg-zinc-800/20 transition-colors"
      >
        <div>
          <h2 className="text-sm font-semibold text-zinc-300">Cost Comparison</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Compare provider costs for your token usage pattern</p>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          className={`text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-zinc-800/50">
          {/* Controls */}
          <div className="px-6 py-4 flex flex-wrap gap-4 items-end border-b border-zinc-800/30">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 uppercase tracking-wider">Model Class</label>
              <select
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
                className="text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {classes.map(c => <option key={c.class} value={c.class}>{c.display_name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 uppercase tracking-wider">Preset</label>
              <div className="flex gap-1">
                {TOKEN_PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => { setPromptTokens(p.prompt); setCompletionTokens(p.completion); }}
                    className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${promptTokens === p.prompt ? "bg-indigo-600 border-indigo-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 uppercase tracking-wider">Prompt tokens</label>
              <input
                type="number" min={0} value={promptTokens}
                onChange={e => setPromptTokens(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-32 text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 uppercase tracking-wider">Completion tokens</label>
              <input
                type="number" min={0} value={completionTokens}
                onChange={e => setCompletionTokens(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-32 text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={runComparison}
              disabled={loading}
              className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? "Loading…" : "Compare"}
            </button>
          </div>

          {/* Results */}
          {error && (
            <div className="px-6 py-3 text-sm text-red-400">{error}</div>
          )}
          {results.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/50 text-zinc-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-3 text-left font-medium">Provider</th>
                    <th className="px-6 py-3 text-left font-medium">Model</th>
                    <th className="px-6 py-3 text-right font-medium">Prompt</th>
                    <th className="px-6 py-3 text-right font-medium">Completion</th>
                    <th className="px-6 py-3 text-right font-medium">Total</th>
                    <th className="px-6 py-3 text-left font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {results.map((r, i) => {
                    const isCheapest = i === 0;
                    const savingsPct = cheapest > 0 && !isCheapest
                      ? Math.round(((r.total_cost_usd - cheapest) / r.total_cost_usd) * 100)
                      : 0;
                    return (
                      <tr key={`${r.provider}-${r.model}`} className={`hover:bg-zinc-800/20 transition-colors ${isCheapest ? "bg-emerald-900/10" : ""}`}>
                        <td className="px-6 py-3 capitalize text-zinc-300">{r.provider}</td>
                        <td className="px-6 py-3 text-zinc-500 text-xs font-mono">{r.model}</td>
                        <td className="px-6 py-3 text-right text-zinc-400 text-xs font-mono">${fmt$(r.prompt_cost_usd)}</td>
                        <td className="px-6 py-3 text-right text-zinc-400 text-xs font-mono">${fmt$(r.completion_cost_usd)}</td>
                        <td className={`px-6 py-3 text-right font-semibold font-mono text-sm ${isCheapest ? "text-emerald-400" : "text-zinc-300"}`}>
                          ${fmt$(r.total_cost_usd)}
                        </td>
                        <td className="px-6 py-3">
                          {isCheapest ? (
                            <span className="text-xs text-emerald-500 bg-emerald-900/30 border border-emerald-700/30 px-2 py-0.5 rounded-full">cheapest</span>
                          ) : savingsPct > 0 ? (
                            <span className="text-xs text-zinc-500">+{savingsPct}% more</span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
