"use client";

import { useEffect, useState } from "react";
import { Tag } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Promotion {
  id: string;
  code: string;
  description: string;
  discountType: string;
  discountValue: string;
  maxUsage: number | null;
  currentUsage: number;
  minOrderAmount: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
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

        const res = await fetch("/api/admin/promotions", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setPromotions(data.promotions || []);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load promotions");
        }
      } catch {
        setError("Failed to load promotions");
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
        <h1 className="text-3xl font-bold text-gray-900">Promotions</h1>
        <p className="text-gray-600 mt-2">Manage platform-wide coupons and promotions</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Code</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Type</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Value</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Usage</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {promotions.map((promo) => (
                <tr key={promo.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono font-medium text-gray-900">{promo.code}</td>
                  <td className="px-6 py-4 text-gray-700 capitalize">{promo.discountType}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {promo.discountType === "percentage" ? `${promo.discountValue}%` : `₦${parseFloat(promo.discountValue).toLocaleString()}`}
                  </td>
                  <td className="px-6 py-4 text-gray-700">
                    {promo.currentUsage}
                    {promo.maxUsage ? ` / ${promo.maxUsage}` : " / ∞"}
                  </td>
                  <td className="px-6 py-4">
                    {promo.isActive ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {promo.expiresAt ? new Date(promo.expiresAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {promotions.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <p className="text-gray-600">No promotions found</p>
          </div>
        )}
      </div>
    </div>
  );
}
