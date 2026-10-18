"use client";

import { useEffect, useState } from "react";
import { Key, Plus } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsed: string | null;
  createdAt: string;
}

export default function AdminApiPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setError("Not authenticated");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/admin/api", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setKeys(data.keys || []);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load API keys");
        }
      } catch {
        setError("Failed to load API keys");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">API Management</h1>
          <p className="text-gray-600 mt-2">Manage API keys and access</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#1da851] transition-colors">
          <Plus size={18} />
          Generate Key
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
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
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(apiKey.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {keys.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No API keys generated yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
