"use client";

/** Store design wizard — live phone preview renders the real storefront. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Paintbrush,
  Rocket,
  Save,
  Smartphone,
  Upload,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { validateImageFile } from "@/lib/supabase/storage";
import { CartProvider } from "@/lib/cart-context";
import { StorefrontV1 } from "@/components/store-templates/storefront-v1";
import {
  VERTICALS,
  VERTICAL_PRESETS,
  normalizeVertical,
} from "@/lib/storefront/presets";
import { deriveThemeTokens } from "@/lib/storefront/theme";
import type { StoreConfig } from "@/lib/storefront/config";

interface Store {
  id: string;
  storeName: string;
  storeSlug: string;
  logo: string | null;
  bannerImage: string | null;
  whatsappNumber: string | null;
  plan: string | null;
}

interface CatalogCategory {
  id: string;
  name: string;
}

interface CatalogProduct {
  id: string;
  name: string;
  price: string;
  images: unknown;
  stock: number | null;
  isFeatured: boolean | null;
  categoryId: string | null;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function StoreDesignPage() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [store, setStore] = useState<Store | null>(null);
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [publishing, setPublishing] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [copied, setCopied] = useState(false);
  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadConfig = useCallback(async (token: string, storeId: string) => {
    const res = await fetch(
      `/api/merchant/store-config?storeId=${encodeURIComponent(storeId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error("Failed to load store config");
    const data = await res.json();
    setConfig(data.config as StoreConfig);
    setStore(data.store as Store);
    setCatalogCategories((data.categories || []) as CatalogCategory[]);
    setCatalogProducts((data.products || []) as CatalogProduct[]);
    setPublishedAt(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
        if (!res.ok) throw new Error("Failed to load stores");
        const list: Store[] = (await res.json()).stores || [];
        if (cancelled) return;
        setStores(list);
        if (list.length > 0) {
          setSelectedStoreId(list[0].id);
          await loadConfig(session.access_token, list[0].id);
        }
      } catch (err) {
        console.error("Store design load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, loadConfig]);

  const theme = useMemo(
    () => deriveThemeTokens(config?.brand.color ?? null),
    [config?.brand.color]
  );

  const patchConfig = useCallback(
    (patch: (current: StoreConfig) => StoreConfig) => {
      dirty.current = true;
      setSaveState("idle");
      setConfig((current) => (current ? patch(current) : current));
    },
    []
  );

  // Autosave the draft 1.2s after the last edit.
  useEffect(() => {
    if (!config || !selectedStoreId || !dirty.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        setSaveState("saving");
        const res = await fetch("/api/merchant/store-config", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ storeId: selectedStoreId, config }),
        });
        if (!res.ok) throw new Error("Save failed");
        dirty.current = false;
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 1200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [config, selectedStoreId]);

  const switchStore = async (storeId: string) => {
    setSelectedStoreId(storeId);
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) await loadConfig(session.access_token, storeId);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (verticalInput: string) => {
    const vertical = normalizeVertical(verticalInput);
    const preset = VERTICAL_PRESETS[vertical];
    patchConfig((c) => ({
      ...c,
      vertical,
      hero: { ...c.hero, title: preset.heroTitle, subtitle: preset.heroSubtitle },
      brand: { ...c.brand, color: preset.brandColor },
      categories: preset.defaultCategories.map((pc) => {
        const match = catalogCategories.find(
          (cc) => cc.name.trim().toLowerCase() === pc.name.trim().toLowerCase()
        );
        return { id: match ? match.id : `preset-${pc.icon}`, name: pc.name, icon: pc.icon };
      }),
    }));
  };

  const toggleCategory = (cat: CatalogCategory) => {
    patchConfig((c) => {
      const has = c.categories.some((x) => x.id === cat.id);
      if (has) return { ...c, categories: c.categories.filter((x) => x.id !== cat.id) };
      if (c.categories.length >= 3) return c;
      const preset = VERTICAL_PRESETS[c.vertical] || VERTICAL_PRESETS.general;
      return {
        ...c,
        categories: [
          ...c.categories,
          {
            id: cat.id,
            name: cat.name,
            icon: preset.defaultCategories[c.categories.length]?.icon || "grid",
          },
        ],
      };
    });
  };

  const authedPost = async (path: string, body: unknown) => {
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Not signed in");
    return fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
  };

  const uploadBrandLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const validation = validateImageFile(file, 1024 * 1024);
    if (!validation.valid) {
      setNotice({ type: "error", message: validation.error || "Choose a valid logo image." });
      event.target.value = "";
      return;
    }

    setUploadingLogo(true);
    setNotice(null);
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Your session has expired. Please sign in again.");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("storeId", selectedStoreId);
      formData.append("folder", "logos");
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || typeof result.url !== "string") {
        throw new Error(result.error || "Logo upload failed.");
      }

      patchConfig((current) => ({
        ...current,
        brand: { ...current.brand, logo: result.url },
      }));
      setStore((current) => current ? { ...current, logo: result.url } : current);
      setNotice({ type: "success", message: "Logo uploaded to your store media." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Logo upload failed.",
      });
    } finally {
      setUploadingLogo(false);
      event.target.value = "";
    }
  };

  const publish = async () => {
    setPublishing(true);
    setNotice(null);
    try {
      const res = await authedPost("/api/merchant/store-config/publish", {
        storeId: selectedStoreId,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      setPublishedAt(data.publishedAt);
      setNotice({ type: "success", message: "Published — your live store is updated." });
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Publish failed",
      });
    } finally {
      setPublishing(false);
    }
  };

  const mintPreviewLink = async () => {
    setPreviewLoading(true);
    setNotice(null);
    try {
      const res = await authedPost("/api/merchant/store-config/preview-token", {
        storeId: selectedStoreId,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create preview link");
      setPreviewUrl(data.url);
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Preview link failed",
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-slate-500">
        <Loader2 className="animate-spin" size={28} aria-hidden />
      </div>
    );
  }

  if (!config || !store) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-6 text-center">
        <div>
          <Paintbrush className="mx-auto mb-3 text-slate-300" size={36} aria-hidden />
          <h1 className="text-lg font-extrabold text-slate-900">No store yet</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create a business first, then design its storefront here.
          </p>
        </div>
      </div>
    );
  }

  const inputCls =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-400";
  const labelCls = "mb-1 block text-[13px] font-bold text-slate-700";
  const cardCls = "rounded-2xl border border-slate-100 bg-white p-5 shadow-sm";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
            <Paintbrush size={22} aria-hidden /> Store design
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Change anything and the phone updates live. Nothing is public until you publish.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stores.length > 1 && (
            <select
              value={selectedStoreId}
              onChange={(e) => switchStore(e.target.value)}
              className={`${inputCls} w-52`}
              aria-label="Select store"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.storeName}
                </option>
              ))}
            </select>
          )}
          <span className="text-[12px] font-semibold text-slate-500">
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Draft saved"
                : saveState === "error"
                  ? "Save failed"
                  : publishedAt
                    ? "Published"
                    : "Draft"}
          </span>
        </div>
      </div>

      {notice && (
        <div
          className={`mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-[13px] font-semibold ${
            notice.type === "success"
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-700"
          }`}
          role="status"
        >
          {notice.type === "success" ? (
            <CheckCircle2 size={16} aria-hidden />
          ) : (
            <AlertCircle size={16} aria-hidden />
          )}
          {notice.message}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-5">
          <section className={cardCls}>
            <h2 className="text-[15px] font-extrabold text-slate-900">Business type</h2>
            <p className="mb-3 text-[12px] text-slate-500">
              Pre-fills suggestions below. Everything stays editable.
            </p>
            <div className="flex flex-wrap gap-2">
              {VERTICALS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => applyPreset(v)}
                  className="h-9 rounded-full px-4 text-[13px] font-bold transition"
                  style={
                    config.vertical === v
                      ? { backgroundColor: theme.brand, color: theme.onBrand }
                      : { backgroundColor: "#F1F5F9", color: "#475569" }
                  }
                >
                  {VERTICAL_PRESETS[v].label}
                </button>
              ))}
            </div>
          </section>

          <section className={cardCls}>
            <h2 className="mb-3 text-[15px] font-extrabold text-slate-900">Brand</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="brand-name">
                  Business name
                </label>
                <input
                  id="brand-name"
                  className={inputCls}
                  value={config.brand.name}
                  maxLength={120}
                  onChange={(e) =>
                    patchConfig((c) => ({ ...c, brand: { ...c.brand, name: e.target.value } }))
                  }
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="brand-tagline">
                  Tagline
                </label>
                <input
                  id="brand-tagline"
                  className={inputCls}
                  value={config.brand.tagline}
                  maxLength={160}
                  placeholder="Fashion · Beauty · Lifestyle"
                  onChange={(e) =>
                    patchConfig((c) => ({
                      ...c,
                      brand: { ...c.brand, tagline: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="brand-logo">
                  Upload logo (square, 256px+)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  {config.brand.logo && (
                    // eslint-disable-next-line @next/next/no-img-element -- uploaded cPanel logo preview
                    <img
                      src={config.brand.logo}
                      alt="Current store logo"
                      className="h-14 w-14 rounded-lg border border-slate-200 object-cover"
                    />
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <Upload size={16} aria-hidden />
                    {uploadingLogo ? "Uploading…" : config.brand.logo ? "Replace logo" : "Choose image"}
                    <input
                      id="brand-logo"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={uploadBrandLogo}
                      disabled={uploadingLogo}
                      className="sr-only"
                    />
                  </label>
                  <span className="text-xs text-slate-500">PNG, JPG, WEBP or GIF · max 1 MB</span>
                </div>
              </div>
              <div>
                <label className={labelCls} htmlFor="brand-color">
                  Brand colour
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="brand-color"
                    type="color"
                    value={theme.brand}
                    onChange={(e) =>
                      patchConfig((c) => ({
                        ...c,
                        brand: { ...c.brand, color: e.target.value },
                      }))
                    }
                    className="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                    aria-label="Pick brand colour"
                  />
                  <input
                    className={inputCls}
                    value={config.brand.color}
                    onChange={(e) =>
                      patchConfig((c) => ({
                        ...c,
                        brand: { ...c.brand, color: e.target.value },
                      }))
                    }
                    aria-label="Brand colour hex"
                  />
                </div>
                {!theme.valid && theme.message && (
                  <p className="mt-1.5 text-[12px] font-semibold text-amber-600">
                    {theme.message}
                  </p>
                )}
                <p className="mt-1.5 text-[12px] text-slate-500">
                  Text colour on buttons adjusts automatically so it stays readable.
                </p>
              </div>
            </div>
          </section>
          <section className={cardCls}>
            <h2 className="mb-3 text-[15px] font-extrabold text-slate-900">Hero banner</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="hero-title">
                  Hero title (one line break max)
                </label>
                <textarea
                  id="hero-title"
                  className={`${inputCls} h-20 py-2`}
                  value={config.hero.title}
                  maxLength={140}
                  onChange={(e) =>
                    patchConfig((c) => ({ ...c, hero: { ...c.hero, title: e.target.value } }))
                  }
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="hero-subtitle">
                  Hero subtitle
                </label>
                <textarea
                  id="hero-subtitle"
                  className={`${inputCls} h-20 py-2`}
                  value={config.hero.subtitle}
                  maxLength={180}
                  onChange={(e) =>
                    patchConfig((c) => ({
                      ...c,
                      hero: { ...c.hero, subtitle: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="hero-image">
                  Hero image URL (16:9 or 2:1, under 2MB)
                </label>
                <input
                  id="hero-image"
                  className={inputCls}
                  value={config.hero.images[0] || ""}
                  placeholder="https://…/hero.jpg"
                  onChange={(e) =>
                    patchConfig((c) => ({
                      ...c,
                      hero: { ...c.hero, images: e.target.value ? [e.target.value] : [] },
                    }))
                  }
                />
              </div>
            </div>
          </section>

          <section className={cardCls}>
            <h2 className="mb-1 text-[15px] font-extrabold text-slate-900">Categories</h2>
            <p className="mb-3 text-[12px] text-slate-500">
              Pick up to 3 for the round chips on your storefront.
            </p>
            {catalogCategories.length === 0 ? (
              <p className="text-[13px] text-slate-500">
                No catalog categories yet — add them under Products → Categories first.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {catalogCategories.map((cat) => {
                  const active = config.categories.some((x) => x.id === cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      aria-pressed={active}
                      className="h-9 rounded-full px-4 text-[13px] font-bold transition"
                      style={
                        active
                          ? { backgroundColor: theme.brand, color: theme.onBrand }
                          : { backgroundColor: "#F1F5F9", color: "#475569" }
                      }
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className={cardCls}>
            <h2 className="mb-3 text-[15px] font-extrabold text-slate-900">
              Contact & WhatsApp
            </h2>
            <label className={labelCls} htmlFor="contact-whatsapp">
              WhatsApp number (customers can tap to chat)
            </label>
            <input
              id="contact-whatsapp"
              className={inputCls}
              value={config.contact.whatsapp}
              placeholder="08012345678"
              onChange={(e) =>
                patchConfig((c) => ({
                  ...c,
                  contact: { ...c.contact, whatsapp: e.target.value },
                }))
              }
            />
          </section>

          <section className={`${cardCls} flex flex-wrap items-center gap-3`}>
            <button
              type="button"
              onClick={publish}
              disabled={publishing}
              className="inline-flex h-11 items-center gap-2 rounded-full px-6 text-[14px] font-bold text-white disabled:opacity-60"
              style={{ backgroundColor: theme.valid ? theme.brand : "#16A34A" }}
            >
              {publishing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Rocket size={16} />
              )}
              Publish to live store
            </button>
            <button
              type="button"
              onClick={mintPreviewLink}
              disabled={previewLoading}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-[14px] font-bold text-slate-700 disabled:opacity-60"
            >
              {previewLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Smartphone size={16} />
              )}
              Preview on my phone
            </button>
            {saveState === "saved" && (
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-green-600">
                <CheckCircle2 size={14} /> Draft saved
              </span>
            )}
            <a
              href={`/${store.storeSlug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[13px] font-bold text-slate-600 hover:underline"
            >
              View live store <ExternalLink size={13} />
            </a>
            {previewUrl && (
              <div className="flex w-full items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                <code className="min-w-0 flex-1 truncate text-[12px] text-slate-600">
                  {previewUrl}
                </code>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(previewUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch {
                      /* clipboard blocked — link stays visible */
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-bold text-slate-700 ring-1 ring-slate-200"
                >
                  {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </section>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="mx-auto w-full max-w-[390px]">
            <div className="overflow-hidden rounded-[40px] border-[10px] border-slate-900 bg-white shadow-2xl">
              <div className="h-[640px] overflow-y-auto">
                <CartProvider key={store.storeSlug} storeSlug={store.storeSlug}>
                  <StorefrontV1
                    store={store}
                    products={catalogProducts}
                    categories={catalogCategories}
                    config={config}
                    theme={theme.valid ? theme : deriveThemeTokens(null)}
                    preview
                  />
                </CartProvider>
              </div>
            </div>
            <p className="mt-2 text-center text-[12px] text-slate-500">
              Live preview of your unsaved draft.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}