"use client";

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Integration {
  id: string;
  name: string;
  type: string;
  status: string;
  description: string;
  createdAt: string;
}

export default function AdminIntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
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

        const res = await fetch("/api/admin/integrations", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setIntegrations(data.integrations || []);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load integrations");
        }
      } catch {
        setError("Failed to load integrations");
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-600 mt-2">Manage platform integrations</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Type</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Description</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {integrations.map((integration) => (
                <tr key={integration.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{integration.name}</td>
                  <td className="px-6 py-4 text-gray-700 capitalize">{integration.type}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      integration.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                    }`}>
                      {integration.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{integration.description}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(integration.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {integrations.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No integrations configured yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
