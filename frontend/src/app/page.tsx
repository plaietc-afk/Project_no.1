"use client";

import { useState } from "react";

// Mock Data upgraded for Phase 2
const MOCK_KEYS = [
  { id: 1, name: "Prod Key", provider: "OpenAI", prefix: "sk-...", created: "2026-03-20", status: "Active", budget: 100, cost: 45.50, project_id: "proj_prod" },
  { id: 2, name: "Dev Key", provider: "Gemini", prefix: "AIza...", created: "2026-03-25", status: "Revoked", budget: 10, cost: 12.00, project_id: "proj_dev" },
  { id: 3, name: "Data Pipeline", provider: "Anthropic", prefix: "sk-ant...", created: "2026-03-26", status: "Over Budget", budget: 50, cost: 55.20, project_id: "proj_data" },
  { id: 4, name: "Testing Groq", provider: "Groq", prefix: "gsk_...", created: "2026-03-27", status: "Active", budget: 20, cost: 1.50, project_id: "proj_test" },
];

const MOCK_STATS = {
  OpenAI: {
    tokens: [12000, 15000, 18000, 22000, 9000, 24000, 31000],
    cost: [24.0, 30.0, 36.0, 44.0, 18.0, 48.0, 62.0],
  },
  Gemini: {
    tokens: [8000, 9000, 11000, 14000, 16000, 20000, 23000],
    cost: [16.0, 18.0, 22.0, 28.0, 32.0, 40.0, 46.0],
  },
  Anthropic: {
    tokens: [5000, 7000, 8000, 10000, 12000, 15000, 18000],
    cost: [15.0, 21.0, 24.0, 30.0, 36.0, 45.0, 54.0],
  }
};

const PROVIDERS = ["OpenAI", "Gemini", "Anthropic", "Groq"];

