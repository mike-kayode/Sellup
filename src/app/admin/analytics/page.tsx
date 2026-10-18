"use client";

import { useState, useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Stats {
  totalUsers: number;
  totalStores: number;
  totalOrders: number;
  totalRevenue: number;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalStores: 0,
    totalOrders: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStats() {
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

        const res = await fetch("/api/admin/overview", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load analytics");
        }
      } catch (err) {
        setError("Failed to load analytics");
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
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

  const metrics = [
    {
      label: "Total Users",
      value: stats.totalUsers.toLocaleString(),
      icon: "👥",
    },
    {
      label: "Active Stores",
      value: stats.totalStores.toLocaleString(),
      icon: "🏪",
    },
    {
      label: "Total Orders",
      value: stats.totalOrders.toLocaleString(),
      icon: "📦",
    },
    {
      label: "Revenue (NGN)",
      value: `₦${(stats.totalRevenue || 0).toLocaleString()}`,
      icon: "💰",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Platform Analytics</h1>
          <p className="text-gray-600 mt-2">
            Real-time platform statistics and insights
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-6">
        {metrics.map((metric, idx) => (
          <div
            key={idx}
            className="bg-white rounded-lg shadow p-6 border border-gray-100"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {metric.label}
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {metric.value}
                </p>
              </div>
              <span className="text-3xl">{metric.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Plan Distribution */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Subscription Plan Distribution
        </h2>
        <div className="space-y-3">
          {[
            { plan: "Freemium", count: 280, percentage: 73 },
            { plan: "Starter", count: 65, percentage: 17 },
            { plan: "Business", count: 32, percentage: 8 },
            { plan: "Pro", count: 8, percentage: 2 },
          ].map((item) => (
            <div key={item.plan}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">{item.plan}</span>
                <span className="text-gray-600">{item.count} stores</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${item.percentage}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
