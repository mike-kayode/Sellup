"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Subscription {
  id: string;
  plan: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  gateway: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
  storeName: string;
  storeSlug: string;
}

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
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

        const res = await fetch("/api/admin/subscriptions", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setSubscriptions(data.subscriptions || []);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load subscriptions");
        }
      } catch {
        setError("Failed to load subscriptions");
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
        <h1 className="text-3xl font-bold text-gray-900">Subscriptions</h1>
        <p className="text-gray-600 mt-2">Manage all store subscriptions</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Store</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Plan</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Gateway</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Period End</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {subscriptions.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{sub.storeName}</p>
                      <p className="text-sm text-gray-600">/{sub.storeSlug}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 capitalize">
                      {sub.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium capitalize bg-green-100 text-green-800">
                        {sub.status}
                      </span>
                      {sub.cancelAtPeriodEnd && (
                        <span className="text-xs text-gray-500">(cancels at period end)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-700 capitalize">{sub.gateway || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(sub.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {subscriptions.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <p className="text-gray-600">No subscriptions found</p>
          </div>
        )}
      </div>
    </div>
  );
}
