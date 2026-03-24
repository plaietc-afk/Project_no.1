import React, { useState, useEffect } from 'react';
import { Bell, Plus, Trash2 } from 'lucide-react';
import api from '../api';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [providers, setProviders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newAlert, setNewAlert] = useState({ provider_id: '', threshold_percent: 80, is_global: false });

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';

  useEffect(() => {
    fetchAlerts();
    api.get('/providers').then(({ data }) => setProviders(data));
  }, []);

  const fetchAlerts = async () => {
    const { data } = await api.get('/alerts');
    setAlerts(data);
  };

  const createAlert = async () => {
    await api.post('/alerts', {
      provider_id: newAlert.is_global ? null : parseInt(newAlert.provider_id),
      threshold_percent: parseFloat(newAlert.threshold_percent),
      is_global: newAlert.is_global,
    });
    setShowForm(false);
    setNewAlert({ provider_id: '', threshold_percent: 80, is_global: false });
    fetchAlerts();
  };

  const deleteAlert = async (id) => {
    await api.delete(`/alerts/${id}`);
    fetchAlerts();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget Alerts</h1>
          <p className="text-gray-500">Set spending thresholds to get notified</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4" /> Add Alert
          </button>
        )}
      </div>

      {/* Create Alert Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">New Budget Alert</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={newAlert.is_global ? 'global' : 'provider'}
                onChange={(e) => setNewAlert(a => ({ ...a, is_global: e.target.value === 'global' }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="provider">Per Provider</option>
                <option value="global">Global (All Providers)</option>
              </select>
            </div>
            {!newAlert.is_global && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                <select
                  value={newAlert.provider_id}
                  onChange={(e) => setNewAlert(a => ({ ...a, provider_id: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">Select provider...</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Threshold (%)</label>
              <input
                type="number"
                value={newAlert.threshold_percent}
                onChange={(e) => setNewAlert(a => ({ ...a, threshold_percent: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                min="1"
                max="200"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={createAlert} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
              Create Alert
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Alerts List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left py-3 px-6 font-medium text-gray-500">Type</th>
              <th className="text-left py-3 px-6 font-medium text-gray-500">Provider</th>
              <th className="text-right py-3 px-6 font-medium text-gray-500">Threshold</th>
              <th className="text-center py-3 px-6 font-medium text-gray-500">Status</th>
              {isAdmin && <th className="text-right py-3 px-6 font-medium text-gray-500">Action</th>}
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-400">
                  <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  No budget alerts configured
                </td>
              </tr>
            ) : (
              alerts.map((alert) => (
                <tr key={alert.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-6">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                      alert.is_global ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {alert.is_global ? 'Global' : 'Provider'}
                    </span>
                  </td>
                  <td className="py-3 px-6 text-gray-700">{alert.is_global ? 'All Providers' : (alert.provider_name || '-')}</td>
                  <td className="py-3 px-6 text-right font-medium text-gray-900">{alert.threshold_percent}%</td>
                  <td className="py-3 px-6 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      alert.is_triggered ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {alert.is_triggered ? 'Triggered' : 'Active'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="py-3 px-6 text-right">
                      <button onClick={() => deleteAlert(alert.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
