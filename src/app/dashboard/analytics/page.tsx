"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  ShoppingCart,
  Users,
  DollarSign,
  BarChart3,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Analytics {
  totalOrders: number;
  completedOrders: number;
  totalRevenue: string;
  totalCustomers: number;
  totalProducts: number;
  conversionRate: string;
  averageOrderValue: string;
}

interface Order {
  total: string;
  status: string;
}

interface Store {
  id: string;
  storeName: string;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<Analytics>({
    totalOrders: 0,
    completedOrders: 0,
    totalRevenue: "0",
    totalCustomers: 0,
    totalProducts: 0,
    conversionRate: "0",
    averageOrderValue: "0",
  });
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [loading, setLoading] = useState(true);

  async function getToken(): Promise<string | null> {
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  async function loadStores() {
    try {
      const token = await getToken();
      if (!token) {
        router.push("/login");
        return;
      }
      const res = await fetch("/api/stores/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setStores(data.stores || []);
        if (data.stores && data.stores.length > 0) {
          setSelectedStoreId(data.stores[0].id);
        }
      }
    } catch (err) {
      console.error("Error loading stores:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadAnalytics() {
    try {
      const token = await getToken();
      if (!token) return;

      // Fetch orders
      const ordersRes = await fetch("/api/orders/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId: selectedStoreId }),
      });

      // Fetch customers
      const customersRes = await fetch("/api/customers/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId: selectedStoreId }),
      });

      // Fetch products
      const productsRes = await fetch("/api/products/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId: selectedStoreId }),
      });

      const ordersData = ordersRes.ok ? await ordersRes.json() : { orders: [] };
      const customersData = customersRes.ok
        ? await customersRes.json()
        : { customers: [] };
      const productsData = productsRes.ok
        ? await productsRes.json()
        : { products: [] };

      const orders: Order[] = ordersData.orders || [];
      const totalOrders = orders.length;
      const completedOrders = orders.filter(
        (o) => o.status === "completed"
      ).length;
      const totalRevenue = orders.reduce(
        (sum, o) => sum + parseFloat(o.total || "0"),
        0
      );
      const totalCustomers = customersData.total || 0;
      const totalProducts = productsData.products?.length || 0;
      const averageOrderValue =
        totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
      const conversionRate = totalOrders > 0 ? "100" : "0";

      setAnalytics({
        totalOrders,
        completedOrders,
        totalRevenue: totalRevenue.toString(),
        totalCustomers,
        totalProducts,
        conversionRate,
        averageOrderValue: averageOrderValue.toString(),
      });
      setLoading(false);
    } catch (err) {
      console.error("Error loading analytics:", err);
      setLoading(false);
    }
  }

  useEffect(() => {
    async function execute() {
      await loadStores();
    }
    execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function execute() {
      if (selectedStoreId) {
        await loadAnalytics();
      }
    }
    execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId]);

  const metrics = [
    {
      label: "Total Orders",
      value: analytics.totalOrders,
      icon: ShoppingCart,
      color: "text-[#25D366]",
      bgColor: "bg-[#DCF8C6]",
    },
    {
      label: "Total Revenue",
      value: `₦${parseFloat(analytics.totalRevenue).toLocaleString()}`,
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      label: "Total Customers",
      value: analytics.totalCustomers,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      label: "Avg Order Value",
      value: `₦${parseFloat(analytics.averageOrderValue).toLocaleString()}`,
      icon: BarChart3,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      label: "Completed Orders",
      value: analytics.completedOrders,
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      label: "Products",
      value: analytics.totalProducts,
      icon: BarChart3,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
        <p className="text-gray-600">Track your store performance</p>
      </div>

      {/* Store selector */}
      {stores.length > 1 && (
        <div className="mb-6">
          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="input max-w-sm"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.storeName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-gray-600 text-sm mb-2">{metric.label}</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {metric.value}
                  </p>
                </div>
                <div className={`${metric.bgColor} p-3 rounded-xl`}>
                  <Icon className={`${metric.color}`} size={24} />
                </div>
              </div>
            </div>
          );
        })}
</div>
    </div>
  );
}
