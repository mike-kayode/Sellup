"use client";

/**
 * Storefront v1 — shared parts (spec sections 2 + 3).
 * Layout is LOCKED: merchants only change content and brand color.
 */

import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Cookie,
  CupSoda,
  Droplet,
  Flower2,
  GlassWater,
  Home,
  LayoutGrid,
  Leaf,
  Mars,
  Package,
  PackageOpen,
  Shirt,
  ShoppingCart,
  SprayCan,
  Sparkles,
  UtensilsCrossed,
  Venus,
  Wine,
} from "lucide-react";
import type { StoreConfig, StoreConfigCategory } from "@/lib/storefront/config";
import type { StorefrontTheme } from "@/lib/storefront/theme";

/* --------------------------------- types ---------------------------------- */

export interface StorefrontStore {
  id: string;
  storeName: string;
  storeSlug: string;
  logo?: string | null;
  bannerImage?: string | null;
  whatsappNumber?: string | null;
}

export interface StorefrontProduct {
  id: string;
  name: string;
  price: string;
  images?: unknown;
  stock?: number | null;
  isFeatured?: boolean | null;
  categoryId?: string | null;
}

export interface StorefrontCategory {
  id: string;
  name: string;
}

export type StorefrontTab = "home" | "categories" | "orders" | "account";

/* -------------------------------- helpers ---------------------------------- */

export function formatNaira(value: string | number): string {
  const n = Number(value);
  const safe = Number.isFinite(n) ? Math.round(n) : 0;
  return `\u20A6${safe.toLocaleString("en-NG")}`;
}

export function productImage(product: StorefrontProduct): string | null {
  if (Array.isArray(product.images) && product.images.length > 0) {
    const first = product.images[0];
    return typeof first === "string" && first.length > 0 ? first : null;
  }
  return null;
}

export type IconType = ComponentType<{ className?: string; size?: number | string }>;

const ICON_MAP: Record<string, IconType> = {
  grid: LayoutGrid,
  shirt: Shirt,
  sparkles: Sparkles,
  home: Home,
  utensils: UtensilsCrossed,
  drinks: CupSoda,
  snacks: Cookie,
  fresh: Leaf,
  pantry: Package,
  men: Mars,
  women: Venus,
  unisex: Droplet,
  beauty: SprayCan,
  florals: Flower2,
  wine: Wine,
  water: GlassWater,
};

export function presetIcon(iconKey: string): IconType {
  return ICON_MAP[iconKey] || LayoutGrid;
}

/* ------------------------------- small parts -------------------------------- */

export function VerifiedBadge({ className = "" }: { className?: string }) {
  return (
    <BadgeCheck className={`inline-block ${className}`} aria-label="Verified store" />
  );
}

export function BrandAvatar({
  config,
  theme,
  size = 46,
}: {
  config: StoreConfig;
  theme: StorefrontTheme;
  size?: number;
}) {
  if (config.brand.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={config.brand.logo}
        alt={config.brand.name}
        className="shrink-0 rounded-full object-cover ring-1 ring-black/5"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-extrabold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: theme.brandDeep,
        fontSize: size * 0.42,
      }}
    >
      {(config.brand.name || "S").charAt(0).toUpperCase()}
    </div>
  );
}

export function HeroBanner({
  config,
  theme,
  onCta,
}: {
  config: StoreConfig;
  theme: StorefrontTheme;
  onCta?: () => void;
}) {
  const lines = (config.hero.title || "Welcome").split("\n").slice(0, 2);
  const heroImage = config.hero.images[0];
  return (
    <section
      className="relative mx-3 mt-1 h-[176px] overflow-hidden rounded-[16px]"
      style={{
        background: `linear-gradient(135deg, ${theme.brandSoft} 0%, color-mix(in srgb, ${theme.brandSoft} 55%, white) 100%)`,
      }}
    >
      <div className="relative z-10 flex h-full w-[62%] flex-col justify-center gap-2 pl-5">
        <h2
          className="whitespace-pre-line text-[24px] font-extrabold leading-[1.15]"
          style={{ color: theme.brandDeep }}
        >
          {lines.join("\n")}
        </h2>
        {config.hero.subtitle && (
          <p className="text-[13px] font-medium text-slate-600">
            {config.hero.subtitle}
          </p>
        )}
        <button
          type="button"
          onClick={onCta}
          className="mt-1 inline-flex h-10 w-fit items-center gap-1.5 rounded-full px-5 text-[13px] font-bold shadow-sm transition active:scale-[0.98]"
          style={{ backgroundColor: theme.brand, color: theme.onBrand }}
        >
          {config.hero.ctaLabel || "Shop Now"}
          <ArrowRight size={15} aria-hidden />
        </button>
      </div>
      {heroImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={heroImage}
          alt=""
          aria-hidden
          className="absolute bottom-0 right-0 h-full w-[42%] object-cover object-center"
        />
      )}
    </section>
  );
}

