"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { storeHref } from "@/lib/urls";

interface Store {
  id: string;
  storeName: string;
  storeSlug: string;
  description: string;
}

export default function SeoPage() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ seoTitle: "", metaDescription: "" });

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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      await fetch("/api/stores/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          storeId: selectedStoreId,
          description: formData.metaDescription,
        }),
      });
    } catch {
      // ignore
    } finally {
      setSaving(false);
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

  if (stores.length === 0) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">SEO</h1>
          <p className="text-gray-600">Optimize your store for search engines</p>
        </div>
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Search className="text-gray-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Create a Store First</h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">You need a store to configure SEO.</p>
          <button onClick={() => router.push("/dashboard/stores")} className="btn-primary">
            Create Store
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">SEO</h1>
        <p className="text-gray-600">Optimize your store for search engines</p>
      </div>

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

      <form onSubmit={handleSave} className="card p-6 max-w-2xl space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">SEO Title</label>
          <input
            type="text"
            value={formData.seoTitle}
            onChange={(e) => setFormData({ ...formData, seoTitle: e.target.value })}
            className="input"
            placeholder="My Awesome Store"
          />
          <p className="text-sm text-gray-600 mt-1">Recommended: 50-60 characters</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Meta Description</label>
          <textarea
            rows={3}
            value={formData.metaDescription}
            onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
            className="input min-h-24 resize-none"
            placeholder="Describe your store..."
          />
          <p className="text-sm text-gray-600 mt-1">Recommended: 150-160 characters</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Search Preview</h3>
          <div className="bg-white p-3 rounded border border-gray-200">
            <p className="text-blue-600 text-lg font-medium">{formData.seoTitle || "Your Store Name"}</p>
            <p className="text-green-700 text-sm break-all">
              {storeHref(
                stores.find((s) => s.id === selectedStoreId)?.storeSlug ||
                  "your-store",
                "",
                { absolute: true }
              )}
            </p>
            <p className="text-gray-600 text-sm mt-1">{formData.metaDescription || "Your store description will appear here..."}</p>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
          {saving ? "Saving..." : "Save SEO Settings"}
        </button>
      </form>
    </div>
  );
}
