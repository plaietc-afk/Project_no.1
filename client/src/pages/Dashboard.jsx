import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, DollarSign, Cpu, Activity, Database } from 'lucide-react';
import api from '../api';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function StatCard({ title, value, subtitle, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get(`/dashboard/summary?days=${days}`);
      setData(d);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [days]);

  const seedDemo = async () => {
    setSeeding(true);
    try {
      await api.post('/demo/seed');
      await fetchData();
    } catch (err) {
      alert('Failed to seed demo data');
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const isEmpty = !data || data.total.total_requests === 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Monitor your GenAI token usage & costs</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={seedDemo}
            disabled={seeding}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            {seeding ? 'Seeding...' : 'Load Demo Data'}
          </button>
        </div>
      </div>

      {isEmpty ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">No usage data yet</h2>
          <p className="text-gray-400 mb-6">Start by configuring your API keys in the Providers page, or load demo data to explore the dashboard.</p>
          <button onClick={seedDemo} disabled={seeding} className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {seeding ? 'Loading...' : 'Load Demo Data'}
          </button>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Cost"
              value={`$${data.total.total_cost.toFixed(2)}`}
              subtitle={`${days} day period`}
              icon={DollarSign}
              color="bg-emerald-500"
            />
            <StatCard
              title="Total Tokens"
              value={formatNumber(data.total.total_tokens)}
              subtitle={`${formatNumber(data.total.total_input)} in / ${formatNumber(data.total.total_output)} out`}
              icon={Cpu}
              color="bg-blue-500"
            />
            <StatCard
              title="API Requests"
              value={formatNumber(data.total.total_requests)}
              subtitle={`~${Math.round(data.total.total_requests / days)}/day avg`}
              icon={Activity}
              color="bg-amber-500"
            />
            <StatCard
              title="Avg Cost/Request"
              value={`$${(data.total.total_cost / data.total.total_requests).toFixed(4)}`}
              subtitle="Per request"
              icon={TrendingUp}
              color="bg-purple-500"
            />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Cost Trend */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Cost Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
                  <Tooltip formatter={(v) => [`$${v.toFixed(4)}`, 'Cost']} labelFormatter={(l) => `Date: ${l}`} />
                  <Line type="monotone" dataKey="cost" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Daily Token Usage */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Token Usage</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={formatNumber} />
                  <Tooltip formatter={(v) => [formatNumber(v), 'Tokens']} labelFormatter={(l) => `Date: ${l}`} />
                  <Bar dataKey="tokens" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost by Provider */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost by Provider</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.byProvider.filter(p => p.cost > 0)}
                    dataKey="cost"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {data.byProvider.filter(p => p.cost > 0).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `$${v.toFixed(4)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Top Models */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Models by Cost</h3>
              <div className="space-y-3">
                {data.topModels.map((m, i) => {
                  const maxCost = data.topModels[0]?.cost || 1;
                  return (
                    <div key={m.model} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-4">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700">{m.model}</span>
                          <span className="text-gray-500">${m.cost.toFixed(4)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${(m.cost / maxCost) * 100}%`,
                              backgroundColor: COLORS[i % COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Provider Summary Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Provider Summary</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Provider</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">Requests</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">Input Tokens</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">Output Tokens</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">Total Tokens</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byProvider.map((p) => (
                    <tr key={p.slug} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{p.name}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{formatNumber(p.requests)}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{formatNumber(p.input_tokens)}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{formatNumber(p.output_tokens)}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{formatNumber(p.total_tokens)}</td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-600">${p.cost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
