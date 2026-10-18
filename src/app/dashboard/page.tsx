"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Users, ShoppingCart, Package, ArrowRight } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { storeHref } from "@/lib/urls";

interface Store {
  id: string;
  storeName: string;
  storeSlug: string;
  isPublished: boolean;
}

export default function DashboardPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [stats, setStats] = useState({
    orders: 0,
    customers: 0,
    products: 0,
    revenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) return;

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

          // Aggregate stats across user's stores
          let orders = 0,
            customers = 0,
            products = 0,
            revenue = 0;
          (data.stores || []).forEach((s: any) => {
            orders += s._count?.orders || 0;
            products += s._count?.products || 0;
            customers += s._count?.customers || 0;
            revenue += parseFloat(s._sum?.orders?.total || "0") || 0;
          });
          setStats({ orders, customers, products, revenue });
        }
      } catch (err) {
        console.error("Error loading dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statCards = [
    {
      label: "Total Orders",
      value: stats.orders.toString(),
      icon: ShoppingCart,
      color: "text-[#25D366]",
      bgColor: "bg-[#DCF8C6]",
    },
    {
      label: "Total Customers",
      value: stats.customers.toString(),
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      label: "Total Products",
      value: stats.products.toString(),
      icon: Package,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      label: "Revenue",
      value: `₦${stats.revenue.toLocaleString()}`,
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-gray-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">
          Welcome to your Sell Up dashboard. Manage your stores and orders here.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-6 mb-8 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card p-3 sm:p-6">
              <div className="flex items-center gap-3">
                <div className={`${stat.bgColor} shrink-0 rounded-xl p-2.5 sm:p-3`}>
                  <Icon className={`${stat.color}`} size={20} />
                </div>
                <div className="min-w-0">
                  <p className="mb-2 text-xs text-gray-600 sm:text-sm">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 sm:text-3xl">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stores Section */}
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Stores</h2>

        {stores.length === 0 ? (
          <div className="text-center py-16">
          <p className="text-gray-600 mb-4">
            You don&apos;t have any stores yet
          </p>
            <Link href="/dashboard/stores" className="btn-primary inline-block">
              Create Your First Store
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stores.map((store) => (
              <Link
                key={store.id}
                href={`/dashboard/stores/${store.id}`}
                className="p-4 border border-gray-200 rounded-xl hover:border-[#25D366] hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-lg">{store.storeName}</h3>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      store.isPublished
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {store.isPublished ? "Published" : "Draft"}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {storeHref(store.storeSlug, "", { absolute: true })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid sm:grid-cols-3 gap-4">
        <Link
          href="/dashboard/products"
          className="card p-5 flex items-center justify-between hover:shadow-md transition"
        >
          <div>
            <p className="font-semibold text-gray-900">Add Products</p>
            <p className="text-sm text-gray-600">Start building your store</p>
          </div>
          <ArrowRight size={20} className="text-[#25D366]" />
        </Link>
        <Link
          href="/dashboard/orders"
          className="card p-5 flex items-center justify-between hover:shadow-md transition"
        >
          <div>
            <p className="font-semibold text-gray-900">View Orders</p>
            <p className="text-sm text-gray-600">Manage customer orders</p>
          </div>
          <ArrowRight size={20} className="text-[#25D366]" />
        </Link>
        <Link
          href="/dashboard/settings"
          className="card p-5 flex items-center justify-between hover:shadow-md transition"
        >
          <div>
            <p className="font-semibold text-gray-900">Store Settings</p>
            <p className="text-sm text-gray-600">Customize your store</p>
          </div>
          <ArrowRight size={20} className="text-[#25D366]" />
        </Link>
      </div>
    </div>
  );
}
