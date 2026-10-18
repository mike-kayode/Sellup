"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, MessageCircle } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from "@/lib/constants";

interface Order {
  id: string;
  orderNumber: string;
  items: Array<{ name: string; quantity: number; total: string }>;
  total: string;
  status: string;
  customerId: string;
  createdAt: string;
}

interface Store {
  id: string;
  storeName: string;
  whatsappNumber: string;
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
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

  async function loadOrders() {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/orders/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId: selectedStoreId }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Error loading orders:", err);
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
        await loadOrders();
      }
    }
    execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId]);

  const selectedStore = stores.find((s) => s.id === selectedStoreId);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="h-40 bg-gray-100 animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Orders</h1>
          <p className="text-gray-600">
            Track and manage all your customer orders
          </p>
        </div>
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="text-gray-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            No Stores Yet
          </h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Create a store to start receiving orders.
          </p>
          <button
            onClick={() => router.push("/dashboard/stores")}
            className="btn-primary"
          >
            Create Store
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Orders</h1>
          <p className="text-gray-600">
            Track and manage all your customer orders
          </p>
        </div>
        {selectedStore?.whatsappNumber && (
          <a
            href={`https://wa.me/${selectedStore.whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline flex items-center gap-2"
          >
            <MessageCircle size={18} /> WhatsApp
          </a>
        )}
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

      {orders.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="text-gray-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            No Orders Yet
          </h2>
          <p className="text-gray-600 max-w-md mx-auto">
            Orders from customers will appear here. Share your store link to
            start receiving orders on WhatsApp.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-gray-900">
                      #{order.orderNumber}
                    </h3>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        ORDER_STATUS_COLORS[order.status as keyof typeof ORDER_STATUS_COLORS] ||
                        "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] ||
                        order.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">
                    {new Date(order.createdAt).toLocaleString("en-NG")}
                  </p>
                  <p className="text-sm text-gray-600">
                    {Array.isArray(order.items)
                      ? order.items
                          .map((i) => `${i.quantity}× ${i.name}`)
                          .join(", ")
                      : "Items"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#25D366]">
                    ₦{parseFloat(order.total).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}