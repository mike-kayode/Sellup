"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Lock, Palette } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { canUseFeature, normalizePlan } from "@/lib/entitlements";

interface Store {
  id: string;
  storeName: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  logo: string;
  bannerImage: string;
  plan: string | null;
  template: string | null;
}

type TemplateId = "basic" | "showcase";

const DEFAULT_FORM = {
  primaryColor: "#25D366",
  accentColor: "#34D399",
  fontFamily: "Manrope",
  template: "basic" as TemplateId,
};

export default function AppearancePage() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Hydrate the form from a store row (colors/font may be null in the DB).
  function applyStoreToForm(store: Store) {
    setFormData({
      primaryColor: store.primaryColor || DEFAULT_FORM.primaryColor,
      accentColor: store.accentColor || DEFAULT_FORM.accentColor,
      fontFamily: store.fontFamily || DEFAULT_FORM.fontFamily,
      template: store.template === "showcase" ? "showcase" : "basic",
    });
  }

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
        const list: Store[] = data.stores || [];
        setStores(list);
        if (list.length > 0) {
          setSelectedStoreId(list[0].id);
          applyStoreToForm(list[0]);
        }
      }
    } catch (err) {
      console.error("Error loading stores:", err);
    } finally {
      setLoading(false);
    }
  }

  const selectedStore = stores.find((s) => s.id === selectedStoreId);
  const canUseShowcase = selectedStore
    ? canUseFeature("PRODUCT_LISTING_TEMPLATE", normalizePlan(selectedStore.plan))
    : false;
  // Custom storefront logos are a paid-plan perk (Starter and above).
  const canUseLogo = selectedStore
    ? canUseFeature("CUSTOM_LOGO", normalizePlan(selectedStore.plan))
    : false;

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedStoreId) return;
    if (file.size > 1024 * 1024) {
      setSaveStatus({
        type: "error",
        message: "Logo must be 1 MB or smaller. Recommended: 512×512px.",
      });
      e.target.value = "";
      return;
    }
    setUploadingLogo(true);
    setSaveStatus(null);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setSaveStatus({
          type: "error",
          message: "Your session has expired. Please sign in again.",
        });
        return;
      }

      const fd = new FormData();
      fd.append("file", file);
      fd.append("storeId", selectedStoreId);
      fd.append("folder", "logos");
      const up = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok) {
        setSaveStatus({
          type: "error",
          message:
            (typeof upData?.error === "string" && upData.error) ||
              "Logo upload failed.",
        });
        return;
      }

      const put = await fetch("/api/stores/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: selectedStoreId, logo: upData.url }),
      });
      if (!put.ok) {
        const d = await put.json().catch(() => ({}));
        setSaveStatus({
          type: "error",
          message:
            (typeof d?.error === "string" && d.error) || "Failed to save logo.",
        });
        return;
      }

      setStores((prev) =>
        prev.map((s) =>
          s.id === selectedStoreId ? { ...s, logo: upData.url } : s
        )
      );
      setSaveStatus({
        type: "success",
        message: "Logo updated. Refresh your storefront to see it live.",
      });
    } catch {
      setSaveStatus({ type: "error", message: "Network error — please try again." });
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  }

  function selectStore(id: string) {
    setSelectedStoreId(id);
    const store = stores.find((s) => s.id === id);
    if (store) applyStoreToForm(store);
    setSaveStatus(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveStatus(null);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setSaveStatus({
          type: "error",
          message: "Your session has expired. Please sign in again.",
        });
        return;
      }

      // The update API expects the PUT method and the store `id`.
      const res = await fetch("/api/stores/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: selectedStoreId,
          ...formData,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveStatus({
          type: "error",
          message:
            (typeof data?.error === "string" && data.error) ||
            "Failed to save changes. Please try again.",
        });
        return;
      }

      setStores((prev) =>
        prev.map((s) =>
          s.id === selectedStoreId
            ? {
                ...s,
                primaryColor: formData.primaryColor,
                accentColor: formData.accentColor,
                fontFamily: formData.fontFamily,
                template: formData.template,
              }
            : s
        )
      );
      setSaveStatus({
        type: "success",
        message: "Appearance saved. Refresh your storefront to see it live.",
      });
    } catch {
      setSaveStatus({
        type: "error",
        message: "Network error — please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Appearance</h1>
          <p className="text-gray-600">Customize your storefront design</p>
        </div>
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Palette className="text-gray-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Create a Store First</h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">You need a store to customize appearance.</p>
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Appearance</h1>
        <p className="text-gray-600">Customize your storefront design</p>
      </div>

      {stores.length > 1 && (
        <div className="mb-6">
          <select
            value={selectedStoreId}
            onChange={(e) => selectStore(e.target.value)}
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
        {/* Store logo (paid plans) */}
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-900">
            Store Logo
          </label>
          <p className="mb-3 text-xs text-gray-500">
            Recommended: 512×512px square PNG or JPG with a transparent
            background, max 1 MB. It appears in your storefront header.
          </p>
          {canUseLogo ? (
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                {selectedStore?.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- merchant logo URL
                  <img
                    src={selectedStore.logo}
                    alt="Store logo"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-gray-400">No logo</span>
                )}
              </div>
              <div className="min-w-0">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#25D366] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#1da857] disabled:opacity-50"
                />
                {uploadingLogo && (
                  <p className="mt-1 text-xs text-gray-500">Uploading…</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-amber-800">
                Custom store logos are available on paid plans (Starter and
                above).
              </p>
              <Link
                href="/dashboard/settings"
                className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-amber-600"
              >
                Upgrade plan
              </Link>
            </div>
          )}
        </div>

        {/* Template picker */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Storefront Template
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setFormData({ ...formData, template: "basic" });
                setSaveStatus(null);
              }}
              className={`relative rounded-2xl border-2 p-4 text-left transition ${
                formData.template === "basic"
                  ? "border-[#25D366] bg-[#f0fdf4]"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="mb-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="h-4 border-b border-gray-200 bg-gray-100" />
                <div className="grid grid-cols-3 gap-1.5 p-2">
                  <div className="aspect-square rounded bg-gray-100" />
                  <div className="aspect-square rounded bg-gray-100" />
                  <div className="aspect-square rounded bg-gray-100" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">Basic</span>
                <span className="text-xs font-medium text-gray-500">Free</span>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                Clean product grid with WhatsApp checkout. Included in every plan.
              </p>
              {formData.template === "basic" && (
                <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#25D366] text-white">
                  <CheckCircle2 size={14} />
                </span>
              )}
            </button>

            <button
              type="button"
              disabled={!canUseShowcase}
              onClick={() => {
                if (!canUseShowcase) return;
                setFormData({ ...formData, template: "showcase" });
                setSaveStatus(null);
              }}
              className={`relative rounded-2xl border-2 p-4 text-left transition ${
                !canUseShowcase
                  ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-75"
                  : formData.template === "showcase"
                    ? "border-[#25D366] bg-[#f0fdf4]"
                    : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="mb-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="h-5 bg-gradient-to-r from-[#128C7E] to-[#25D366]" />
                <div className="grid grid-cols-3 gap-1.5 p-2">
                  <div className="aspect-square rounded bg-[#DCF8C6]" />
                  <div className="aspect-square rounded bg-[#DCF8C6]" />
                  <div className="aspect-square rounded bg-[#DCF8C6]" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">Showcase</span>
                {canUseShowcase ? (
                  <span className="text-xs font-medium text-[#128C7E]">
                    Included
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    <Lock size={11} /> ₦5,000/mo
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-600">
                Premium listing with banner hero, category chips and featured
                picks.
              </p>
              {canUseShowcase && formData.template === "showcase" && (
                <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#25D366] text-white">
                  <CheckCircle2 size={14} />
                </span>
              )}
              {!canUseShowcase && (
                <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-gray-500">
                  <Lock size={13} />
                </span>
              )}
            </button>
          </div>
          {!canUseShowcase && (
            <div className="mt-3 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-amber-800">
                The Showcase product listing template is included in the
                ₦5,000/month Starter plan and above.
              </p>
              <Link
                href="/pricing"
                className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-amber-600"
              >
                Upgrade plan
              </Link>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Primary Color</label>
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={formData.primaryColor}
              onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
              className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
            />
            <input
              type="text"
              value={formData.primaryColor}
              onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
              className="input max-w-xs"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Accent Color</label>
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={formData.accentColor}
              onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
              className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
            />
            <input
              type="text"
              value={formData.accentColor}
              onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
              className="input max-w-xs"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Font Family</label>
          <select
            value={formData.fontFamily}
            onChange={(e) => setFormData({ ...formData, fontFamily: e.target.value })}
            className="input"
          >
            <option value="Manrope">Manrope</option>
            <option value="Inter">Inter</option>
            <option value="Roboto">Roboto</option>
            <option value="Open Sans">Open Sans</option>
          </select>
        </div>

        {saveStatus && (
          <div
            role="status"
            className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
              saveStatus.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {saveStatus.type === "success" ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
            )}
            <span>{saveStatus.message}</span>
          </div>
        )}

        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
