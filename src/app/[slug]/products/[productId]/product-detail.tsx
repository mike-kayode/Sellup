"use client";

/**
 * Product page (all screen sizes). Server-rendered data, client interactivity:
 * clickable gallery, selectable variants, quantity, add to cart / buy now,
 * WhatsApp order, trust badges, related products — in the store's colours.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type CSSProperties } from "react";
import { Check, ChevronLeft, ChevronRight, MessageCircle, ShoppingBag, Zap } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import type { StoreConfig } from "@/lib/storefront/config";
import { themeToCssVars, type StorefrontTheme } from "@/lib/storefront/theme";
import type { PublicProductDetail } from "@/lib/storefront/load";
import { AnnouncementBar } from "@/components/storefront/announcement-bar";
import {
  CONTAINER,
  CartDrawer,
  QuantityStepper,
  StoreFooter,
  StoreHeader,
  TrustIcon,
  whatsappLink,
} from "@/components/store-templates/storefront-v1/desktop-chrome";
import { DesktopProductCard } from "@/components/store-templates/storefront-v1/desktop";
import { formatNaira, type StorefrontProduct, type StorefrontStore } from "@/components/store-templates/storefront-v1/parts";

/* eslint-disable @next/next/no-img-element */

export function ProductDetail({
  store,
  config,
  theme,
  categories,
  product,
  related,
}: {
  store: StorefrontStore;
  config: StoreConfig;
  theme: StorefrontTheme;
  categories: { id: string; name: string }[];
  product: PublicProductDetail;
  related: StorefrontProduct[];
}) {
  const router = useRouter();
  const { addToCart } = useCart();
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);
  const [needsChoice, setNeedsChoice] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const imgs = product.images;
  const price = Number(product.price);
  const compare = product.comparePrice ? Number(product.comparePrice) : null;
  const onSale = compare !== null && Number.isFinite(compare) && compare > price;
  const stock = product.stock ?? 0;
  const soldOut = stock <= 0;
  const category = categories.find((c) => c.id === product.categoryId);
  const allPicked = product.variants.every((v) => picked[v.name]);
  const choiceLabel = product.variants.map((v) => picked[v.name] && `${v.name}: ${picked[v.name]}`).filter(Boolean).join(", ");
  const storeName = config.brand.name || store.storeName;

  // Server snapshot is "" so hydration matches; the client then fills in the origin.
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  );
  const pageUrl = `${origin}/${store.storeSlug}/products/${product.id}`;
  const waOrder = whatsappLink(
    config,
    store.whatsappNumber,
    `Hi ${storeName}, I'd like to order ${qty} × ${product.name}${choiceLabel ? ` (${choiceLabel})` : ""} — ${formatNaira(price)} each. ${pageUrl}`
  );

  function put(): boolean {
    if (soldOut) return false;
    if (!allPicked) {
      setNeedsChoice(true);
      return false;
    }
    addToCart({
      productId: product.id,
      name: choiceLabel ? `${product.name} (${choiceLabel})` : product.name,
      price: product.price,
      quantity: qty,
      image: imgs[0],
    });
    return true;
  }

  const go = (d: number) => setActive((i) => (imgs.length ? (i + d + imgs.length) % imgs.length : 0));

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased" style={themeToCssVars(theme) as CSSProperties}>
      <AnnouncementBar bar={config.announcementBar} />

      {/* Desktop header */}
      <div className="hidden lg:block">
        <StoreHeader
          config={config}
          theme={theme}
          storeName={store.storeName}
          storeSlug={store.storeSlug}
          whatsappNumber={store.whatsappNumber}
          onOpenCart={() => setCartOpen(true)}
        />
      </div>

      {/* Mobile header */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-100 bg-white px-3 lg:hidden">
        <Link href={`/${store.storeSlug}`} className="flex items-center gap-1 text-[14px] font-semibold text-slate-700">
          <ChevronLeft size={20} aria-hidden /> {storeName}
        </Link>
        <button type="button" onClick={() => setCartOpen(true)} aria-label="Open cart" className="grid h-10 w-10 place-items-center rounded-full" style={{ color: theme.brandDeep }}>
          <ShoppingBag size={21} />
        </button>
      </div>

      <main className={`${CONTAINER} !px-4 pb-28 sm:!px-6 lg:pb-0`}>
        <nav aria-label="Breadcrumb" className="hidden pt-6 text-[13.5px] text-slate-500 lg:block">
          <ol className="flex items-center gap-1.5">
            <li><Link href={`/${store.storeSlug}`} className="hover:text-slate-900">Home</Link></li>
            {category && (
              <>
                <li aria-hidden><ChevronRight size={14} /></li>
                <li><Link href={`/${store.storeSlug}?category=${encodeURIComponent(category.id)}`} className="hover:text-slate-900">{category.name}</Link></li>
              </>
            )}
            <li aria-hidden><ChevronRight size={14} /></li>
            <li className="truncate font-medium text-slate-800">{product.name}</li>
          </ol>
        </nav>

        <div className="grid gap-8 pt-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14 lg:pt-6">
          {/* ------------------------------ gallery ------------------------------ */}
          <section aria-label="Product images" className="lg:sticky lg:top-32 lg:self-start">
            <div className="flex gap-4">
              {imgs.length > 1 && (
                <ul className="hidden w-[84px] shrink-0 flex-col gap-3 lg:flex">
                  {imgs.map((src, i) => (
                    <li key={src + i}>
                      <button
                        type="button"
                        onClick={() => setActive(i)}
                        aria-label={`Show image ${i + 1}`}
                        aria-current={i === active}
                        className="block aspect-square w-full overflow-hidden rounded-xl border-2 transition"
                        style={{ borderColor: i === active ? theme.brand : "transparent" }}
                      >
                        <img src={src} alt="" className="h-full w-full object-cover" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="relative flex-1 overflow-hidden rounded-3xl bg-slate-100">
                <div className="aspect-square lg:aspect-[4/5]">
                  {imgs[active] ? (
                    <img src={imgs[active]} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-slate-300"><ShoppingBag size={64} aria-hidden /></div>
                  )}
                </div>
                {onSale && (
                  <span className="absolute left-4 top-4 rounded-full px-3 py-1.5 text-[13px] font-extrabold" style={{ backgroundColor: theme.brand, color: theme.onBrand }}>
                    −{Math.round(((compare! - price) / compare!) * 100)}%
                  </span>
                )}
                {imgs.length > 1 && (
                  <>
                    <button type="button" onClick={() => go(-1)} aria-label="Previous image" className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white">
                      <ChevronLeft size={20} />
                    </button>
                    <button type="button" onClick={() => go(1)} aria-label="Next image" className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white">
                      <ChevronRight size={20} />
                    </button>
                    <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 lg:hidden">
                      {imgs.map((_, i) => (
                        <span key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === active ? 18 : 6, backgroundColor: i === active ? theme.brand : "rgba(255,255,255,0.8)" }} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* ------------------------------- info -------------------------------- */}
          <section aria-label="Product details" className="lg:py-2">
            {category && (
              <p className="text-[13px] font-bold uppercase tracking-wider" style={{ color: theme.brandDeep }}>{category.name}</p>
            )}
            <h1 className="mt-2 text-[26px] font-extrabold leading-tight tracking-tight text-slate-900 lg:text-[36px]">{product.name}</h1>

            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-[28px] font-extrabold text-slate-900 lg:text-[32px]">{formatNaira(price)}</span>
              {onSale && (
                <>
                  <span className="text-[18px] text-slate-400 line-through">{formatNaira(compare!)}</span>
                  <span className="rounded-full px-2.5 py-1 text-[12.5px] font-bold" style={{ backgroundColor: theme.brandSoft, color: theme.brandDeep }}>
                    Save {formatNaira(compare! - price)}
                  </span>
                </>
              )}
            </div>

            <p className="mt-3 text-[14px] font-semibold" style={{ color: soldOut ? "#DC2626" : stock < 10 ? "#C2410C" : theme.brandDeep }}>
              {soldOut ? "Out of stock" : stock < 10 ? `Only ${stock} left — order soon` : "In stock"}
            </p>

            {product.variants.length > 0 && (
              <div className="mt-7 space-y-5">
                {product.variants.map((v) => (
                  <fieldset key={v.name}>
                    <legend className="text-[14px] font-bold text-slate-900">
                      {v.name}
                      {picked[v.name] && <span className="ml-2 font-medium text-slate-500">{picked[v.name]}</span>}
                    </legend>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {v.options.map((o) => {
                        const on = picked[v.name] === o;
                        return (
                          <button
                            key={o}
                            type="button"
                            aria-pressed={on}
                            onClick={() => { setPicked((s) => ({ ...s, [v.name]: o })); setNeedsChoice(false); }}
                            className="min-w-12 rounded-full border-2 px-4 py-2 text-[14px] font-semibold transition"
                            style={on ? { borderColor: theme.brand, backgroundColor: theme.brandSoft, color: theme.brandDeep } : { borderColor: "#E2E8F0", color: "#334155" }}
                          >
                            {o}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
                {needsChoice && (
                  <p role="alert" className="text-[13.5px] font-semibold text-red-600">
                    Please choose {product.variants.filter((v) => !picked[v.name]).map((v) => v.name.toLowerCase()).join(" and ")}.
                  </p>
                )}
              </div>
            )}

            {!soldOut && (
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <QuantityStepper value={qty} onChange={(v) => setQty(Math.max(1, v))} max={stock} />
                <button
                  type="button"
                  onClick={() => {
                    if (put()) {
                      setAdded(true);
                      setTimeout(() => setAdded(false), 1800);
                      setCartOpen(true);
                    }
                  }}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-bold shadow-sm transition hover:brightness-95"
                  style={{ backgroundColor: theme.brand, color: theme.onBrand }}
                >
                  {added ? <><Check size={18} /> Added to cart</> : <><ShoppingBag size={18} /> Add to cart</>}
                </button>
              </div>
            )}

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {!soldOut && (
                <button
                  type="button"
                  onClick={() => { if (put()) router.push(`/${store.storeSlug}/checkout`); }}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border-2 text-[15px] font-bold transition hover:bg-slate-50"
                  style={{ borderColor: theme.brand, color: theme.brandDeep }}
                >
                  <Zap size={17} aria-hidden /> Buy now
                </button>
              )}
              {waOrder && (
                <a
                  href={waOrder}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex h-12 items-center justify-center gap-2 rounded-full bg-slate-900 text-[15px] font-bold text-white transition hover:bg-slate-800 ${soldOut ? "sm:col-span-2" : ""}`}
                >
                  <MessageCircle size={17} aria-hidden /> {soldOut ? "Ask about restock" : "Order on WhatsApp"}
                </a>
              )}
            </div>

            {config.trustBadges.enabled && config.trustBadges.badges.length > 0 && (
              <ul className="mt-8 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4">
                {config.trustBadges.badges.slice(0, 4).map((b, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-[13.5px] font-medium text-slate-700">
                    <span style={{ color: theme.brandDeep }}><TrustIcon icon={b.icon} size={17} /></span>{b.label}
                  </li>
                ))}
              </ul>
            )}

            {product.description && (
              <div className="mt-8 border-t border-slate-200 pt-6">
                <h2 className="text-[16px] font-bold text-slate-900">Description</h2>
                <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-slate-600">{product.description}</p>
              </div>
            )}

            {(config.delivery.zones.length > 0 || config.delivery.pickup) && (
              <div className="mt-6 border-t border-slate-200 pt-6">
                <h2 className="text-[16px] font-bold text-slate-900">Delivery</h2>
                <ul className="mt-3 space-y-1.5 text-[14px] text-slate-600">
                  {config.delivery.zones.map((z) => (
                    <li key={z.name} className="flex justify-between gap-4"><span>{z.name}</span><span className="font-semibold text-slate-800">{z.fee > 0 ? formatNaira(z.fee) : "Free"}</span></li>
                  ))}
                  {config.delivery.pickup && <li>Pickup available</li>}
                </ul>
              </div>
            )}

            {product.sku && <p className="mt-6 text-[12.5px] text-slate-400">SKU: {product.sku}</p>}
          </section>
        </div>

        {related.length > 0 && (
          <section className="mt-20">
            <h2 className="text-[22px] font-extrabold tracking-tight text-slate-900 lg:text-[26px]">You may also like</h2>
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-x-6">
              {related.map((p) => (
                <DesktopProductCard key={p.id} product={p} storeSlug={store.storeSlug} theme={theme} />
              ))}
            </div>
          </section>
        )}
      </main>

      <div className="hidden lg:block">
        <StoreFooter config={config} theme={theme} storeName={store.storeName} storeSlug={store.storeSlug} whatsappNumber={store.whatsappNumber} categories={categories} />
      </div>

      {/* Mobile sticky buy bar */}
      {!soldOut && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="min-w-0">
            <p className="truncate text-[12.5px] text-slate-500">{product.name}</p>
            <p className="text-[17px] font-extrabold text-slate-900">{formatNaira(price)}</p>
          </div>
          <button
            type="button"
            onClick={() => { if (put()) { setAdded(true); setTimeout(() => setAdded(false), 1800); setCartOpen(true); } }}
            className="ml-auto inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-bold"
            style={{ backgroundColor: theme.brand, color: theme.onBrand }}
          >
            <ShoppingBag size={18} /> {added ? "Added" : "Add to cart"}
          </button>
        </div>
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} theme={theme} storeSlug={store.storeSlug} />
    </div>
  );
}
