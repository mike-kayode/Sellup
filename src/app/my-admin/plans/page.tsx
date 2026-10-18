"use client";

import { useEffect, useState } from "react";
import { Tag } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  currency: string;
  interval: string;
  productLimit: number;
  staffLimit: number;
  storageLimit: string;
  features: string[];
  isActive: boolean;
  isRecommended: boolean;
  sortOrder: number;
  createdAt: string;
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
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

        const res = await fetch("/api/admin/plans", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setPlans(data.plans || []);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load plans");
        }
      } catch {
        setError("Failed to load plans");
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
        <h1 className="text-3xl font-bold text-gray-900">Plans</h1>
        <p className="text-gray-600 mt-2">Manage subscription plans and pricing</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
              {plan.isRecommended && (
                <span className="text-xs bg-[#25D366] text-white px-2 py-1 rounded-full">Recommended</span>
              )}
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-2">
              {plan.currency} {parseFloat(plan.price).toLocaleString()}
              <span className="text-sm font-normal text-gray-600">/{plan.interval}</span>
            </p>
            <p className="text-sm text-gray-600 mb-4">{plan.description}</p>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Products</span>
                <span className="font-medium text-gray-900">{plan.productLimit === -1 ? "Unlimited" : plan.productLimit}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Staff</span>
                <span className="font-medium text-gray-900">{plan.staffLimit === -1 ? "Unlimited" : plan.staffLimit}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Storage</span>
                <span className="font-medium text-gray-900">{plan.storageLimit}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                plan.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
              }`}>
                {plan.isActive ? "Active" : "Inactive"}
              </span>
              <button className="text-sm text-[#25D366] hover:underline">Edit</button>
            </div>
          </div>
        ))}
      </div>

      {plans.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-12 text-center">
          <p className="text-gray-600">No plans configured yet</p>
        </div>
      )}
    </div>
  );
}
