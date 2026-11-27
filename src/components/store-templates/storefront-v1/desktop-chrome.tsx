"use client";

/**
 * Storefront desktop chrome — header, category bar, footer and cart drawer.
 * Shared by the desktop storefront home and the product page so every page
 * of a store carries the same brand frame. All colour comes from the
 * merchant's theme tokens (never a hard-coded green).
 */

import Link from "next/link";
import { useEffect, type CSSProperties, type ReactNode } from "react";
import {
  Clock,
  Gift,
  Lock,
  MapPin,
  Medal,
  MessageCircle,
  Minus,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import type { StoreConfig } from "@/lib/storefront/config";
import type { StorefrontTheme } from "@/lib/storefront/theme";
import { BrandAvatar, VerifiedBadge, formatNaira } from "./parts";

/* eslint-disable @next/next/no-img-element */

export const CONTAINER = "mx-auto w-full max-w-[1280px] px-6 xl:px-8";

export function whatsappLink(config: StoreConfig, fallback?: string | null, text?: string) {
  const digits = (config.contact.whatsapp || fallback || "")
    .replace(/[^0-9]/g, "")
    .replace(/^0/, "234");
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function TrustIcon({ icon, size = 16 }: { icon: string; size?: number }) {
  const props = { size, "aria-hidden": true } as const;
  switch (icon) {
    case "truck": return <Truck {...props} />;
    case "shield": return <ShieldCheck {...props} />;
    case "lock": return <Lock {...props} />;
    case "gift": return <Gift {...props} />;
    case "refresh": return <RefreshCw {...props} />;
    case "medal": return <Medal {...props} />;
    default: return <ShieldCheck {...props} />;
  }
}

/* --------------------------------- header --------------------------------- */

export function StoreHeader({
  config,
  theme,
  storeName,
  storeSlug,
  whatsappNumber,
  query,
  onQuery,
  onOpenCart,
  categories,
  activeCategory,
  onCategory,
}: {
  config: StoreConfig;
  theme: StorefrontTheme;
  storeName: string;
  storeSlug: string;
  whatsappNumber?: string | null;
  /** When omitted the search box submits to the store home (?q=). */
  query?: string;
  onQuery?: (q: string) => void;
  onOpenCart: () => void;
  categories?: { id: string; name: string; count?: number }[];
  activeCategory?: string;
  onCategory?: (id: string) => void;
}) {
  const { cart } = useCart();
  const count = cart.items.reduce((n, i) => n + i.quantity, 0);
  const wa = whatsappLink(config, whatsappNumber);
  const contactBits = [config.contact.phone, config.contact.hours].filter(Boolean);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      {(contactBits.length > 0 || config.trustBadges.enabled) && (
        <div className="border-b border-slate-100 text-[12.5px] text-slate-600" style={{ backgroundColor: theme.brandSoft }}>
          <div className={`${CONTAINER} flex h-9 items-center justify-between gap-6`}>
            <div className="flex items-center gap-5" style={{ color: theme.brandDeep }}>
              {config.contact.phone && (
                <span className="inline-flex items-center gap-1.5"><Phone size={13} aria-hidden />{config.contact.phone}</span>
              )}
              {config.contact.hours && (
                <span className="inline-flex items-center gap-1.5"><Clock size={13} aria-hidden />{config.contact.hours}</span>
              )}
            </div>
            {config.trustBadges.enabled && (
              <ul className="flex items-center gap-5" style={{ color: theme.brandDeep }}>
                {config.trustBadges.badges.slice(0, 4).map((b, i) => (
                  <li key={i} className="inline-flex items-center gap-1.5 font-medium">
                    <TrustIcon icon={b.icon} size={13} />{b.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="border-b border-slate-200/80">
        <div className={`${CONTAINER} flex h-[76px] items-center gap-8`}>
          <Link href={`/${storeSlug}`} className="flex min-w-0 shrink-0 items-center gap-3">
            <BrandAvatar config={config} theme={theme} size={44} />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[19px] font-extrabold tracking-tight text-slate-900">
                  {config.brand.name || storeName}
                </span>
                {config.brand.verified && (
                  <span style={{ color: theme.brand }}><VerifiedBadge className="h-[18px] w-[18px]" /></span>
                )}
              </span>
              {config.brand.tagline && (
                <span className="block max-w-[260px] truncate text-[12.5px] text-slate-500">{config.brand.tagline}</span>
              )}
            </span>
          </Link>

          <form
            role="search"
            action={`/${storeSlug}`}
            onSubmit={(e) => { if (onQuery) e.preventDefault(); }}
            className="relative flex-1"
          >
            <Search size={18} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              type="search"
              value={onQuery ? query : undefined}
              onChange={onQuery ? (e) => onQuery(e.target.value) : undefined}
              placeholder={`Search ${config.brand.name || storeName}…`}
              aria-label="Search products"
              className="h-12 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-4 text-[14.5px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-transparent focus:bg-white focus:ring-2"
              style={{ "--tw-ring-color": theme.brand } as CSSProperties}
            />
          </form>

          <div className="flex shrink-0 items-center gap-2">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 px-4 text-[14px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <MessageCircle size={18} aria-hidden /> Chat with us
              </a>
            )}
            <button
              type="button"
              onClick={onOpenCart}
              aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
              className="relative inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-bold shadow-sm transition hover:brightness-95"
              style={{ backgroundColor: theme.brand, color: theme.onBrand }}
            >
              <ShoppingBag size={18} aria-hidden />
              Cart
              <span
                className="grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[12px] font-extrabold"
                style={{ backgroundColor: theme.onBrand, color: theme.brand }}
              >
                {count}
              </span>
            </button>
          </div>
        </div>
      </div>

      {categories && categories.length > 0 && onCategory && (
        <nav aria-label="Categories" className="border-b border-slate-200/80 bg-white">
          <ul className={`${CONTAINER} flex h-12 items-center gap-1 overflow-x-auto`}>
            {[{ id: "all", name: "All products" }, ...categories].map((c) => {
              const active = activeCategory === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onCategory(c.id)}
                    aria-pressed={active}
                    className="relative h-12 whitespace-nowrap px-3.5 text-[14px] font-semibold transition"
                    style={{ color: active ? theme.brandDeep : "#475569" }}
                  >
                    {c.name}
                    <span
                      aria-hidden
                      className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full transition-opacity"
                      style={{ backgroundColor: theme.brand, opacity: active ? 1 : 0 }}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}

/* --------------------------------- footer --------------------------------- */

export function StoreFooter({
  config,
  theme,
  storeName,
  storeSlug,
  whatsappNumber,
  categories,
  onCategory,
}: {
  config: StoreConfig;
  theme: StorefrontTheme;
  storeName: string;
  storeSlug: string;
  whatsappNumber?: string | null;
  categories?: { id: string; name: string }[];
  onCategory?: (id: string) => void;
}) {
  const wa = whatsappLink(config, whatsappNumber);
  const payments = [
    config.payments.paystack && "Card (Paystack)",
    config.payments.flutterwave && "Card (Flutterwave)",
    config.payments.transfer && "Bank transfer",
    config.payments.cod && "Pay on delivery",
  ].filter(Boolean) as string[];
  const name = config.brand.name || storeName;

  return (
    <footer className="mt-24 border-t border-slate-200 bg-slate-50">
      <div className={`${CONTAINER} grid grid-cols-12 gap-10 py-14`}>
        <div className="col-span-4">
          <div className="flex items-center gap-3">
            <BrandAvatar config={config} theme={theme} size={40} />
            <span className="text-[18px] font-extrabold text-slate-900">{name}</span>
          </div>
          {(config.brand.tagline || config.hero.subtitle) && (
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-slate-600">
              {config.brand.tagline || config.hero.subtitle}
            </p>
          )}
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-bold"
              style={{ backgroundColor: theme.brand, color: theme.onBrand }}
            >
              <MessageCircle size={17} aria-hidden /> Order on WhatsApp
            </a>
          )}
        </div>

        {categories && categories.length > 0 && (
          <div className="col-span-2">
            <h4 className="text-[13px] font-bold uppercase tracking-wider text-slate-900">Shop</h4>
            <ul className="mt-4 space-y-2.5 text-[14px] text-slate-600">
              {categories.slice(0, 8).map((c) => (
                <li key={c.id}>
                  {onCategory ? (
                    <button type="button" onClick={() => onCategory(c.id)} className="hover:text-slate-900">{c.name}</button>
                  ) : (
                    <Link href={`/${storeSlug}?category=${encodeURIComponent(c.id)}`} className="hover:text-slate-900">{c.name}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="col-span-3">
          <h4 className="text-[13px] font-bold uppercase tracking-wider text-slate-900">Contact</h4>
          <ul className="mt-4 space-y-3 text-[14px] text-slate-600">
            {config.contact.address && (
              <li className="flex gap-2.5"><MapPin size={16} className="mt-0.5 shrink-0" aria-hidden />{config.contact.address}</li>
            )}
            {config.contact.phone && (
              <li className="flex gap-2.5"><Phone size={16} className="mt-0.5 shrink-0" aria-hidden />
                <a href={`tel:${config.contact.phone}`} className="hover:text-slate-900">{config.contact.phone}</a>
              </li>
            )}
            {config.contact.hours && (
              <li className="flex gap-2.5"><Clock size={16} className="mt-0.5 shrink-0" aria-hidden />{config.contact.hours}</li>
            )}
          </ul>
        </div>

        <div className="col-span-3">
          {payments.length > 0 && (
            <>
              <h4 className="text-[13px] font-bold uppercase tracking-wider text-slate-900">We accept</h4>
              <ul className="mt-4 flex flex-wrap gap-2">
                {payments.map((p) => (
                  <li key={p} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[12.5px] font-medium text-slate-600">{p}</li>
                ))}
              </ul>
            </>
          )}
          {config.delivery.zones.length > 0 && (
            <>
              <h4 className="mt-7 text-[13px] font-bold uppercase tracking-wider text-slate-900">Delivery</h4>
              <ul className="mt-3 space-y-1.5 text-[13.5px] text-slate-600">
                {config.delivery.zones.slice(0, 4).map((z) => (
                  <li key={z.name} className="flex justify-between gap-4">
                    <span>{z.name}</span><span className="font-semibold text-slate-800">{z.fee > 0 ? formatNaira(z.fee) : "Free"}</span>
                  </li>
                ))}
                {config.delivery.pickup && <li className="text-slate-500">Pickup available</li>}
              </ul>
            </>
          )}
        </div>
      </div>
      <div className="border-t border-slate-200">
        <div className={`${CONTAINER} flex h-14 items-center justify-between text-[12.5px] text-slate-500`}>
          <span>© {new Date().getFullYear()} {name}. All rights reserved.</span>
          <a href="https://sellup.ng" target="_blank" rel="noopener" className="font-semibold tracking-wide text-slate-400 hover:text-slate-600">
            Powered by SellUp
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------- cart drawer ------------------------------- */

export function CartDrawer({
  open,
  onClose,
  theme,
  storeSlug,
  preview = false,
}: {
  open: boolean;
  onClose: () => void;
  theme: StorefrontTheme;
  storeSlug: string;
  preview?: boolean;
}) {
  const { cart, updateQuantity, removeFromCart } = useCart();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-[60] ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className={`absolute right-0 top-0 flex h-full w-full max-w-[440px] flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex h-[72px] items-center justify-between border-b border-slate-100 px-6">
          <h2 className="text-[18px] font-extrabold text-slate-900">
            Your cart <span className="font-semibold text-slate-400">({cart.items.reduce((n, i) => n + i.quantity, 0)})</span>
          </h2>
          <button type="button" onClick={onClose} aria-label="Close cart" className="grid h-10 w-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        {cart.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-10 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full" style={{ backgroundColor: theme.brandSoft, color: theme.brandDeep }}>
              <ShoppingBag size={26} aria-hidden />
            </span>
            <p className="text-[16px] font-bold text-slate-900">Your cart is empty</p>
            <p className="text-[14px] text-slate-500">Browse the store and add something you love.</p>
            <button type="button" onClick={onClose} className="mt-2 h-11 rounded-full px-6 text-[14px] font-bold" style={{ backgroundColor: theme.brand, color: theme.onBrand }}>
              Continue shopping
            </button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto px-6">
              {cart.items.map((item) => (
                <li key={item.productId} className="flex gap-4 py-5">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                    {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <p className="line-clamp-2 text-[14.5px] font-semibold text-slate-900">{item.name}</p>
                      <button type="button" onClick={() => removeFromCart(item.productId)} aria-label={`Remove ${item.name}`} className="text-slate-400 hover:text-red-500">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <p className="mt-0.5 text-[13px] text-slate-500">{formatNaira(item.price)} each</p>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <QuantityStepper
                        value={item.quantity}
                        onChange={(q) => (q <= 0 ? removeFromCart(item.productId) : updateQuantity(item.productId, q))}
                        small
                      />
                      <span className="text-[15px] font-extrabold text-slate-900">{formatNaira(Number(item.price) * item.quantity)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-100 px-6 py-5">
              <div className="flex items-center justify-between text-[15px]">
                <span className="text-slate-600">Subtotal</span>
                <span className="text-[18px] font-extrabold text-slate-900">{formatNaira(cart.total)}</span>
              </div>
              <p className="mt-1 text-[12.5px] text-slate-500">Delivery is calculated at checkout.</p>
              {preview ? (
                <span className="mt-4 flex h-12 w-full items-center justify-center rounded-full text-[15px] font-bold opacity-60" style={{ backgroundColor: theme.brand, color: theme.onBrand }}>
                  Checkout
                </span>
              ) : (
                <Link
                  href={`/${storeSlug}/checkout`}
                  className="mt-4 flex h-12 w-full items-center justify-center rounded-full text-[15px] font-bold transition hover:brightness-95"
                  style={{ backgroundColor: theme.brand, color: theme.onBrand }}
                >
                  Checkout · {formatNaira(cart.total)}
                </Link>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export function QuantityStepper({
  value,
  onChange,
  max,
  small = false,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
  small?: boolean;
}) {
  const h = small ? "h-9" : "h-12";
  const w = small ? "w-9" : "w-12";
  return (
    <div className={`inline-flex ${h} items-center rounded-full border border-slate-200 bg-white`}>
      <button type="button" onClick={() => onChange(value - 1)} aria-label="Decrease quantity" className={`grid ${h} ${w} place-items-center text-slate-600 hover:text-slate-900`}>
        <Minus size={small ? 14 : 16} />
      </button>
      <span className={`${small ? "w-7 text-[14px]" : "w-10 text-[16px]"} text-center font-bold text-slate-900`} aria-live="polite">{value}</span>
      <button
        type="button"
        onClick={() => onChange(max ? Math.min(max, value + 1) : value + 1)}
        disabled={max !== undefined && value >= max}
        aria-label="Increase quantity"
        className={`grid ${h} ${w} place-items-center text-slate-600 hover:text-slate-900 disabled:opacity-30`}
      >
        <Plus size={small ? 14 : 16} />
      </button>
    </div>
  );
}

export function PageShell({ children, announcement }: { children: ReactNode; announcement?: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      {announcement}
      {children}
    </div>
  );
}
