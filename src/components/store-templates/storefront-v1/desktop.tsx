"use client";

/**
 * Storefront v1 — DESKTOP layout (≥1024px).
 *
 * Built for wide screens rather than stretching the phone layout:
 * sticky header with full search + cart drawer, full category bar, a large
 * editorial hero, a shop area with filter sidebar / sort / 4-column grid,
 * and a real footer. Phones keep the locked mobile template.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Check, ChevronDown, MessageCircle, PackageOpen, ShoppingBag, SlidersHorizontal } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import type { StoreConfig } from "@/lib/storefront/config";
import type { StorefrontTheme } from "@/lib/storefront/theme";
import { AnnouncementBar } from "@/components/storefront/announcement-bar";
import {
  CONTAINER,
  CartDrawer,
  StoreFooter,
  StoreHeader,
  TrustIcon,
  whatsappLink,
} from "./desktop-chrome";
import {
  formatNaira,
  type StorefrontCategory,
  type StorefrontProduct,
  type StorefrontStore,
} from "./parts";

/* eslint-disable @next/next/no-img-element */

type SortKey = "featured" | "price-asc" | "price-desc" | "name";
const PAGE_SIZE = 24;

function imagesOf(p: StorefrontProduct): string[] {
  return Array.isArray(p.images) ? p.images.filter((i): i is string => typeof i === "string" && i.length > 0) : [];
}

