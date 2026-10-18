"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ShoppingCart, Store, User, MapPin, Phone } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface OrderDetail {
  order: any;
  customer: any;
  store: any;
  items: any[];
}

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [detail, setDetail] = useState<OrderDetail | null>(null);
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

        const res = await fetch(`/api/admin/orders/${params.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setDetail(data);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load order details");
        }
      } catch {
        setError("Failed to load order details");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

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

  if (!detail) return null;

  const order = detail.order;
  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    processing: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Order {order.orderNumber}</h1>
          <p className="text-gray-600 mt-1">
            {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <ShoppingCart size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">₦{Number(order.total).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 text-green-600 rounded-lg">
              <Store size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Store</p>
              <p className="text-2xl font-bold text-gray-900">{detail.store?.storeName || "—"}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <User size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Customer</p>
              <p className="text-2xl font-bold text-gray-900">{detail.customer?.name || "—"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Items</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Item</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Quantity</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Price</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {detail.items.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{item.name || "Product"}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.quantity || 1}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">₦{Number(item.price || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">₦{Number((item.price || 0) * (item.quantity || 1)).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {detail.items.length === 0 && (
            <p className="text-gray-600 text-center py-8">No items</p>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Status</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Order Status</span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColors[order.status] || "bg-gray-100 text-gray-800"}`}>
                  {order.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Payment Status</span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  order.paymentStatus === "paid" ? "bg-green-100 text-green-800" :
                  order.paymentStatus === "pending" ? "bg-yellow-100 text-yellow-800" :
                  "bg-gray-100 text-gray-800"
                }`}>
                  {order.paymentStatus}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <User size={16} className="text-gray-400" />
                <span className="text-sm text-gray-900">{detail.customer?.name || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={16} className="text-gray-400" />
                <span className="text-sm text-gray-900">{detail.customer?.phone || "—"}</span>
              </div>
              {detail.customer?.deliveryAddress && (
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-900">{detail.customer.deliveryAddress}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Subtotal</span>
                <span className="text-sm font-medium text-gray-900">₦{Number(order.subtotal).toLocaleString()}</span>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Discount</span>
                  <span className="text-sm font-medium text-gray-900">-₦{Number(order.discount).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Tax</span>
                <span className="text-sm font-medium text-gray-900">₦{Number(order.tax).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-sm font-medium text-gray-900">Total</span>
                <span className="text-sm font-bold text-gray-900">₦{Number(order.total).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
