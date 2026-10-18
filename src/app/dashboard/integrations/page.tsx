"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plug, Check, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Integration {
  id: string;
  name: string;
  type: string;
  status: string;
  description: string;
}

export default function IntegrationsPage() {
  const router = useRouter();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadIntegrations() {
    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/admin/integrations", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations || []);
      }
    } catch (err) {
      console.error("Error loading integrations:", err);
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadIntegrations();
  }, []);

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Integrations</h1>
        <p className="text-gray-600">Connect third-party services to your store</p>
      </div>

      {integrations.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Plug className="text-gray-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Integrations Available</h2>
          <p className="text-gray-600 max-w-md mx-auto">Integrations will appear here when available for your plan.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map((integration) => (
            <div key={integration.id} className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gray-100 rounded-lg">
                  <Plug className="text-gray-600" size={24} />
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                    integration.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {integration.status === "active" ? <Check size={14} /> : <X size={14} />}
                  {integration.status}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{integration.name}</h3>
              <p className="text-sm text-gray-600 capitalize">{integration.type}</p>
              <p className="text-sm text-gray-600 mt-2">{integration.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