export default function Dashboard() {
  const [keys, setKeys] = useState(MOCK_KEYS);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyProvider, setNewKeyProvider] = useState("OpenAI");
  const [newKeyBudget, setNewKeyBudget] = useState("");
  const [newKeyProject, setNewKeyProject] = useState("");
  
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
      project_id: newKeyProject || "default"
    };
    setKeys([...keys, newKey]);
    setNewKeyName("");
    setNewKeyBudget("");
    setNewKeyProject("");
  };

  // Calculate totals
  const totalCost = keys.reduce((acc, key) => acc + key.cost, 0);
  const totalBudget = keys.reduce((acc, key) => acc + key.budget, 0);
  const activeKeys = keys.filter(k => k.status === "Active").length;
  
  // Chart max value calculation for scaling
  const getMaxValue = () => {
    let max = 0;
    for (let i = 0; i < 7; i++) {
      let dailySum = 0;
      Object.keys(MOCK_STATS).forEach(provider => {
        if (filterProvider === "All" || filterProvider === provider) {
          // @ts-ignore
          dailySum += MOCK_STATS[provider][viewMode][i];
        }
      });
      if (dailySum > max) max = dailySum;
    }
    return max || 1;
  };
  const chartMax = getMaxValue();

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-indigo-500/30">
      {/* Top Navigation */}
      <nav className="border-b border-zinc-800 bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              T
            </div>
            <span className="text-xl font-bold tracking-tight text-white">TokenGuard</span>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium text-zinc-400">
            <a href="#" className="text-zinc-100">Dashboard</a>
            <a href="#" className="hover:text-zinc-100 transition-colors">Projects</a>
            <a href="#" className="hover:text-zinc-100 transition-colors">Settings</a>
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 ml-4"></div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* Header & Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800/50 shadow-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <h3 className="text-sm font-medium text-zinc-400 mb-1">Total Spend</h3>
            <div className="text-3xl font-bold text-white">${totalCost.toFixed(2)}</div>
            <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
              <span>+12.5% from last month</span>
            </div>
          </div>
          <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800/50 shadow-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <h3 className="text-sm font-medium text-zinc-400 mb-1">Total Budget</h3>
            <div className="text-3xl font-bold text-white">${totalBudget.toFixed(2)}</div>
            <div className="mt-2 text-xs text-zinc-500">
              {((totalCost/totalBudget)*100).toFixed(1)}% utilized
            </div>
          </div>
          <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800/50 shadow-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <h3 className="text-sm font-medium text-zinc-400 mb-1">Active API Keys</h3>
            <div className="text-3xl font-bold text-white">{activeKeys}</div>
            <div className="mt-2 text-xs text-zinc-500">Across {keys.length} total keys</div>
          </div>
          <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800/50 shadow-sm relative overflow-hidden group">
             <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <h3 className="text-sm font-medium text-zinc-400 mb-1">Blocked Requests</h3>
            <div className="text-3xl font-bold text-white">142</div>
            <div className="mt-2 text-xs text-zinc-500">Rate limited or over budget</div>
          </div>
        </div>

        {/* Analytics Section */}
        <section className="bg-zinc-900 border border-zinc-800/50 rounded-2xl shadow-sm p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Usage Analytics</h2>
              <p className="text-sm text-zinc-400 mt-1">Monitor your proxy usage across all providers</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                <button 
                  onClick={() => setViewMode("cost")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === "cost" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
                >
                  Cost ($)
                </button>
                <button 
                  onClick={() => setViewMode("tokens")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === "tokens" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
                >
                  Tokens
                </button>
              </div>
              <select
                value={filterProvider}
                onChange={(e) => setFilterProvider(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="All">All Providers</option>
                {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          
          {/* Chart Area */}
          <div className="h-72 flex items-end gap-2 sm:gap-4 relative pt-6">
            {/* Y-axis guidelines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[4,3,2,1,0].map(i => (
                <div key={i} className="w-full border-b border-zinc-800/50 flex items-center h-0">
                  <span className="text-[10px] text-zinc-600 -translate-y-3 bg-zinc-900 pr-2">
                    {viewMode === "cost" ? "$" : ""}{((chartMax / 4) * i).toFixed(viewMode === "cost" ? 0 : 0)}
                  </span>
                </div>
              ))}
            </div>

            {[0, 1, 2, 3, 4, 5, 6].map((day) => (
              <div key={day} className="flex-1 flex flex-col justify-end gap-[2px] relative z-10 group">
                {/* Tooltip on hover */}
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-xl border border-zinc-700">
                  Day {day + 1}
                </div>
                
                {(filterProvider === "All" || filterProvider === "Anthropic") && (
                  <div 
                    className="w-full bg-gradient-to-t from-purple-600 to-purple-400 rounded-t-sm transition-all duration-500 hover:brightness-110" 
                    // @ts-ignore
                    style={{ height: `${((MOCK_STATS.Anthropic?.[viewMode]?.[day] || 0) / chartMax) * 100}%` }}
                  ></div>
                )}
                {(filterProvider === "All" || filterProvider === "Gemini") && (
                  <div 
                    className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm transition-all duration-500 hover:brightness-110" 
                    // @ts-ignore
                    style={{ height: `${((MOCK_STATS.Gemini?.[viewMode]?.[day] || 0) / chartMax) * 100}%` }}
                  ></div>
                )}
                {(filterProvider === "All" || filterProvider === "OpenAI") && (
                  <div 
                    className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-sm transition-all duration-500 hover:brightness-110" 
                    // @ts-ignore
                    style={{ height: `${((MOCK_STATS.OpenAI?.[viewMode]?.[day] || 0) / chartMax) * 100}%` }}
                  ></div>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-6 mt-8 text-sm">
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span><span className="text-zinc-400">OpenAI</span></div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span><span className="text-zinc-400">Gemini</span></div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-purple-500 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.5)]"></span><span className="text-zinc-400">Anthropic</span></div>
          </div>
        </section>

        {/* API Keys Management */}
        <section className="bg-zinc-900 border border-zinc-800/50 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-zinc-800/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">API Keys</h2>
              <p className="text-sm text-zinc-400 mt-1">Manage access and configure budgets per project.</p>
            </div>
            <button className="px-4 py-2 bg-white text-black hover:bg-zinc-200 transition-colors rounded-lg font-medium text-sm flex items-center gap-2 shadow-lg shadow-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Create New Key
            </button>
          </div>

          {/* Create Form inline (for demo) */}
          <div className="p-6 bg-zinc-950/50 border-b border-zinc-800/50">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Key Name</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g. Production API"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm placeholder:text-zinc-600"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Project ID</label>
                <input
                  type="text"
                  value={newKeyProject}
                  onChange={(e) => setNewKeyProject(e.target.value)}
                  placeholder="proj_xyz"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm placeholder:text-zinc-600"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Provider</label>
                <select
                  value={newKeyProvider}
                  onChange={(e) => setNewKeyProvider(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                >
                  {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Budget ($)</label>
                <input
                  type="number"
                  value={newKeyBudget}
                  onChange={(e) => setNewKeyBudget(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm placeholder:text-zinc-600"
                />
              </div>
              <div className="md:col-span-1">
                <button
                  onClick={handleCreateKey}
                  className="w-full py-2 bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700 transition-colors rounded-lg font-medium text-sm"
                >
                  Add Key
                </button>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-900 border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                  <th className="px-6 py-4 font-medium">Key Details</th>
                  <th className="px-6 py-4 font-medium">Provider & Prefix</th>
                  <th className="px-6 py-4 font-medium">Usage / Budget</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-sm">
                {keys.map((key) => {
                  const usagePercent = key.budget > 0 ? (key.cost / key.budget) * 100 : 0;
                  const isOverBudget = usagePercent >= 100;
                  const isWarning = usagePercent >= 80 && usagePercent < 100;

                  return (
                    <tr key={key.id} className="hover:bg-zinc-800/20 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{key.name}</div>
                        <div className="text-xs text-zinc-500 mt-1 font-mono">{key.project_id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider rounded border ${
                            key.provider === 'OpenAI' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                            key.provider === 'Gemini' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                            key.provider === 'Anthropic' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                            'bg-orange-500/10 text-orange-400 border-orange-500/20'
                          }`}>
                            {key.provider}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-1.5 font-mono">{key.prefix}</div>
                      </td>
                      <td className="px-6 py-4 w-64">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-zinc-300">${key.cost.toFixed(2)}</span>
                          <span className="text-zinc-500">{key.budget > 0 ? `$${key.budget.toFixed(2)}` : 'No Limit'}</span>
                        </div>
                        {key.budget > 0 && (
                          <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${isOverBudget ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-indigo-500'}`} 
                              style={{ width: `${Math.min(usagePercent, 100)}%` }}
                            ></div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                          key.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                          key.status === 'Revoked' ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 
                          'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            key.status === 'Active' ? 'bg-emerald-400' : 
                            key.status === 'Revoked' ? 'bg-zinc-500' : 
                            'bg-red-400'
                          }`}></span>
                          {key.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-zinc-500 hover:text-white transition-colors p-1 opacity-0 group-hover:opacity-100">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
