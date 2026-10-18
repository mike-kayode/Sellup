"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Store, Plus, ExternalLink, Copy, Check } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { storeHref } from "@/lib/urls";

interface Store {
  id: string;
  storeName: string;
  storeSlug: string;
  description: string;
  email: string;
  phone: string;
  whatsappNumber: string;
  address: string;
  city: string;
  state: string;
  country: string;
  isPublished: boolean;
  plan: string;
  createdAt: string;
}

export default function StorePage() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

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

  function copyToClipboard(text: string, storeId: string) {
    navigator.clipboard.writeText(text);
    setCopied(storeId);
    setTimeout(() => setCopied(null), 2000);
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Store</h1>
        <p className="text-gray-600">Manage your store profile and settings</p>
      </div>

      {stores.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Store className="text-gray-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Stores Yet</h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">Create your first store to start selling online.</p>
          <button onClick={() => router.push("/dashboard/stores")} className="btn-primary">
            Create Store
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {stores.map((store) => (
            <div key={store.id} className="card p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold text-gray-900">{store.storeName}</h2>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        store.isPublished ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {store.isPublished ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="text-gray-600 break-all">
                    {storeHref(store.storeSlug, "", { absolute: true })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={storeHref(store.storeSlug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline flex items-center gap-2"
                  >
                    <ExternalLink size={18} />
                    View Store
                  </a>
                  <button
                     onClick={() => copyToClipboard(storeHref(store.storeSlug, "", { absolute: true }), store.id)}
                    className="btn-outline flex items-center gap-2"
                  >
                    {copied === store.id ? <Check size={18} /> : <Copy size={18} />}
                    {copied === store.id ? "Copied!" : "Copy Link"}
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Store Information</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <p className="text-gray-900">{store.description || "No description"}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <p className="text-gray-900">{store.email || "—"}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <p className="text-gray-900">{store.phone || "—"}</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
                      <p className="text-gray-900">{store.whatsappNumber || "—"}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <p className="text-gray-900">{store.address || "—"}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                        <p className="text-gray-900">{store.city || "—"}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                        <p className="text-gray-900">{store.state || "—"}</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                      <span className="capitalize">{store.plan || "freemium"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
