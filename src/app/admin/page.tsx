"use client";

import { useState, useEffect } from "react";
import { Users, Store, TrendingUp, DollarSign } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Stats {
  totalUsers: number;
  totalStores: number;
  totalRevenue: number;
  totalOrders: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalStores: 0,
    totalRevenue: 0,
    totalOrders: 0,
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
          setError(data.error || "Failed to load stats");
        }
      } catch (err) {
        setError("Failed to load admin stats");
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Platform overview and management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-6">
        {[
          {
            label: "Total Users",
            value: stats.totalUsers.toLocaleString(),
            icon: Users,
            color: "bg-blue-50",
            iconColor: "text-blue-600",
          },
          {
            label: "Active Stores",
            value: stats.totalStores.toLocaleString(),
            icon: Store,
            color: "bg-green-50",
            iconColor: "text-green-600",
          },
          {
            label: "Total Orders",
            value: stats.totalOrders.toLocaleString(),
            icon: TrendingUp,
            color: "bg-purple-50",
            iconColor: "text-purple-600",
          },
          {
            label: "Revenue (NGN)",
            value: `₦${(stats.totalRevenue || 0).toLocaleString()}`,
            icon: DollarSign,
            color: "bg-orange-50",
            iconColor: "text-orange-600",
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className={`${stat.color} rounded-lg p-6 border border-gray-200`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stat.value}
                </p>
              </div>
              <stat.icon className={`w-8 h-8 ${stat.iconColor}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <a
            href="/admin/users"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left block"
          >
            <div className="font-medium text-gray-900">View All Users</div>
            <p className="text-sm text-gray-600 mt-1">
              Manage user accounts and subscriptions
            </p>
          </a>
          <a
            href="/admin/stores"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left block"
          >
            <div className="font-medium text-gray-900">View All Stores</div>
            <p className="text-sm text-gray-600 mt-1">
              Monitor store performance and status
            </p>
          </a>
          <a
            href="/admin/analytics"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left block"
          >
            <div className="font-medium text-gray-900">View Analytics</div>
            <p className="text-sm text-gray-600 mt-1">
              Platform-wide statistics and reports
            </p>
          </a>
        </div>
      </div>
    </div>
  );
}
