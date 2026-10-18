"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Copy, Globe, Eye, Settings, Save } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { storeHref } from "@/lib/urls";

interface Store {
  id: string;
  storeName: string;
  storeSlug: string;
  whatsappNumber: string;
  description: string | null;
  isPublished: boolean;
  primaryColor: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  aboutText: string | null;
}

export default function StoreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = params.id as string;
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    storeName: "",
    whatsappNumber: "",
    email: "",
    phone: "",
    description: "",
    address: "",
    city: "",
    state: "",
    aboutText: "",
    primaryColor: "#25D366",
  });

  async function getToken(): Promise<string | null> {
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  async function loadStore() {
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
        const found = (data.stores || []).find((s: Store) => s.id === storeId);
        if (found) {
          setStore(found);
          setFormData({
            storeName: found.storeName,
            whatsappNumber: found.whatsappNumber,
            email: found.email || "",
            phone: found.phone || "",
            description: found.description || "",
            address: found.address || "",
            city: found.city || "",
            state: found.state || "",
            aboutText: found.aboutText || "",
            primaryColor: found.primaryColor || "#25D366",
          });
        } else {
          setError("Store not found");
        }
      }
    } catch (err) {
      console.error("Error loading store:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function execute() {
      await loadStore();
    }
    execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    setSaved(false);
    try {
      const token = await getToken();
      if (!token) {
        setSaving(false);
        return;
      }
      const res = await fetch("/api/stores/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: storeId,
          storeName: formData.storeName,
          whatsappNumber: formData.whatsappNumber,
          email: formData.email || null,
          phone: formData.phone || null,
          description: formData.description || null,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          aboutText: formData.aboutText || null,
          primaryColor: formData.primaryColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save changes");
        setSaving(false);
        return;
      }
      setSaved(true);
      setStore((prev) => (prev ? { ...prev, ...formData } : prev));
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="h-40 bg-gray-100 animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="card p-12 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {error || "Store not found"}
        </h2>
        <button onClick={() => router.push("/dashboard/stores")} className="btn-primary">
          Back to Stores
        </button>
      </div>
    );
  }

  const storeUrl = storeHref(store.storeSlug, "", { absolute: true });

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Store Settings</h1>
        <p className="text-gray-600">Manage your store details and appearance</p>
      </div>

      {saved && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          ✓ Changes saved successfully
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Store URL */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Globe size={24} /> Store URL
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                <code className="text-sm text-gray-600 break-all">
                  {storeUrl}
                </code>
                <button
                  onClick={() => copyToClipboard(storeUrl)}
                  className="ml-4 p-2 hover:bg-gray-200 rounded-lg transition flex-shrink-0"
                >
                  <Copy size={18} className="text-gray-600" />
                </button>
              </div>
              {copied && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  ✓ Copied to clipboard
                </p>
              )}
              <p className="text-sm text-gray-600">
                Share this link with customers to access your store
              </p>
            </div>
          </div>

          {/* Store Details */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Settings size={24} /> Store Details
            </h2>
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">
                {error}
              </div>
            )}
            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Store Name
                </label>
                <input
                  type="text"
                  value={formData.storeName}
                  onChange={(e) =>
                    setFormData({ ...formData, storeName: e.target.value })
                  }
                  className="input"
                  required
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  value={formData.whatsappNumber}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      whatsappNumber: e.target.value,
                    })
                  }
                  className="input"
                  required
                  disabled={saving}
                />
                <p className="text-xs text-gray-600 mt-1">
                  Orders will be sent to this number
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Store Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="input"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Store Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="input"
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    className="input"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) =>
                      setFormData({ ...formData, state: e.target.value })
                    }
                    className="input"
                    disabled={saving}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  className="input"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="input min-h-20 resize-none"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  About Text
                </label>
                <textarea
                  value={formData.aboutText}
                  onChange={(e) =>
                    setFormData({ ...formData, aboutText: e.target.value })
                  }
                  className="input min-h-20 resize-none"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Primary Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        primaryColor: e.target.value,
                      })
                    }
                    className="w-12 h-12 rounded-lg border border-gray-200"
                    disabled={saving}
                  />
                  <span className="text-sm text-gray-600">
                    {formData.primaryColor}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save size={18} /> {saving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Preview */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Eye size={24} /> Preview
            </h2>
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 border border-[#25D366] rounded-xl text-center hover:bg-[#f0f9ff] transition"
            >
              <p className="text-sm text-gray-600 mb-2">View Live Store</p>
              <p className="text-[#25D366] font-bold">Open Store →</p>
            </a>
          </div>

          {/* Publish Status */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Status</h2>
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-3 h-3 rounded-full ${
                  store.isPublished ? "bg-green-500" : "bg-gray-400"
                }`}
              ></div>
              <span className="text-sm font-medium">
                {store.isPublished ? "Published" : "Draft"}
              </span>
            </div>
            <button
              onClick={async () => {
                const token = await getToken();
                if (!token) return;
                await fetch("/api/stores/update", {
                  method: "PUT",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    id: storeId,
                    isPublished: !store.isPublished,
                  }),
                });
                loadStore();
              }}
              className="btn-secondary w-full text-sm"
            >
              {store.isPublished ? "Unpublish Store" : "Publish Store"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
