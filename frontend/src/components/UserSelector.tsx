"use client";

import { useState, useEffect, useCallback } from "react";
import { usersApi } from "../lib/api";
import type { User } from "../lib/api";

interface UserSelectorProps {
  selectedUserId: number | null;
  onChange: (userId: number | null) => void;
}

export function UserSelector({ selectedUserId, onChange }: UserSelectorProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const r = await usersApi.list();
      setUsers(r.data);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const r = await usersApi.create(newName.trim());
      setUsers(prev => [...prev, r.data]);
      setNewName("");
      setCreating(false);
      onChange(r.data.id);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
        <button
          onClick={() => onChange(null)}
          className={`px-3 py-1.5 text-xs transition-colors ${selectedUserId === null ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
        >
          All
        </button>
        {users.map(u => (
          <button
            key={u.id}
            onClick={() => onChange(u.id)}
            className={`px-3 py-1.5 text-xs border-l border-zinc-700 transition-colors ${selectedUserId === u.id ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            {u.display_name}
          </button>
        ))}
      </div>

      {creating ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setCreating(false); setNewName(""); } }}
            placeholder="Name"
            className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-2 py-1.5 w-28 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleCreate}
            disabled={loading || !newName.trim()}
            className="text-xs px-2 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            Add
          </button>
          <button onClick={() => { setCreating(false); setNewName(""); }} className="text-xs text-zinc-500 hover:text-zinc-300 px-1">✕</button>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
          title="Add user"
          aria-label="Add user"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}
    </div>
  );
}
