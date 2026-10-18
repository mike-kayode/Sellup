"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Eye } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Order {
  id: string;
  orderNumber: string;
  storeName: string;
  storeSlug: string;
  customerName: string;
  customerPhone: string;
  total: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

        const params = new URLSearchParams({
          search,
          status: statusFilter,
          limit: "20",
          page: "1",
        });

        const res = await fetch(`/api/admin/orders?${params}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load orders");
        }
      } catch {
        setError("Failed to load orders");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [search, statusFilter]);

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
        <h1 className="text-3xl font-bold text-gray-900">Platform Orders</h1>
        <p className="text-gray-600 mt-2">Monitor orders across all stores</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by order number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="preparing">Preparing</option>
          <option value="ready">Ready</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Order</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Store</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Customer</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Total</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-sm text-gray-900">#{order.orderNumber}</td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-gray-900">{order.storeName}</p>
                      <p className="text-sm text-gray-600">/{order.storeSlug}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-gray-900">{order.customerName}</p>
                      <p className="text-sm text-gray-600">{order.customerPhone}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">₦{parseFloat(order.total).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium capitalize bg-blue-100 text-blue-800">
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => router.push(`/my-admin/orders/${order.id}`)}
                      className="text-gray-600 hover:text-blue-600 p-1"
                      title="View Details"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {orders.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <p className="text-gray-600">No orders found</p>
          </div>
        )}
      </div>
    </div>
  );
}
