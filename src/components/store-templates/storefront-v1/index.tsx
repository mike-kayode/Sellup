"use client";

/** Storefront v1 — shared mobile template. Design locked. */

import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Clock,
  Gift,
  Home as HomeIcon,
  Lock,
  LayoutGrid,
  Medal,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Truck,
  User,
  X,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import type { StoreConfig } from "@/lib/storefront/config";
import { themeToCssVars, type StorefrontTheme } from "@/lib/storefront/theme";
import { WhatsAppChatButton } from "@/components/storefront/whatsapp-chat-button";
import { ThemeProvider, useTheme } from "@/components/storefront/theme-provider";
import { AnnouncementBar } from "@/components/storefront/announcement-bar";
import { TrustBadges } from "@/components/storefront/trust-badges";
import { PremiumProductCard } from "@/components/storefront/premium-product-card";
import {
  BrandAvatar,
  CategoryChips,
  EmptyState,
  HeroBanner,
  presetIcon,
  productImage,
  VerifiedBadge,
  type StorefrontCategory,
  type StorefrontProduct,
  type StorefrontStore,
  type StorefrontTab,
  formatNaira,
} from "./parts";

export interface StorefrontV1Props {
  store: StorefrontStore;
  products: StorefrontProduct[];
  categories: StorefrontCategory[];
  config: StoreConfig;
  theme: StorefrontTheme;
  /** Product links are inert in preview mode. */
  preview?: boolean;
}