export function DesktopStorefront({
  store,
  products,
  categories,
  config,
  theme,
  preview = false,
  initialQuery = "",
  initialCategory = "all",
}: {
  store: StorefrontStore;
  products: StorefrontProduct[];
  categories: StorefrontCategory[];
  config: StoreConfig;
  theme: StorefrontTheme;
  preview?: boolean;
  initialQuery?: string;
  initialCategory?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState<SortKey>("featured");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [cartOpen, setCartOpen] = useState(false);

  const storeName = config.brand.name || store.storeName;

  // Every category that actually has products, with counts.
  const categoryList = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) if (p.categoryId) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
    return categories
      .map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id) ?? 0 }))
      .filter((c) => c.count > 0);
  }, [categories, products]);

  const priceCeiling = useMemo(
    () => Math.max(0, ...products.map((p) => Number(p.price) || 0)),
    [products]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = products.filter((p) => {
      if (category !== "all" && p.categoryId !== category) return false;
      if (inStockOnly && (p.stock ?? 0) <= 0) return false;
      if (maxPrice !== null && Number(p.price) > maxPrice) return false;
      if (q && !`${p.name} ${p.description ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    list = [...list];
    switch (sort) {
      case "price-asc": list.sort((a, b) => Number(a.price) - Number(b.price)); break;
      case "price-desc": list.sort((a, b) => Number(b.price) - Number(a.price)); break;
      case "name": list.sort((a, b) => a.name.localeCompare(b.name)); break;
      default: list.sort((a, b) => Number(b.isFeatured ?? false) - Number(a.isFeatured ?? false));
    }
    return list;
  }, [products, query, category, inStockOnly, maxPrice, sort]);

  const featured = useMemo(() => products.filter((p) => p.isFeatured).slice(0, 4), [products]);
  const filtersActive = category !== "all" || inStockOnly || maxPrice !== null || query.trim() !== "";
  const showHero = !filtersActive;

  const selectCategory = (id: string) => {
    setCategory(id);
    setLimit(PAGE_SIZE);
    if (typeof window !== "undefined") document.getElementById("shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const clearFilters = () => {
    setCategory("all");
    setInStockOnly(false);
    setMaxPrice(null);
    setQuery("");
  };

  const activeName = category === "all" ? "All products" : categoryList.find((c) => c.id === category)?.name ?? "Products";

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <AnnouncementBar bar={config.announcementBar} />
      <StoreHeader
        config={config}
        theme={theme}
        storeName={store.storeName}
        storeSlug={store.storeSlug}
        whatsappNumber={store.whatsappNumber}
        query={query}
        onQuery={(q) => { setQuery(q); setLimit(PAGE_SIZE); }}
        onOpenCart={() => setCartOpen(true)}
        categories={categoryList}
        activeCategory={category}
        onCategory={selectCategory}
      />

      {showHero && (
        <>
          <Hero config={config} theme={theme} storeName={storeName} whatsapp={whatsappLink(config, store.whatsappNumber)} />

          {config.trustBadges.enabled && config.trustBadges.badges.length > 0 && (
            <section className={`${CONTAINER} mt-10`}>
              <ul className="grid grid-cols-4 gap-4">
                {config.trustBadges.badges.slice(0, 4).map((b, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-5 py-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ backgroundColor: theme.brandSoft, color: theme.brandDeep }}>
                      <TrustIcon icon={b.icon} size={20} />
                    </span>
                    <span className="text-[14.5px] font-semibold text-slate-800">{b.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {categoryList.length > 1 && (
            <section className={`${CONTAINER} mt-16`}>
              <SectionTitle title="Shop by category" />
              <ul className="mt-6 grid grid-cols-6 gap-4">
                {categoryList.slice(0, 6).map((c) => {
                  const cover = products.find((p) => p.categoryId === c.id && imagesOf(p)[0]);
                  return (
                    <li key={c.id}>
                      <button type="button" onClick={() => selectCategory(c.id)} className="group block w-full text-left">
                        <div className="aspect-square overflow-hidden rounded-2xl bg-slate-100">
                          {cover ? (
                            <img src={imagesOf(cover)[0]} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                          ) : (
                            <div className="h-full w-full" style={{ backgroundColor: theme.brandSoft }} />
                          )}
                        </div>
                        <p className="mt-3 text-[15px] font-bold text-slate-900">{c.name}</p>
                        <p className="text-[13px] text-slate-500">{c.count} item{c.count === 1 ? "" : "s"}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {featured.length >= 3 && (
            <section className={`${CONTAINER} mt-16`}>
              <SectionTitle title="Featured" />
              <div className="mt-6 grid grid-cols-4 gap-x-6 gap-y-10">
                {featured.map((p) => (
                  <DesktopProductCard key={p.id} product={p} storeSlug={store.storeSlug} theme={theme} preview={preview} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ------------------------------ shop ------------------------------ */}
      <section id="shop" className={`${CONTAINER} scroll-mt-40 ${showHero ? "mt-20" : "mt-10"}`}>
        <div className="grid grid-cols-[240px_1fr] gap-10">
          <aside className="sticky top-44 self-start">
            <h3 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-slate-900">
              <SlidersHorizontal size={15} aria-hidden /> Filters
            </h3>

            {categoryList.length > 0 && (
              <div className="mt-6">
                <p className="text-[14px] font-bold text-slate-900">Category</p>
                <ul className="mt-3 space-y-1">
                  {[{ id: "all", name: "All products", count: products.length }, ...categoryList].map((c) => {
                    const active = category === c.id;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => { setCategory(c.id); setLimit(PAGE_SIZE); }}
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[14px] transition hover:bg-slate-50"
                          style={active ? { backgroundColor: theme.brandSoft, color: theme.brandDeep, fontWeight: 700 } : { color: "#475569" }}
                        >
                          <span className="truncate">{c.name}</span>
                          <span className="text-[12.5px] opacity-70">{c.count}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {priceCeiling > 0 && (
              <div className="mt-8">
                <div className="flex items-baseline justify-between">
                  <p className="text-[14px] font-bold text-slate-900">Max price</p>
                  <p className="text-[13px] font-semibold text-slate-600">{formatNaira(maxPrice ?? priceCeiling)}</p>
                </div>
                <input
                  type="range"
                  min={0}
                  max={priceCeiling}
                  step={Math.max(1, Math.round(priceCeiling / 100))}
                  value={maxPrice ?? priceCeiling}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setMaxPrice(v >= priceCeiling ? null : v);
                  }}
                  aria-label="Maximum price"
                  className="mt-3 w-full"
                  style={{ accentColor: theme.brand }}
                />
              </div>
            )}

            <label className="mt-8 flex cursor-pointer items-center gap-3 text-[14px] text-slate-700">
              <span
                className="grid h-5 w-5 place-items-center rounded-md border-2 transition"
                style={inStockOnly ? { backgroundColor: theme.brand, borderColor: theme.brand, color: theme.onBrand } : { borderColor: "#CBD5E1" }}
              >
                {inStockOnly && <Check size={13} strokeWidth={3} />}
              </span>
              <input type="checkbox" className="sr-only" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
              In stock only
            </label>

            {filtersActive && (
              <button type="button" onClick={clearFilters} className="mt-8 text-[13.5px] font-bold underline underline-offset-4" style={{ color: theme.brandDeep }}>
                Clear all filters
              </button>
            )}
          </aside>

          <div>
            <div className="flex items-end justify-between gap-6 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-[28px] font-extrabold tracking-tight text-slate-900">
                  {query.trim() ? <>Results for “{query.trim()}”</> : activeName}
                </h2>
                <p className="mt-1 text-[14px] text-slate-500">{filtered.length} product{filtered.length === 1 ? "" : "s"}</p>
              </div>
              <label className="relative flex items-center gap-2 text-[14px] text-slate-600">
                Sort by
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="h-10 appearance-none rounded-full border border-slate-200 bg-white pl-4 pr-10 text-[14px] font-semibold text-slate-800 outline-none hover:border-slate-300"
                >
                  <option value="featured">Featured</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                  <option value="name">Name A–Z</option>
                </select>
                <ChevronDown size={16} aria-hidden className="pointer-events-none absolute right-3.5 text-slate-500" />
              </label>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-24 text-center">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-slate-400"><PackageOpen size={26} aria-hidden /></span>
                <p className="text-[18px] font-bold text-slate-900">{products.length === 0 ? "No products yet" : "Nothing matches your filters"}</p>
                <p className="text-[14px] text-slate-500">
                  {products.length === 0 ? "This store hasn't added products yet. Check back soon." : "Try a different search or clear the filters."}
                </p>
                {filtersActive && (
                  <button type="button" onClick={clearFilters} className="mt-2 h-11 rounded-full px-6 text-[14px] font-bold" style={{ backgroundColor: theme.brand, color: theme.onBrand }}>
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="mt-8 grid grid-cols-3 gap-x-6 gap-y-10 xl:grid-cols-4">
                  {filtered.slice(0, limit).map((p) => (
                    <DesktopProductCard key={p.id} product={p} storeSlug={store.storeSlug} theme={theme} preview={preview} />
                  ))}
                </div>
                {filtered.length > limit && (
                  <div className="mt-14 flex flex-col items-center gap-3">
                    <p className="text-[13.5px] text-slate-500">Showing {limit} of {filtered.length}</p>
                    <button
                      type="button"
                      onClick={() => setLimit((l) => l + PAGE_SIZE)}
                      className="h-12 rounded-full border-2 px-8 text-[14.5px] font-bold transition hover:bg-slate-50"
                      style={{ borderColor: theme.brand, color: theme.brandDeep }}
                    >
                      Load more products
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <StoreFooter
        config={config}
        theme={theme}
        storeName={store.storeName}
        storeSlug={store.storeSlug}
        whatsappNumber={store.whatsappNumber}
        categories={categoryList}
        onCategory={selectCategory}
      />

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} theme={theme} storeSlug={store.storeSlug} preview={preview} />
    </div>
  );
}

/* ---------------------------------- hero ---------------------------------- */

function Hero({
  config,
  theme,
  storeName,
  whatsapp,
}: {
  config: StoreConfig;
  theme: StorefrontTheme;
  storeName: string;
  whatsapp: string | null;
}) {
  const title = (config.hero.title || `Welcome to ${storeName}`).split("\n").slice(0, 2).join("\n");
  const imgs = config.hero.images.filter(Boolean).slice(0, 3);

  return (
    <section className={`${CONTAINER} mt-8`}>
      <div
        className="relative grid min-h-[440px] grid-cols-12 overflow-hidden rounded-[28px]"
        style={{ background: `linear-gradient(120deg, ${theme.brandSoft} 0%, color-mix(in srgb, ${theme.brandSoft} 40%, white) 70%)` }}
      >
        <div className="relative z-10 col-span-6 flex flex-col justify-center gap-6 py-16 pl-14 pr-6">
          {config.brand.tagline && (
            <span className="w-fit rounded-full bg-white/70 px-3.5 py-1.5 text-[12.5px] font-bold uppercase tracking-wider" style={{ color: theme.brandDeep }}>
              {config.brand.tagline}
            </span>
          )}
          <h1 className="whitespace-pre-line text-[52px] font-extrabold leading-[1.05] tracking-tight" style={{ color: theme.brandDeep }}>
            {title}
          </h1>
          {config.hero.subtitle && (
            <p className="max-w-[460px] text-[17px] leading-relaxed text-slate-600">{config.hero.subtitle}</p>
          )}
          <div className="mt-2 flex items-center gap-3">
            <a
              href="#shop"
              className="inline-flex h-[52px] items-center gap-2 rounded-full px-7 text-[15px] font-bold shadow-sm transition hover:brightness-95"
              style={{ backgroundColor: theme.brand, color: theme.onBrand }}
            >
              {config.hero.ctaLabel || "Shop now"} <ArrowRight size={17} aria-hidden />
            </a>
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-[52px] items-center gap-2 rounded-full bg-white px-6 text-[15px] font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                <MessageCircle size={17} aria-hidden /> Chat on WhatsApp
              </a>
            )}
          </div>
        </div>

        <div className="relative col-span-6">
          {imgs.length === 1 && (
            <img src={imgs[0]} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          {imgs.length === 2 && (
            <div className="absolute inset-0 grid grid-cols-2 gap-3 p-6">
              {imgs.map((src) => <img key={src} src={src} alt="" className="h-full w-full rounded-2xl object-cover" />)}
            </div>
          )}
          {imgs.length >= 3 && (
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-3 p-6">
              <img src={imgs[0]} alt="" className="row-span-2 h-full w-full rounded-2xl object-cover" />
              <img src={imgs[1]} alt="" className="h-full w-full rounded-2xl object-cover" />
              <img src={imgs[2]} alt="" className="h-full w-full rounded-2xl object-cover" />
            </div>
          )}
          {imgs.length === 0 && (
            <div aria-hidden className="absolute inset-0 flex items-center justify-center">
              <div className="h-72 w-72 rounded-full opacity-60 blur-2xl" style={{ backgroundColor: theme.brand }} />
              <ShoppingBag size={120} className="absolute opacity-80" style={{ color: theme.brandDeep }} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-[26px] font-extrabold tracking-tight text-slate-900">{title}</h2>;
}

/* ------------------------------ product card ------------------------------ */

export function DesktopProductCard({
  product,
  storeSlug,
  theme,
  preview = false,
}: {
  product: StorefrontProduct;
  storeSlug: string;
  theme: StorefrontTheme;
  preview?: boolean;
}) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);
  const imgs = imagesOf(product);
  const price = Number(product.price);
  const compare = product.comparePrice ? Number(product.comparePrice) : null;
  const onSale = compare !== null && Number.isFinite(compare) && compare > price;
  const soldOut = (product.stock ?? 0) <= 0;
  const href = preview ? undefined : `/${storeSlug}/products/${product.id}`;

  const add = () => {
    if (soldOut) return;
    addToCart({ productId: product.id, name: product.name, price: product.price, quantity: 1, image: imgs[0] });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  const media = (
    <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-slate-100">
      {imgs[0] ? (
        <>
          <img src={imgs[0]} alt={product.name} loading="lazy" className={`h-full w-full object-cover transition duration-500 ${imgs[1] ? "group-hover:opacity-0" : "group-hover:scale-[1.04]"}`} />
          {imgs[1] && <img src={imgs[1]} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-500 group-hover:opacity-100" />}
        </>
      ) : (
        <div className="grid h-full w-full place-items-center text-slate-300"><ShoppingBag size={40} aria-hidden /></div>
      )}
      <div className="absolute left-3 top-3 flex flex-col gap-1.5">
        {onSale && (
          <span className="rounded-full px-2.5 py-1 text-[11.5px] font-extrabold" style={{ backgroundColor: theme.brand, color: theme.onBrand }}>
            −{Math.round(((compare! - price) / compare!) * 100)}%
          </span>
        )}
        {product.isFeatured && !onSale && (
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11.5px] font-bold text-slate-800">Featured</span>
        )}
      </div>
      {soldOut && (
        <span className="absolute inset-x-3 bottom-3 rounded-full bg-white/90 py-2 text-center text-[12.5px] font-bold text-slate-700">Sold out</span>
      )}
    </div>
  );

  return (
    <article className="group flex flex-col">
      <div className="relative">
        {href ? <Link href={href} className="block">{media}</Link> : media}
        {!soldOut && (
          <button
            type="button"
            onClick={add}
            className="absolute inset-x-3 bottom-3 z-10 flex h-11 translate-y-2 items-center justify-center gap-2 rounded-full text-[14px] font-bold opacity-0 shadow-lg transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100"
            style={{ backgroundColor: theme.brand, color: theme.onBrand }}
            aria-label={`Add ${product.name} to cart`}
          >
            {added ? <><Check size={16} /> Added</> : <><ShoppingBag size={16} /> Add to cart</>}
          </button>
        )}
      </div>
      <div className="mt-3.5 flex min-h-[78px] flex-col">
        {href ? (
          <Link href={href} className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900 hover:underline">{product.name}</Link>
        ) : (
          <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900">{product.name}</p>
        )}
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-[16.5px] font-extrabold" style={{ color: onSale ? theme.brandDeep : "#0F172A" }}>{formatNaira(price)}</span>
          {onSale && <span className="text-[13.5px] text-slate-400 line-through">{formatNaira(compare!)}</span>}
        </div>
      </div>
    </article>
  );
}
