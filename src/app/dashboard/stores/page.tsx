"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Trash2, Eye } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { storeHref } from "@/lib/urls";

interface Store {
  id: string;
  storeName: string;
  storeSlug: string;
  whatsappNumber: string;
  isPublished: boolean;
}

export default function StoresPage() {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [formData, setFormData] = useState({
    storeName: "",
    whatsappNumber: "",
    description: "",
    email: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

      const response = await fetch("/api/stores/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const data = await response.json();
        setStores(data.stores);
      } else if (response.status === 401) {
        router.push("/login");
      }
    } catch (err) {
      console.error("Error loading stores:", err);
    }
  }

  useEffect(() => {
    async function execute() {
      await loadStores();
    }
    execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const token = await getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/stores/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to create store");
        setLoading(false);
        return;
      }

      router.push(`/dashboard/stores/${data.store.id}`);
    } catch (err) {
      setError("Failed to create store. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Stores</h1>
        <p className="text-gray-600">Create and manage your online stores</p>
      </div>

      {/* Existing Stores */}
      {stores.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Stores</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stores.map((store) => (
              <div key={store.id} className="card p-4 hover:shadow-lg transition">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900">
                      {store.storeName}
                    </h3>
                    <p className="text-xs text-gray-600">
                      {storeHref(store.storeSlug, "", { absolute: true })}
                    </p>
                  </div>
                  <div
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      store.isPublished
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {store.isPublished ? "Published" : "Draft"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/dashboard/stores/${store.id}`)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm btn-secondary rounded-lg"
                  >
                    <Eye size={16} /> Edit
                  </button>
                  <button
                    onClick={() => router.push(storeHref(store.storeSlug))}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm btn-secondary rounded-lg"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Form or Empty State */}
      {!showForm ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-[#DCF8C6] rounded-xl flex items-center justify-center mx-auto mb-4">
            <Plus className="text-[#25D366]" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {stores.length === 0
              ? "Create Your First Store"
              : "Add Another Store"}
          </h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            {stores.length === 0
              ? "Start selling on WhatsApp in minutes. No technical setup required."
              : "Expand your business with another online store."}
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            Create Store <ArrowRight size={20} />
          </button>
        </div>
      ) : (
        <div className="card p-8 max-w-2xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            New Store Details
          </h2>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Store Name */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Store Name *
              </label>
              <input
                type="text"
                value={formData.storeName}
                onChange={(e) =>
                  setFormData({ ...formData, storeName: e.target.value })
                }
                className="input"
                placeholder="e.g., Fashion Hub, Cake Vendor, etc."
                required
                disabled={loading}
                minLength={2}
              />
              <p className="text-xs text-gray-600 mt-1">
                This will be your store name customers see
              </p>
            </div>

            {/* WhatsApp Number */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                WhatsApp Number *
              </label>
              <input
                type="tel"
                value={formData.whatsappNumber}
                onChange={(e) =>
                  setFormData({ ...formData, whatsappNumber: e.target.value })
                }
                className="input"
                placeholder="+234 800 000 0000"
                required
                disabled={loading}
              />
              <p className="text-xs text-gray-600 mt-1">
                Orders will be sent to this number
              </p>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Store Email (Optional)
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="input"
                placeholder="store@example.com"
                disabled={loading}
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Store Phone (Optional)
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="input"
                placeholder="+234 800 000 0000"
                disabled={loading}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="input min-h-24 resize-none"
                placeholder="Tell customers about your store..."
                disabled={loading}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 btn-primary disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Store"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={loading}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
