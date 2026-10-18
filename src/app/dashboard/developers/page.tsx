"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Code, Key, Plus, Eye, EyeOff } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsed: string | null;
  createdAt: string;
}

export default function DevelopersPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [saving, setSaving] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/admin/api", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      }
    } catch (err) {
      console.error("Error loading API keys:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      const res = await fetch("/api/admin/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: keyName }),
      });

      if (res.ok) {
        setShowForm(false);
        setKeyName("");
        await loadKeys();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="h-40 bg-gray-100 animate-pulse rounded-2xl" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">API Access</h1>
          <p className="text-gray-600">Manage API keys for programmatic access</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          Generate Key
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateKey} className="card p-6 mb-8 max-w-md space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Key Name</label>
            <input
              type="text"
              required
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              className="input"
              placeholder="My API Key"
              disabled={saving}
            />
          </div>
          <div className="flex gap-4">
            <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
              {saving ? "Generating..." : "Generate Key"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} disabled={saving} className="btn-secondary flex-1">
              Cancel
            </button>
          </div>
        </form>
      )}

      {keys.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Key className="text-gray-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No API Keys</h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">Generate an API key to access the Sell Up API programmatically.</p>
          {!showForm && (
            <button onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-2">
              <Plus size={20} />
              Generate Your First Key
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Key</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Last Used</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {keys.map((apiKey) => (
                  <tr key={apiKey.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{apiKey.name}</td>
                    <td className="px-6 py-4 font-mono text-sm text-gray-700">{apiKey.prefix}...</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {apiKey.lastUsed ? new Date(apiKey.lastUsed).toLocaleString() : "Never"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(apiKey.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
