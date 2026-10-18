"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Store,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Package,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface OverviewStats {
  totalUsers: number;
  totalStores: number;
  totalOrders: number;
  totalRevenue: number;
  activeStores: number;
  suspendedStores: number;
  ordersToday: number;
  activeSubscriptions: number;
  freeUsers: number;
  failedPayments: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<OverviewStats>({
    totalUsers: 0,
    totalStores: 0,
    totalOrders: 0,
    totalRevenue: 0,
    activeStores: 0,
    suspendedStores: 0,
    ordersToday: 0,
    activeSubscriptions: 0,
    freeUsers: 0,
    failedPayments: 0,
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
          setStats((prev) => ({ ...prev, ...data.stats }));
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load stats");
        }
      } catch {
        setError("Failed to load admin stats");
      } finally {
        setLoading(false);
      }
    }
    loadStats();
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

  const metrics = [
    { label: "Total Users", value: stats.totalUsers.toLocaleString(), icon: Users, color: "bg-blue-50 text-blue-600" },
    { label: "Active Stores", value: stats.activeStores.toLocaleString(), icon: Store, color: "bg-green-50 text-green-600" },
    { label: "Total Orders", value: stats.totalOrders.toLocaleString(), icon: ShoppingCart, color: "bg-purple-50 text-purple-600" },
    { label: "Revenue (NGN)", value: `₦${(stats.totalRevenue || 0).toLocaleString()}`, icon: DollarSign, color: "bg-orange-50 text-orange-600" },
    { label: "Suspended Stores", value: stats.suspendedStores.toLocaleString(), icon: AlertCircle, color: "bg-red-50 text-red-600" },
    { label: "Free Users", value: stats.freeUsers.toLocaleString(), icon: Users, color: "bg-slate-100 text-slate-700" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-600 mt-2">Platform-wide metrics and activity</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{metric.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{metric.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${metric.color}`}>
                  <Icon size={24} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { href: "/my-admin/businesses", label: "Businesses" },
            { href: "/my-admin/users", label: "Users" },
            { href: "/my-admin/orders", label: "Orders" },
            { href: "/my-admin/payments", label: "Payments" },
          ].map((action) => (
            <button
              key={action.href}
              onClick={() => (window.location.href = action.href)}
              className="p-4 border border-slate-200 rounded-lg hover:border-[#25D366] hover:shadow-sm transition text-left"
            >
              <p className="font-medium text-gray-900">{action.label}</p>
              <p className="text-sm text-gray-600 mt-1">Manage {action.label.toLowerCase()}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
