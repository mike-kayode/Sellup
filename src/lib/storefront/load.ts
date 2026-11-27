import { cache } from "react";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { businesses, categories, products } from "@/db/schema";
import { resolveConfig, type StoreConfig } from "@/lib/storefront/config";
import { deriveThemeTokens, type StorefrontTheme } from "@/lib/storefront/theme";
import { getPublishedConfig } from "@/lib/storefront/store";
import type { StorefrontProduct, StorefrontStore } from "@/components/store-templates/storefront-v1/parts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface StorefrontFrame {
  store: StorefrontStore & { description: string | null };
  config: StoreConfig;
  theme: StorefrontTheme;
  categories: { id: string; name: string }[];
}

/** Published store + resolved config/theme, or null. Cached per request. */
export const loadStorefrontFrame = cache(async (slug: string): Promise<StorefrontFrame | null> => {
  const [store] = await db.select().from(businesses).where(eq(businesses.storeSlug, slug)).limit(1);
  if (!store || !store.isPublished) return null;

  const cats = await db
    .select({ id: categories.id, name: categories.name, sortOrder: categories.sortOrder })
    .from(categories)
    .where(eq(categories.storeId, store.id));
  cats.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const config = resolveConfig(await getPublishedConfig(store.id), {
    storeName: store.storeName,
    storeSlug: store.storeSlug,
    logo: store.logo,
    bannerImage: store.bannerImage,
    description: store.description,
    primaryColor: store.primaryColor,
    whatsappNumber: store.whatsappNumber,
    vertical: null,
    categories: cats.map((c) => ({ id: c.id, name: c.name })),
  });
  const derived = deriveThemeTokens(config.brand.color);

  return {
    store: {
      id: store.id,
      storeName: store.storeName,
      storeSlug: store.storeSlug,
      logo: store.logo,
      bannerImage: store.bannerImage,
      whatsappNumber: store.whatsappNumber,
      description: store.description,
    },
    config,
    theme: derived.valid ? derived : deriveThemeTokens(null),
    categories: cats.map((c) => ({ id: c.id, name: c.name })),
  };
});

export interface PublicProductDetail extends StorefrontProduct {
  description: string | null;
  sku: string | null;
  variants: { name: string; options: string[] }[];
  images: string[];
}

function cleanImages(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((i): i is string => typeof i === "string" && i.length > 0) : [];
}

function cleanVariants(v: unknown): { name: string; options: string[] }[] {
  if (!Array.isArray(v)) return [];
  const out: { name: string; options: string[] }[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const options = Array.isArray(rec.options)
      ? rec.options.filter((o): o is string => typeof o === "string" && o.trim() !== "").map((o) => o.trim())
      : [];
    if (typeof rec.name === "string" && rec.name.trim() && options.length > 0) {
      out.push({ name: rec.name.trim(), options });
    }
  }
  return out;
}

/** One active product of a store (public fields only) + related products. */
export const loadProductDetail = cache(async (storeId: string, productId: string) => {
  if (!UUID_RE.test(productId)) return null;
  const [p] = await db
    .select()
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.id, productId), eq(products.isActive, true)))
    .limit(1);
  if (!p) return null;

  const product: PublicProductDetail = {
    id: p.id,
    name: p.name,
    price: String(p.price),
    comparePrice: p.comparePrice ? String(p.comparePrice) : null,
    description: p.description ?? null,
    images: cleanImages(p.images),
    stock: p.stock,
    isFeatured: p.isFeatured,
    categoryId: p.categoryId,
    sku: p.sku ?? null,
    variants: cleanVariants(p.variants),
  };

  const others = await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      comparePrice: products.comparePrice,
      images: products.images,
      stock: products.stock,
      isFeatured: products.isFeatured,
      categoryId: products.categoryId,
    })
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.isActive, true), ne(products.id, p.id)))
    .limit(40);

  const related: StorefrontProduct[] = others
    .sort((a, b) => Number(b.categoryId === p.categoryId) - Number(a.categoryId === p.categoryId))
    .slice(0, 4)
    .map((o) => ({
      ...o,
      price: String(o.price),
      comparePrice: o.comparePrice ? String(o.comparePrice) : null,
      images: cleanImages(o.images),
    }));

  return { product, related };
});