export function CategoryChips({
  config,
  theme,
  active,
  onSelect,
}: {
  config: StoreConfig;
  theme: StorefrontTheme;
  active: string;
  onSelect: (id: string) => void;
}) {
  const chips: { id: string; label: string; icon: IconType }[] = [
    { id: "all", label: "All", icon: LayoutGrid },
    ...config.categories.slice(0, 3).map((c: StoreConfigCategory) => ({
      id: c.id || c.name,
      label: c.name,
      icon: presetIcon(c.icon),
    })),
  ];

  return (
    <nav
      aria-label="Categories"
      className="mt-5 flex items-start justify-between gap-2 px-[14px]"
    >
      {chips.map((chip) => {
        const isActive = active === chip.id;
        const Icon = chip.icon;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onSelect(chip.id)}
            aria-pressed={isActive}
            className="flex w-[70px] flex-col items-center gap-1.5 focus:outline-none"
          >
            <span
              className="grid h-[56px] w-[56px] place-items-center rounded-full transition"
              style={{
                backgroundColor: isActive ? theme.brandSoft : "#F1F5F9",
                color: isActive ? theme.brandDeep : "#64748B",
              }}
            >
              <Icon size={22} aria-hidden />
            </span>
            <span
              className="text-[12px] font-semibold"
              style={{ color: isActive ? theme.brandDeep : "#475569" }}
            >
              {chip.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export function ProductCard({
  product,
  theme,
  href,
  onAdd,
}: {
  product: StorefrontProduct;
  theme: StorefrontTheme;
  href: string | null;
  onAdd: () => void;
}) {
  const image = productImage(product);
  const body = (
    <>
      <div className="relative aspect-square overflow-hidden rounded-[14px] bg-[#F3F4F6]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-4xl" aria-hidden>
            🛍️
          </div>
        )}
        {(product.stock ?? 0) <= 0 && (
          <span className="absolute inset-0 grid place-items-center bg-white/70 text-xs font-bold text-slate-500">
            Sold out
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-1 px-0.5 text-[13px] font-semibold text-slate-800">
        {product.name}
      </p>
      <div className="mt-0.5 flex items-center justify-between gap-2 px-0.5">
        <span className="text-[15px] font-extrabold text-slate-900">
          {formatNaira(product.price)}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAdd();
          }}
          aria-label={`Add ${product.name} to cart`}
          className="grid h-9 w-9 place-items-center rounded-full transition active:scale-95"
          style={{ backgroundColor: theme.brandSoft, color: theme.brandDeep }}
        >
          <ShoppingCart size={16} aria-hidden />
        </button>
      </div>
    </>
  );

  if (!href) {
    return <article className="rounded-[14px]">{body}</article>;
  }
  return (
    <article className="rounded-[14px]">
      <Link href={href} className="block rounded-[14px] focus:outline-none">
        {body}
      </Link>
    </article>
  );
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-8 py-16 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-slate-400">
        <PackageOpen size={26} aria-hidden />
      </span>
      <h3 className="text-[17px] font-extrabold text-slate-900">{title}</h3>
      <p className="text-[13px] text-slate-500">{message}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 h-10 rounded-full px-5 text-[13px] font-bold"
          style={{ backgroundColor: "var(--brand)", color: "var(--on-brand)" }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}