import React, { useState, useEffect } from 'react';
import { DollarSign, Save } from 'lucide-react';
import api from '../api';

export default function Pricing() {
  const [pricing, setPricing] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editValues, setEditValues] = useState({});

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';

  useEffect(() => {
    fetchPricing();
  }, []);

  const fetchPricing = async () => {
    const { data } = await api.get('/pricing');
    setPricing(data);
  };

  const startEdit = (item) => {
    setEditing(item.id);
    setEditValues({ input: item.input_price_per_1k, output: item.output_price_per_1k });
  };

  const saveEdit = async (id) => {
    await api.put(`/pricing/${id}`, {
      input_price_per_1k: parseFloat(editValues.input),
      output_price_per_1k: parseFloat(editValues.output),
    });
    setEditing(null);
    fetchPricing();
  };

  // Group by provider
  const grouped = pricing.reduce((acc, item) => {
    const key = item.provider_slug;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const providerNames = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Google Gemini',
  };

  const providerColors = {
    openai: 'border-green-500',
    anthropic: 'border-orange-500',
    gemini: 'border-blue-500',
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Model Pricing</h1>
        <p className="text-gray-500">Token pricing per model (per 1K tokens)</p>
      </div>

      {Object.entries(grouped).map(([slug, models]) => (
        <div key={slug} className={`bg-white rounded-xl shadow-sm border-l-4 ${providerColors[slug] || 'border-gray-500'} border border-gray-100 overflow-hidden`}>
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">{providerNames[slug] || slug}</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-6 font-medium text-gray-500">Model</th>
                <th className="text-right py-3 px-6 font-medium text-gray-500">Input ($/1K tokens)</th>
                <th className="text-right py-3 px-6 font-medium text-gray-500">Output ($/1K tokens)</th>
                {isAdmin && <th className="text-right py-3 px-6 font-medium text-gray-500">Action</th>}
              </tr>
            </thead>
            <tbody>
              {models.map((item) => (
                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-6 font-mono text-sm text-gray-800">{item.model}</td>
                  <td className="py-3 px-6 text-right">
                    {editing === item.id ? (
                      <input
                        type="number"
                        step="0.0001"
                        value={editValues.input}
                        onChange={(e) => setEditValues(v => ({ ...v, input: e.target.value }))}
                        className="w-32 px-2 py-1 border rounded text-right text-sm"
                      />
                    ) : (
                      <span className="text-gray-700">${item.input_price_per_1k?.toFixed(6)}</span>
                    )}
                  </td>
                  <td className="py-3 px-6 text-right">
                    {editing === item.id ? (
                      <input
                        type="number"
                        step="0.0001"
                        value={editValues.output}
                        onChange={(e) => setEditValues(v => ({ ...v, output: e.target.value }))}
                        className="w-32 px-2 py-1 border rounded text-right text-sm"
                      />
                    ) : (
                      <span className="text-gray-700">${item.output_price_per_1k?.toFixed(6)}</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="py-3 px-6 text-right">
                      {editing === item.id ? (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => saveEdit(item.id)} className="text-emerald-600 hover:text-emerald-700 text-sm font-medium">Save</button>
                          <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 text-sm">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(item)} className="text-blue-600 hover:text-blue-700 text-sm">Edit</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
