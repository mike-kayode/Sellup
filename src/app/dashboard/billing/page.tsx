"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Check, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Store {
  id: string;
  storeName: string;
  plan: string;
}

interface Subscription {
  id: string;
  plan: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  gateway: string;
}

export default function BillingPage() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/stores/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const data = await res.json();
        setStores(data.stores || []);
      }

      const subRes = await fetch("/api/subscriptions/plans", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscriptions(subData.subscriptions || []);
      }
    } catch (err) {
      console.error("Error loading billing data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    loadData();
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Subscription & Billing</h1>
        <p className="text-gray-600">Manage your subscription and billing details</p>
      </div>

      {stores.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <CreditCard className="text-gray-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Stores Yet</h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">Create a store to manage subscriptions.</p>
          <button onClick={() => router.push("/dashboard/stores")} className="btn-primary">
            Create Store
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {stores.map((store, idx) => {
            const subscription = subscriptions[idx];
            return (
              <div key={store.id} className="card p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{store.storeName}</h3>
                    <p className="text-sm text-gray-600">Current Plan: <span className="capitalize font-medium">{store.plan || "freemium"}</span></p>
                  </div>
                  {subscription && (
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        subscription.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {subscription.status}
                    </span>
                  )}
                </div>

                {subscription && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="flex justify-between p-4 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">Plan</span>
                      <span className="text-sm font-medium text-gray-900 capitalize">{subscription.plan}</span>
                    </div>
                    <div className="flex justify-between p-4 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">Gateway</span>
                      <span className="text-sm font-medium text-gray-900 capitalize">{subscription.gateway || "—"}</span>
                    </div>
                    <div className="flex justify-between p-4 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">Current Period</span>
                      <span className="text-sm font-medium text-gray-900">
                        {subscription.currentPeriodStart ? new Date(subscription.currentPeriodStart).toLocaleDateString() : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between p-4 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">Renewal Date</span>
                      <span className="text-sm font-medium text-gray-900">
                        {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : "—"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
