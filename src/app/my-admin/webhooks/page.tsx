"use client";

import { useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Webhook {
  id: string;
  url: string;
  events: string[];
  status: string;
  lastDelivery: string;
  retryCount: number;
  createdAt: string;
}

export default function AdminWebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
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

        const res = await fetch("/api/admin/webhooks", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setWebhooks(data.webhooks || []);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load webhooks");
        }
      } catch {
        setError("Failed to load webhooks");
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
          <h1 className="text-3xl font-bold text-gray-900">Webhooks</h1>
          <p className="text-gray-600 mt-2">Manage webhook endpoints and delivery logs</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#1da851] transition-colors">
          <Plus size={18} />
          Add Webhook
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">URL</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Events</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Last Delivery</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Retries</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {webhooks.map((webhook) => (
                <tr key={webhook.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-sm text-gray-900 max-w-xs truncate">{webhook.url}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {webhook.events.map((evt) => (
                        <span key={evt} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{evt}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      webhook.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                    }`}>
                      {webhook.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {webhook.lastDelivery ? new Date(webhook.lastDelivery).toLocaleString() : "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{webhook.retryCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {webhooks.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <p className="text-gray-600">No webhooks configured yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
