import React, { useState, useEffect } from 'react';
import { Zap, Key, Check, X, ExternalLink } from 'lucide-react';
import api from '../api';

const PROVIDER_INFO = {
  openai: { color: 'bg-green-500', docs: 'https://platform.openai.com/api-keys' },
  anthropic: { color: 'bg-orange-500', docs: 'https://console.anthropic.com/settings/keys' },
  gemini: { color: 'bg-blue-500', docs: 'https://aistudio.google.com/app/apikey' },
  'azure-openai': { color: 'bg-sky-500', docs: '' },
  'aws-bedrock': { color: 'bg-amber-500', docs: '' },
};

export default function Providers() {
  const [providers, setProviders] = useState([]);
  const [keyStatus, setKeyStatus] = useState({});
  const [editingKey, setEditingKey] = useState(null);
  const [newKey, setNewKey] = useState('');
  const [editingBudget, setEditingBudget] = useState(null);
  const [newBudget, setNewBudget] = useState('');

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    const { data } = await api.get('/providers');
    setProviders(data);
    // Check key status for each
    for (const p of data) {
      const { data: ks } = await api.get(`/providers/${p.id}/has-key`);
      setKeyStatus(prev => ({ ...prev, [p.id]: ks.hasKey }));
    }
  };

  const saveKey = async (id) => {
    await api.put(`/providers/${id}`, { api_key: newKey });
    setEditingKey(null);
    setNewKey('');
    fetchProviders();
  };

  const saveBudget = async (id) => {
    await api.put(`/providers/${id}`, { monthly_budget: parseFloat(newBudget) || 0 });
    setEditingBudget(null);
    setNewBudget('');
    fetchProviders();
  };

  const toggleActive = async (id, currentState) => {
    await api.put(`/providers/${id}`, { is_active: !currentState });
    fetchProviders();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">API Providers</h1>
        <p className="text-gray-500">Configure API keys and manage provider settings</p>
      </div>

      {/* Proxy Endpoint Info */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <h3 className="font-semibold text-emerald-800 mb-2">Proxy Endpoints</h3>
        <p className="text-sm text-emerald-700 mb-3">Route your API calls through these endpoints to automatically track token usage:</p>
        <div className="space-y-1 text-sm font-mono">
          <p className="text-emerald-800">OpenAI: <span className="bg-emerald-100 px-2 py-0.5 rounded">POST /api/proxy/openai/v1/chat/completions</span></p>
          <p className="text-emerald-800">Anthropic: <span className="bg-emerald-100 px-2 py-0.5 rounded">POST /api/proxy/anthropic/v1/messages</span></p>
          <p className="text-emerald-800">Gemini: <span className="bg-emerald-100 px-2 py-0.5 rounded">POST /api/proxy/gemini/generateContent</span></p>
        </div>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {providers.map((provider) => {
          const info = PROVIDER_INFO[provider.slug] || { color: 'bg-gray-500', docs: '' };
          const hasKey = keyStatus[provider.id];

          return (
            <div key={provider.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${info.color} rounded-xl flex items-center justify-center`}>
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                    <p className="text-xs text-gray-400">{provider.slug}</p>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => toggleActive(provider.id, provider.is_active)}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      provider.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {provider.is_active ? 'Active' : 'Inactive'}
                  </button>
                )}
              </div>

              {/* API Key Status */}
              <div className="flex items-center gap-2 mb-3">
                <Key className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">API Key:</span>
                {hasKey ? (
                  <span className="flex items-center gap-1 text-sm text-emerald-600">
                    <Check className="w-4 h-4" /> Configured
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-red-500">
                    <X className="w-4 h-4" /> Not set
                  </span>
                )}
              </div>

              {/* Budget */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-gray-600">Monthly Budget:</span>
                {editingBudget === provider.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={newBudget}
                      onChange={(e) => setNewBudget(e.target.value)}
                      className="w-24 px-2 py-1 border rounded text-sm"
                      placeholder="0.00"
                    />
                    <button onClick={() => saveBudget(provider.id)} className="text-emerald-600 text-sm">Save</button>
                    <button onClick={() => setEditingBudget(null)} className="text-gray-400 text-sm">Cancel</button>
                  </div>
                ) : (
                  <span
                    className="text-sm font-medium text-gray-900 cursor-pointer hover:text-emerald-600"
                    onClick={() => { if (isAdmin) { setEditingBudget(provider.id); setNewBudget(provider.monthly_budget || ''); } }}
                  >
                    ${provider.monthly_budget?.toFixed(2) || '0.00'}
                  </span>
                )}
              </div>

              {/* Actions */}
              {isAdmin && (
                <div className="space-y-2">
                  {editingKey === provider.id ? (
                    <div className="space-y-2">
                      <input
                        type="password"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        placeholder="Paste API key..."
                      />
                      <div className="flex gap-2">
                        <button onClick={() => saveKey(provider.id)} className="flex-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                          Save Key
                        </button>
                        <button onClick={() => { setEditingKey(null); setNewKey(''); }} className="px-3 py-1.5 border rounded-lg text-sm">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingKey(provider.id)}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                      >
                        {hasKey ? 'Update Key' : 'Add Key'}
                      </button>
                      {info.docs && (
                        <a
                          href={info.docs}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Docs
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
