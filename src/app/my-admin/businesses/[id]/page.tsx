"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Store, User, DollarSign, ShoppingCart, Package, Users, TrendingUp } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface BusinessDetail {
  business: any;
  owner: any;
  stats: {
    orders: number;
    products: number;
    staff: number;
    revenue: number;
  };
  subscription: any;
  staff: any[];
  recentOrders: any[];
  recentProducts: any[];
}

export default function AdminBusinessDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [detail, setDetail] = useState<BusinessDetail | null>(null);
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

        const res = await fetch(`/api/admin/businesses/${params.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setDetail(data);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load business details");
        }
      } catch {
        setError("Failed to load business details");
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

  const business = detail.business;

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
          <h1 className="text-3xl font-bold text-gray-900">{business.storeName}</h1>
          <p className="text-gray-600 mt-1">/{business.storeSlug}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <ShoppingCart size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Orders</p>
              <p className="text-2xl font-bold text-gray-900">{detail.stats.orders}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 text-green-600 rounded-lg">
              <Package size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Products</p>
              <p className="text-2xl font-bold text-gray-900">{detail.stats.products}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Staff</p>
              <p className="text-2xl font-bold text-gray-900">{detail.stats.staff}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-50 text-yellow-600 rounded-lg">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Revenue</p>
              <p className="text-2xl font-bold text-gray-900">₦{detail.stats.revenue?.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Order #</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Total</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {detail.recentOrders.map((order: any) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{order.orderNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">₦{Number(order.total).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        order.status === "completed" ? "bg-green-100 text-green-800" :
                        order.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                        "bg-gray-100 text-gray-800"
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {detail.recentOrders.length === 0 && (
            <p className="text-gray-600 text-center py-8">No orders yet</p>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Owner</h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <User size={20} className="text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{detail.owner?.fullName}</p>
                <p className="text-sm text-gray-600">{detail.owner?.email}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Plan</span>
                <span className="text-sm font-medium text-gray-900 capitalize">{detail.subscription?.plan || business.plan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  detail.subscription?.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                }`}>
                  {detail.subscription?.status || "active"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Info</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  business.isPublished ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                }`}>
                  {business.isPublished ? "Published" : "Draft"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Email</span>
                <span className="text-sm font-medium text-gray-900">{business.email || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Phone</span>
                <span className="text-sm font-medium text-gray-900">{business.phone || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">City</span>
                <span className="text-sm font-medium text-gray-900">{business.city || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Country</span>
                <span className="text-sm font-medium text-gray-900">{business.country || "Nigeria"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Created</span>
                <span className="text-sm font-medium text-gray-900">
                  {new Date(business.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
