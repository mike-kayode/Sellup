"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Check, X, ExternalLink } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { storeHref } from "@/lib/urls";

interface Store {
  id: string;
  storeName: string;
  storeSlug: string;
}

export default function DomainPage() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Custom Domain</h1>
        <p className="text-gray-600">Connect your own domain to your store</p>
      </div>

      {stores.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Globe className="text-gray-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Stores Yet</h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">Create a store to connect a custom domain.</p>
          <button onClick={() => router.push("/dashboard/stores")} className="btn-primary">
            Create Store
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {stores.map((store) => (
            <div key={store.id} className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{store.storeName}</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                     <p className="font-medium text-gray-900">Default Sell Up URL</p>
                     <p className="text-sm text-gray-600 break-all">
                       {storeHref(store.storeSlug, "", { absolute: true })}
                     </p>
                  </div>
                  <a
                    href={storeHref(store.storeSlug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline flex items-center gap-2"
                  >
                    <ExternalLink size={18} />
                    Visit
                  </a>
                </div>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Custom domain configuration is available on Business and Pro plans. Contact support to set up your domain.
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
