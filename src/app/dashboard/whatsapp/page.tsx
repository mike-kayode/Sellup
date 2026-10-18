"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Settings } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Store {
  id: string;
  storeName: string;
  whatsappNumber: string;
}

export default function WhatsAppPage() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadStores() {
    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push("/login");
        return;
      }

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
      }
    } catch (err) {
      console.error("Error loading stores:", err);
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStores();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="h-40 bg-gray-100 animate-pulse rounded-2xl" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">WhatsApp Orders</h1>
        <p className="text-gray-600">Manage WhatsApp ordering for your stores</p>
      </div>

      {stores.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="text-gray-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Stores Yet</h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">Create a store to enable WhatsApp ordering.</p>
          <button onClick={() => router.push("/dashboard/stores")} className="btn-primary">
            Create Store
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {stores.map((store) => (
            <div key={store.id} className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{store.storeName}</h3>
                  <p className="text-sm text-gray-600">WhatsApp: {store.whatsappNumber || "Not set"}</p>
                </div>
                {store.whatsappNumber && (
                  <a
                    href={`https://wa.me/${store.whatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline flex items-center gap-2"
                  >
                    <MessageCircle size={18} />
                    Open WhatsApp
                  </a>
                )}
              </div>
              {!store.whatsappNumber && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    WhatsApp number not configured. Update your store settings to enable WhatsApp ordering.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
