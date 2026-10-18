"use client";

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  isEnabled: boolean;
  createdAt: string;
}

export default function AdminFeaturesPage() {
  const [features, setFeatures] = useState<FeatureFlag[]>([]);
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

        const res = await fetch("/api/admin/features", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setFeatures(data.features || []);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load features");
        }
      } catch {
        setError("Failed to load features");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function toggleFeature(id: string, isEnabled: boolean) {
    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      await fetch(`/api/admin/features/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ isEnabled: !isEnabled }),
      });

      setFeatures((prev) => prev.map((f) => (f.id === id ? { ...f, isEnabled: !isEnabled } : f)));
    } catch {
      // ignore
    }
  }

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
        <h1 className="text-3xl font-bold text-gray-900">Feature Flags</h1>
        <p className="text-gray-600 mt-2">Enable or disable platform features globally</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Feature</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Key</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {features.map((feature) => (
                <tr key={feature.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{feature.name}</p>
                      <p className="text-sm text-gray-600">{feature.description}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-700">{feature.key}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleFeature(feature.id, feature.isEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        feature.isEnabled ? "bg-[#25D366]" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          feature.isEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {features.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <p className="text-gray-600">No feature flags configured yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
