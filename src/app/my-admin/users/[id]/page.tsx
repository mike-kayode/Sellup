"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, User, Store, ShoppingCart, DollarSign } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface UserDetail {
  user: any;
  stores: any[];
  orders: any[];
  payments: any[];
  stats: {
    stores: number;
    orders: number;
    totalSpent: number;
  };
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [detail, setDetail] = useState<UserDetail | null>(null);
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

        const res = await fetch(`/api/admin/users/${params.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setDetail(data);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load user details");
        }
      } catch {
        setError("Failed to load user details");
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

  const user = detail.user;

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
          <h1 className="text-3xl font-bold text-gray-900">{user.fullName}</h1>
          <p className="text-gray-600 mt-1">{user.email}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Store size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Stores</p>
              <p className="text-2xl font-bold text-gray-900">{detail.stats.stores}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 text-green-600 rounded-lg">
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
            <div className="p-3 bg-yellow-50 text-yellow-600 rounded-lg">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Spent</p>
              <p className="text-2xl font-bold text-gray-900">₦{detail.stats.totalSpent?.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Stores</h2>
          <div className="space-y-3">
            {detail.stores.map((store: any) => (
              <div key={store.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{store.storeName}</p>
                  <p className="text-sm text-gray-600">/{store.storeSlug}</p>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  store.isPublished ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                }`}>
                  {store.isPublished ? "Published" : "Draft"}
                </span>
              </div>
            ))}
            {detail.stores.length === 0 && (
              <p className="text-gray-600 text-center py-4">No stores yet</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h2>
          <div className="space-y-3">
            {detail.orders.map((order: any) => (
              <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{order.orderNumber}</p>
                  <p className="text-sm text-gray-600">₦{Number(order.total).toLocaleString()}</p>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  order.status === "completed" ? "bg-green-100 text-green-800" :
                  order.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                  "bg-gray-100 text-gray-800"
                }`}>
                  {order.status}
                </span>
              </div>
            ))}
            {detail.orders.length === 0 && (
              <p className="text-gray-600 text-center py-4">No orders yet</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="flex justify-between p-4 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">Email Verified</span>
            <span className="text-sm font-medium text-gray-900">{user.isEmailVerified ? "Yes" : "No"}</span>
          </div>
          <div className="flex justify-between p-4 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">Role</span>
            <span className="text-sm font-medium text-gray-900 capitalize">{user.role}</span>
          </div>
          <div className="flex justify-between p-4 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">Registered</span>
            <span className="text-sm font-medium text-gray-900">
              {new Date(user.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between p-4 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">Last Updated</span>
            <span className="text-sm font-medium text-gray-900">
              {new Date(user.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
