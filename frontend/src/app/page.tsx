"use client";

import { useState } from "react";

// Mock Data upgraded for Final Phase 3
const MOCK_KEYS = [
  { id: 1, name: "Prod Key", provider: "OpenAI", prefix: "sk-...", created: "2026-03-20", status: "Active", budget: 100, cost: 45.50, project_id: "proj_prod", webhook_url: "https://hooks.slack.com/...", alert_thresholds: "[80, 95]", rpm_limit: 100, tpm_limit: 100000 },
  { id: 2, name: "Dev Key", provider: "Gemini", prefix: "AIza...", created: "2026-03-25", status: "Revoked", budget: 10, cost: 12.00, project_id: "proj_dev", webhook_url: null, alert_thresholds: "[90]", rpm_limit: 0, tpm_limit: 50000 },
  { id: 3, name: "Data Pipeline", provider: "Anthropic", prefix: "sk-ant...", created: "2026-03-26", status: "Over Budget", budget: 50, cost: 55.20, project_id: "proj_data", webhook_url: "https://hooks.slack.com/...", alert_thresholds: "[80]", rpm_limit: 50, tpm_limit: 80000 },
  { id: 4, name: "Testing Groq", provider: "Groq", prefix: "gsk_...", created: "2026-03-27", status: "Active", budget: 20, cost: 1.50, project_id: "proj_test", webhook_url: null, alert_thresholds: "[]", rpm_limit: 1000, tpm_limit: 1000000 },
];

const MOCK_GLOBAL_STATS = {
  total_cost_saved_usd: 15.42,
};

const MOCK_STATS = {
  OpenAI: { tokens: [12000, 15000, 18000, 22000, 9000, 24000, 31000], cost: [24.0, 30.0, 36.0, 44.0, 18.0, 48.0, 62.0] },
  Gemini: { tokens: [8000, 9000, 11000, 14000, 16000, 20000, 23000], cost: [16.0, 18.0, 22.0, 28.0, 32.0, 40.0, 46.0] },
  Anthropic: { tokens: [5000, 7000, 8000, 10000, 12000, 15000, 18000], cost: [15.0, 21.0, 24.0, 30.0, 36.0, 45.0, 54.0] }
};

const PROVIDERS = ["OpenAI", "Gemini", "Anthropic", "Groq"];

export default function Dashboard() {
  const [keys, setKeys] = useState(MOCK_KEYS);
  // Form State
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyProvider, setNewKeyProvider] = useState("OpenAI");
  const [newKeyBudget, setNewKeyBudget] = useState("");
  const [newKeyProject, setNewKeyProject] = useState("");
  const [newKeyWebhookUrl, setNewKeyWebhookUrl] = useState("");
  const [newKeyAlertThreshold, setNewKeyAlertThreshold] = useState("");
  const [newKeyRpmLimit, setNewKeyRpmLimit] = useState("");
  const [newKeyTpmLimit, setNewKeyTpmLimit] = useState("");

  // UI State
  const [filterProvider, setFilterProvider] = useState("All");
  const [viewMode, setViewMode] = useState<"tokens" | "cost">("cost");

  const handleCreateKey = () => {
    if (!newKeyName) return;
    const newKey = {
      id: Date.now(),
      name: newKeyName,
      provider: newKeyProvider,
      prefix: newKeyProvider === "OpenAI" ? "sk-..." : newKeyProvider === "Gemini" ? "AIza..." : newKeyProvider === "Anthropic" ? "sk-ant..." : "gsk_...",
      created: new Date().toISOString().split("T")[0],
      status: "Active",
      budget: parseFloat(newKeyBudget) || 0,
      cost: 0,
      project_id: newKeyProject || "default",
      webhook_url: newKeyWebhookUrl || null,
      alert_thresholds: newKeyAlertThreshold ? `[${newKeyAlertThreshold}]` : "[]",
      rpm_limit: parseInt(newKeyRpmLimit) || 0,
      tpm_limit: parseInt(newKeyTpmLimit) || 0
    };
    setKeys([...keys, newKey]);
    // Reset form
    setNewKeyName("");
    setNewKeyBudget("");
    setNewKeyProject("");
    setNewKeyWebhookUrl("");
    setNewKeyAlertThreshold("");
    setNewKeyRpmLimit("");
    setNewKeyTpmLimit("");
  };

  const totalCost = keys.reduce((acc, key) => acc + key.cost, 0);
  const activeKeys = keys.filter(k => k.status === "Active").length;
  
  const getMaxValue = () => { /* ... (no change) ... */ return 1; };
  const chartMax = getMaxValue();

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-indigo-500/30">
      <nav className="border-b border-zinc-800 bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-50">{/* ... (no change) ... */}</nav>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{/* ... (stats cards, no change) ... */}</div>
        <section className="bg-zinc-900 border border-zinc-800/50 rounded-2xl shadow-sm p-6">{/* ... (analytics chart, no change) ... */}</section>

        <section className="bg-zinc-900 border border-zinc-800/50 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-zinc-800/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">API Keys</h2>
              <p className="text-sm text-zinc-400 mt-1">Manage access and configure budgets, caching, alerts, and rate limits.</p>
            </div>
          </div>

          <div className="p-6 bg-zinc-950/50 border-b border-zinc-800/50">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-x-4 gap-y-6">
              {/* Row 1 */}
              <div className="lg:col-span-1">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Key Name</label>
                <input type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="e.g. Production API" className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm placeholder:text-zinc-600"/>
              </div>
              <div className="lg:col-span-1">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Project ID</label>
                <input type="text" value={newKeyProject} onChange={(e) => setNewKeyProject(e.target.value)} placeholder="proj_xyz" className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm placeholder:text-zinc-600"/>
              </div>
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Provider</label>
                <select value={newKeyProvider} onChange={(e) => setNewKeyProvider(e.target.value)} className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm">
                  {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* Row 2 */}
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Webhook URL (for Alerts)</label>
                <input type="url" value={newKeyWebhookUrl} onChange={(e) => setNewKeyWebhookUrl(e.target.value)} placeholder="https://hooks.slack.com/..." className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm placeholder:text-zinc-600"/>
              </div>
              <div className="lg:col-span-1">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Budget ($)</label>
                <input type="number" value={newKeyBudget} onChange={(e) => setNewKeyBudget(e.target.value)} placeholder="50.00" className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm placeholder:text-zinc-600"/>
              </div>
              <div className="lg:col-span-1">
                 <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Alert At (%)</label>
                <input type="number" value={newKeyAlertThreshold} onChange={(e) => setNewKeyAlertThreshold(e.target.value)} placeholder="80" className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm placeholder:text-zinc-600"/>
              </div>

              {/* Row 3 */}
              <div className="lg:col-span-1">
                 <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">RPM Limit</label>
                <input type="number" value={newKeyRpmLimit} onChange={(e) => setNewKeyRpmLimit(e.target.value)} placeholder="100" className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm placeholder:text-zinc-600"/>
              </div>
              <div className="lg:col-span-1">
                 <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">TPM Limit</label>
                <input type="number" value={newKeyTpmLimit} onChange={(e) => setNewKeyTpmLimit(e.target.value)} placeholder="100000" className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm placeholder:text-zinc-600"/>
              </div>
              <div className="lg:col-span-2 self-end">
                <button onClick={handleCreateKey} className="w-full h-[40px] py-2 bg-indigo-600 text-white hover:bg-indigo-500 border border-indigo-500 transition-colors rounded-lg font-medium text-sm shadow-lg shadow-indigo-500/20">
                  Create API Key
                </button>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">{/* ... table ... */}</div>
        </section>
      </div>
    </div>
  );
}
