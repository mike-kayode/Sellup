/**
 * Storefront v1 store-config model (spec sections 5 + 9).
 *
 * The JSON `config` is the ONLY thing merchants can change: content and
 * brand color. Layout is locked in the renderer.
 *
 * - `draft`      — edited by the /dashboard/store-design wizard
 * - `published`  — rendered by the live storefront (cacheable)
 */

import { z } from "zod";
import { getPreset, normalizeVertical, type Vertical } from "./presets";
import { normalizeHex } from "./theme";

export const STOREFRONT_TEMPLATE_ID = "storefront-v1";

/* --------------------------------- types --------------------------------- */

export interface StoreConfigBrand {
  name: string;
  logo: string;
  tagline: string;
  color: string;
  verified: boolean;
}

export interface StoreConfigHero {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaTarget: "category" | "product" | "url";
  images: string[];
}

export interface StoreConfigCategory {
  id: string;
  name: string;
  icon: string;
}

export interface StoreConfigContact {
  whatsapp: string;
  phone: string;
  address: string;
  hours: string;
}

export interface StoreConfigDelivery {
  zones: { name: string; fee: number }[];
  pickup: boolean;
}

export interface StoreConfigPayments {
  paystack: boolean;
  flutterwave: boolean;
  transfer: boolean;
  cod: boolean;
}

export interface StoreConfig {
  template: typeof STOREFRONT_TEMPLATE_ID;
  vertical: Vertical;
  brand: StoreConfigBrand;
  hero: StoreConfigHero;
  categories: StoreConfigCategory[];
  contact: StoreConfigContact;
  delivery: StoreConfigDelivery;
  payments: StoreConfigPayments;
  orderStatuses: string[];
}

/* ------------------------------- zod schema ------------------------------- */

export const storeConfigSchema = z.object({
  template: z.literal(STOREFRONT_TEMPLATE_ID).default(STOREFRONT_TEMPLATE_ID),
  vertical: z
    .enum(["fashion", "food", "grocery", "perfume", "general"])
    .default("general"),
  brand: z
    .object({
      name: z.string().max(120).default(""),
      logo: z.string().max(500).default(""),
      tagline: z.string().max(160).default(""),
      color: z.string().default("#16A34A"),
      verified: z.boolean().default(true),
    })
    .default({
      name: "",
      logo: "",
      tagline: "",
      color: "#16A34A",
      verified: true,
    }),
  hero: z
    .object({
      title: z.string().max(140).default(""),
      subtitle: z.string().max(180).default(""),
      ctaLabel: z.string().max(40).default("Shop Now"),
      ctaTarget: z.enum(["category", "product", "url"]).default("category"),
      images: z.array(z.string().max(500)).max(4).default([]),
    })
    .default({
      title: "",
      subtitle: "",
      ctaLabel: "Shop Now",
      ctaTarget: "category",
      images: [],
    }),
  categories: z
    .array(
      z.object({
        id: z.string().max(80).default(""),
        name: z.string().max(60).default(""),
        icon: z.string().max(40).default("grid"),
      })
    )
    .max(3)
    .default([]),
  contact: z
    .object({
      whatsapp: z.string().max(20).default(""),
      phone: z.string().max(20).default(""),
      address: z.string().max(240).default(""),
      hours: z.string().max(120).default(""),
    })
    .default({ whatsapp: "", phone: "", address: "", hours: "" }),
  delivery: z
    .object({
      zones: z
        .array(
          z.object({
            name: z.string().max(80).default(""),
            fee: z.number().min(0).max(1000000).default(0),
          })
        )
        .max(10)
        .default([]),
      pickup: z.boolean().default(true),
    })
    .default({ zones: [], pickup: true }),
  payments: z
    .object({
      paystack: z.boolean().default(false),
      flutterwave: z.boolean().default(false),
      transfer: z.boolean().default(true),
      cod: z.boolean().default(true),
    })
    .default({ paystack: false, flutterwave: false, transfer: true, cod: true }),
  orderStatuses: z
    .array(z.string().max(40))
    .min(1)
    .max(6)
    .default(["Pending", "Confirmed", "Out for delivery", "Delivered"]),
});

/* -------------------------------- defaults -------------------------------- */

/** Everything the defaults need to know about a business row. */
export interface StoreConfigSeed {
  storeName: string;
  storeSlug: string;
  logo?: string | null;
  bannerImage?: string | null;
  description?: string | null;
  primaryColor?: string | null;
  whatsappNumber?: string | null;
  vertical?: string | null;
  categories?: { id: string; name: string }[];
}

/**
 * Build a complete config from a business row + existing catalog categories.
 * Used when a merchant has never opened the wizard (zero-config stores still
 * render the template, seeded from their store settings).
 */
export function defaultConfig(seed: StoreConfigSeed): StoreConfig {
  const vertical = normalizeVertical(seed.vertical);
  const preset = getPreset(vertical);

  const presetCategories: StoreConfigCategory[] = preset.defaultCategories.map(
    (c, i) => ({ id: `preset-${i}`, name: c.name, icon: c.icon })
  );

  const catalogCategories: StoreConfigCategory[] = (seed.categories || [])
    .slice(0, 3)
    .map((c, i) => ({
      id: c.id,
      name: c.name,
      icon: preset.defaultCategories[i]?.icon || "grid",
    }));

  return {
    template: STOREFRONT_TEMPLATE_ID,
    vertical,
    brand: {
      name: seed.storeName || "My Store",
      logo: seed.logo || "",
      tagline: seed.description?.slice(0, 160) || "",
      color: normalizeHex(seed.primaryColor) || preset.brandColor,
      verified: true,
    },
    hero: {
      title: preset.heroTitle,
      subtitle: preset.heroSubtitle,
      ctaLabel: "Shop Now",
      ctaTarget: "category",
      images: seed.bannerImage ? [seed.bannerImage] : [],
    },
    categories: catalogCategories.length > 0 ? catalogCategories : presetCategories,
    contact: {
      whatsapp: seed.whatsappNumber || "",
      phone: "",
      address: "",
      hours: "",
    },
    delivery: { zones: [], pickup: true },
    payments: { paystack: false, flutterwave: false, transfer: true, cod: true },
    orderStatuses: ["Pending", "Confirmed", "Out for delivery", "Delivered"],
  };
}

/**
 * Make any stored (possibly old or hand-edited) config complete and valid.
 * Falls back to defaults when the stored shape cannot be salvaged, so a bad
 * draft can never blank a live store.
 */
export function resolveConfig(
  raw: unknown | null | undefined,
  seed: StoreConfigSeed
): StoreConfig {
  const fallback = defaultConfig(seed);
  if (!raw || typeof raw !== "object") return fallback;

  const parsed = storeConfigSchema.safeParse(raw);
  const config: StoreConfig = parsed.success
    ? (parsed.data as StoreConfig)
    : { ...fallback };

  // Fill gaps that schema defaults cannot know about (seeded content).
  if (!config.brand.name) config.brand.name = fallback.brand.name;
  if (!config.brand.color) config.brand.color = fallback.brand.color;
  if (!config.hero.title) config.hero.title = fallback.hero.title;
  if (!config.hero.subtitle) config.hero.subtitle = fallback.hero.subtitle;
  if (!config.contact.whatsapp && fallback.contact.whatsapp) {
    config.contact.whatsapp = fallback.contact.whatsapp;
  }
  if (config.categories.length === 0) config.categories = fallback.categories;

  // Always normalize the color through the theming rules.
  config.brand.color = normalizeHex(config.brand.color) || fallback.brand.color;
  config.template = STOREFRONT_TEMPLATE_ID;
  return config;
}