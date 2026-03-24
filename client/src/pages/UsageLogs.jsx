import React, { useState, useEffect } from 'react';
import { FileText, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import api from '../api';

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

export default function UsageLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [days, setDays] = useState(30);
  const [providers, setProviders] = useState([]);

  useEffect(() => {
    api.get('/providers').then(({ data }) => setProviders(data));
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, provider, model, days]);

  const fetchLogs = async () => {
    const params = new URLSearchParams({ page, limit: 50, days });
    if (provider) params.append('provider', provider);
    if (model) params.append('model', model);

    const { data } = await api.get(`/usage/logs?${params}`);
    setLogs(data.logs);
    setTotal(data.total);
    setTotalPages(data.totalPages);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Usage Logs</h1>
        <p className="text-gray-500">Detailed log of all API requests</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <select
              value={provider}
              onChange={(e) => { setProvider(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Providers</option>
              {providers.map(p => (
                <option key={p.slug} value={p.slug}>{p.name}</option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={model}
            onChange={(e) => { setModel(e.target.value); setPage(1); }}
            placeholder="Filter by model..."
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <select
            value={days}
            onChange={(e) => { setDays(Number(e.target.value)); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <span className="text-sm text-gray-500 ml-auto">{total} total records</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Time</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Provider</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Model</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">Input</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">Output</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">Total</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">Cost</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">User</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">Latency</th>
                <th className="text-center py-3 px-4 font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    No usage logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-4 text-gray-600 whitespace-nowrap">
                      {new Date(log.created_at + 'Z').toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                        {log.provider_name}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-gray-700">{log.model}</td>
                    <td className="py-2.5 px-4 text-right text-gray-600">{formatNumber(log.input_tokens)}</td>
                    <td className="py-2.5 px-4 text-right text-gray-600">{formatNumber(log.output_tokens)}</td>
                    <td className="py-2.5 px-4 text-right font-medium text-gray-900">{formatNumber(log.total_tokens)}</td>
                    <td className="py-2.5 px-4 text-right text-emerald-600 font-medium">${log.cost?.toFixed(4)}</td>
                    <td className="py-2.5 px-4 text-gray-500">{log.user_label || '-'}</td>
                    <td className="py-2.5 px-4 text-right text-gray-500">{log.response_time_ms}ms</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.status_code === 200 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {log.status_code}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