export function StorefrontV1({
  store,
  products,
  categories,
  config,
  theme,
  preview = false,
}: StorefrontV1Props) {
  const { cart, addToCart, removeFromCart } = useCart();
  const [tab, setTab] = useState<StorefrontTab>("home");
  const [device, setDevice] = useState<"mobile" | "desktop" | "tablet">("mobile");

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(ua)) setDevice("tablet");
    else if (/mobi|android|iphone|ipod/i.test(ua)) setDevice("mobile");
    else setDevice("desktop");
  }, []);
  const [chip, setChip] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  const cartCount = cart.items.reduce((n, item) => n + item.quantity, 0);

  const goToCheckout = () => {
    if (cart.items.length === 0) return;
    router.push(`/${store.storeSlug}/checkout`);
  };

  // Resolve chips (catalog id, preset id or name) to category ids.
  const chipIds = useMemo(() => {
    const map = new Map<string, string[]>();
    map.set("all", []);
    for (const c of config.categories) {
      const ids: string[] = [];
      if (c.id && !c.id.startsWith("preset-")) ids.push(c.id);
      for (const cat of categories) {
        if (cat.name.trim().toLowerCase() === c.name.trim().toLowerCase()) ids.push(cat.id);
      }
      map.set(c.id || c.name, ids);
    }
    return map;
  }, [config.categories, categories]);

  const filtered = useMemo(() => {
    let list = products;
    const ids = chipIds.get(chip);
    if (chip !== "all" && ids && ids.length > 0) {
      list = list.filter((p) => p.categoryId && ids.includes(p.categoryId));
    }
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    return [...list].sort(
      (a, b) => Number(b.isFeatured ?? false) - Number(a.isFeatured ?? false)
    );
  }, [products, chipIds, chip, query]);

  const gridProducts =
    showAll || chip !== "all" || query.trim() ? filtered : filtered.slice(0, 8);

  const add = (p: StorefrontProduct) =>
    addToCart({
      productId: p.id,
      name: p.name,
      price: p.price,
      image: productImage(p) ?? undefined,
      quantity: 1,
    });

  const productHref = (id: string) =>
    preview ? null : `/${store.storeSlug}/products/${id}`;

  const whatsappNumber = (config.contact.whatsapp || store.whatsappNumber || "")
    .replace(/[^0-9]/g, "")
    .replace(/^0/, "234");

  const countInCategory = (ids: string[] | undefined) =>
    ids && ids.length > 0
      ? products.filter((p) => p.categoryId && ids.includes(p.categoryId)).length
      : products.length;

  return (
    <ThemeProvider defaultMode={config.themeMode}>
      <div className="flex min-h-screen justify-center bg-slate-100">
        <AnnouncementBar bar={config.announcementBar} />
        <div
          className="relative w-full max-w-[430px] bg-white shadow-xl"
          style={themeToCssVars(theme) as CSSProperties}
        >
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3">
          <BrandAvatar config={config} theme={theme} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-[17px] font-extrabold text-slate-900">
                {config.brand.name || store.storeName}
              </h1>
              {config.brand.verified && (
                <VerifiedBadge className="h-[18px] w-[18px] shrink-0" />
              )}
            </div>
            {(config.brand.tagline || config.vertical) && (
              <p className="truncate text-[12px] text-slate-500">
                {config.brand.tagline ||
                  `${config.vertical.charAt(0).toUpperCase()}${config.vertical.slice(1)}`}
              </p>
            )}
            {config.trustBadges.enabled && config.trustBadges.badges.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {config.trustBadges.badges.map((b, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-600"
                    aria-label={b.label}
                  >
                    {b.icon === "truck" && <Truck size={10} className="text-slate-500" aria-hidden />}
                    {b.icon === "shield" && <ShieldCheck size={10} className="text-slate-500" aria-hidden />}
                    {b.icon === "lock" && <Lock size={10} className="text-slate-500" aria-hidden />}
                    {b.icon === "gift" && <Gift size={10} className="text-slate-500" aria-hidden />}
                    {b.icon === "refresh" && <RefreshCw size={10} className="text-slate-500" aria-hidden />}
                    {b.icon === "medal" && <Medal size={10} className="text-slate-500" aria-hidden />}
                    {b.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label={searchOpen ? "Close search" : "Search products"}
            onClick={() => {
              setSearchOpen((v) => !v);
              if (searchOpen) setQuery("");
            }}
            className="grid h-10 w-10 place-items-center rounded-full text-slate-600"
          >
            {searchOpen ? <X size={20} /> : <Search size={20} />}
          </button>
          <button
            type="button"
            aria-label={`Cart, ${cartCount} items`}
            onClick={() => setTab("home")}
            className="relative grid h-10 w-10 place-items-center rounded-full text-slate-700"
          >
            <ShoppingCart size={22} />
            {cartCount > 0 && (
              <span
                className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-extrabold"
                style={{ backgroundColor: theme.brand, color: theme.onBrand }}
              >
                {cartCount}
              </span>
            )}
          </button>
        </header>

        {searchOpen && (
          <div className="border-b border-slate-100 bg-white px-4 py-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              aria-label="Search products"
              className="h-10 w-full rounded-full bg-slate-100 px-4 text-[14px] text-slate-800 outline-none"
            />
          </div>
        )}

        <main className="pb-28">
          {tab === "home" && (
            <>
              <HeroBanner
                config={config}
                theme={theme}
                onCta={() => {
                  setChip("all");
                  setShowAll(true);
                }}
              />
              <CategoryChips
                config={config}
                theme={theme}
                active={chip}
                onSelect={(id) => {
                  setChip(id);
                  setShowAll(true);
                }}
              />
              <section className="mt-6 px-[14px]">
                <div className="flex items-center justify-between">
                  <h3 className="text-[17px] font-extrabold text-slate-900">
                    Featured Products
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="text-[13px] font-bold"
                    style={{ color: theme.brand }}
                  >
                    {showAll ? "Less" : "See All"} →
                  </button>
                </div>
                {gridProducts.length === 0 ? (
                  <EmptyState
                    title={query.trim() ? "No matches" : "No products yet"}
                    message={
                      query.trim()
                        ? `Nothing matches “${query.trim()}”.`
                        : "This store hasn't added products yet."
                    }
                  />
                ) : (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {gridProducts.map((p) => (
                      <PremiumProductCard
                        key={p.id}
                        product={p}
                        storeSlug={store.storeSlug}
                        onAdd={() => add(p)}
                        className="h-full"
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {tab === "categories" && (
            <section className="px-4 pt-4">
              <h3 className="text-[22px] font-extrabold text-slate-900">Categories</h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {config.categories.map((c) => {
                  const ids = chipIds.get(c.id || c.name);
                  const Icon = presetIcon(c.icon);
                  return (
                    <button
                      key={c.id || c.name}
                      type="button"
                      onClick={() => {
                        setChip(c.id || c.name);
                        setShowAll(true);
                        setTab("home");
                      }}
                      className="flex items-center gap-3 rounded-[14px] border border-slate-100 bg-white p-4 text-left shadow-sm"
                    >
                      <span
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
                        style={{ backgroundColor: theme.brandSoft, color: theme.brandDeep }}
                      >
                        <Icon size={20} aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-bold text-slate-900">
                          {c.name}
                        </span>
                        <span className="block text-[12px] text-slate-500">
                          {countInCategory(ids)} item{countInCategory(ids) === 1 ? "" : "s"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

              {tab === "account" && (
                <section
                  aria-label="Customer account"
                  className="p-4 space-y-4 max-w-[430px] mx-auto"
                >
                  <h2 className="text-[16px] font-extrabold text-slate-900">
                    Your Account
                  </h2>
                  {cart.items.length > 0 ? (
                    <>
                      <div className="space-y-3">
                        <p className="text-[13px] font-medium text-slate-700">
                          Items in cart: {cartCount}
                        </p>
                        {cart.items.map((item) => (
                          <div
                            key={item.productId}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50"
                          >
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="h-10 w-10 rounded object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded flex items-center justify-center text-slate-400">
                                🛍️
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-slate-900 truncate">
                                {item.name}
                              </p>
                              <p className="text-[12px] text-slate-500">
                                {formatNaira(item.price)} × {item.quantity}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.productId)}
                              aria-label="Remove from cart"
                              className="p-1 text-slate-400 hover:text-slate-600"
                            >
                              <X size={16} aria-hidden />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <p className="text-[14px] font-bold text-slate-900">
                          Total: {formatNaira(cart.total)}
                        </p>
                        <button
                          type="button"
                          onClick={goToCheckout}
                          className="mt-3 w-full h-11 rounded-xl bg-[#25D366] px-4 py-2 text-[14px] font-bold text-white hover:bg-[#1EBE54] transition"
                        >
                          Proceed to Checkout
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-400">
                        <User size={28} aria-hidden />
                      </div>
                      <h3 className="text-[15px] font-extrabold text-slate-900">
                        Your cart is empty
                      </h3>
                      <p className="text-[13px] text-slate-500">
                        Browse products and add items to your cart.
                      </p>
                    </div>
                  )}
                </section>
              )}

        </main>

        {/* Bottom menu + engraved "Powered by Sell Up" (spec section 3) */}
        <nav
          aria-label="Store menu"
          className={
            preview
              ? "sticky bottom-0 z-40 w-full border-t border-slate-100 bg-white"
              : "fixed bottom-0 left-0 right-0 z-40 mx-auto w-full max-w-[430px] border-t border-slate-100 bg-white"
          }
        >
          <ul className="flex items-stretch justify-around pt-2">
            {(
              [
                { id: "home" as const, label: "Home", Icon: HomeIcon },
                { id: "categories" as const, label: "Categories", Icon: LayoutGrid },
                { id: "cart" as const, label: "Cart", Icon: ShoppingCart },
                { id: "account" as const, label: "Account", Icon: User },
              ] satisfies { id: StorefrontTab; label: string; Icon: typeof HomeIcon }[]
            ).map(({ id, label, Icon }) => {
              const active = tab === id;
              const isCart = id === "cart";
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setTab(id)}
                    aria-current={active ? "page" : undefined}
                    className="flex h-[52px] w-16 flex-col items-center justify-center gap-1 relative"
                    style={{ color: active ? theme.brand : "#64748B" }}
                  >
                    <Icon
                      size={21}
                      aria-hidden
                      style={active ? { fill: "currentColor" } : undefined}
                    />
                    {isCart && cartCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#DCF8C6] px-0.5 text-[10px] font-bold text-[#128C7E] border border-white">
                        {cartCount}
                      </span>
                    )}
                    <span className="text-[11px] font-bold">{label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {/* Engraved, non-interactive, always present. Only a future
              white-label (server-side) flag may ever hide this. */}
          <div
            aria-hidden
            className="pointer-events-none select-none pb-[10px] pt-[3px] text-center text-[8.5px] font-bold uppercase tracking-[0.28em]"
            style={{
              color: "rgba(100,116,139,0.35)",
              textShadow: "0 1px 0 rgba(255,255,255,0.9), 0 -1px 0 rgba(15,23,42,0.06)",
            }}
          >
            Powered by SellUp
          </div>
        </nav>
        {/* WhatsApp chat button (Phase 2.1) */}
        {config.whatsappChat && (
          <WhatsAppChatButton
            config={config.whatsappChat}
            store={{
              storeName: store.storeName,
              storeSlug: store.storeSlug,
            }}
            page={tab === "cart" ? "cart" : "home"}
            device={device}
          />
        )}
      </div>
    </div>
    </ThemeProvider>
  );
}
