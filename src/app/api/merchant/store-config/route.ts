import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, products, stores } from "@/db/schema";
import { requireStoreOwnership } from "@/lib/storefront/api";
import {
  defaultConfig,
  resolveConfig,
  storeConfigSchema,
  type StoreConfig,
} from "@/lib/storefront/config";
import { deriveThemeTokens } from "@/lib/storefront/theme";
import { getDraftConfig, saveDraftConfig } from "@/lib/storefront/store";

const querySchema = z.object({ storeId: z.string().uuid() });
const bodySchema = z.object({
  storeId: z.string().uuid(),
  config: storeConfigSchema,
});

/**
 * GET /api/merchant/store-config?storeId=
 * The merchant's draft config (computed defaults when none saved yet).
 *
 * PUT /api/merchant/store-config
 * Save the draft. Also syncs brand name + color into the business row so the
 * legacy template and emails stay consistent with the new design.
 */
export async function GET(request: NextRequest) {
  try {
    const parsed = querySchema.safeParse({
      storeId: request.nextUrl.searchParams.get("storeId"),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "storeId is required" }, { status: 400 });
    }

    const access = await requireStoreOwnership(request, parsed.data.storeId);
    if (!access.ok) return access.response;

    const draft = await getDraftConfig(access.store.id);
    const config = resolveConfig(draft, seedFromStore(access.store));

    // Everything the setup wizard needs in one call: config + catalog data
    // for the live phone preview.
    const [catalogCategories, catalogProducts] = await Promise.all([
      db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(eq(categories.storeId, access.store.id)),
      db
        .select({
          id: products.id,
          name: products.name,
          price: products.price,
          images: products.images,
          stock: products.stock,
          isFeatured: products.isFeatured,
          categoryId: products.categoryId,
        })
        .from(products)
        .where(
          and(eq(products.storeId, access.store.id), eq(products.isActive, true))
        )
        .limit(12),
    ]);

    return NextResponse.json({
      config,
      theme: deriveThemeTokens(config.brand.color),
      hasDraft: draft !== null,
      store: {
        id: access.store.id,
        storeName: access.store.storeName,
        storeSlug: access.store.storeSlug,
        logo: access.store.logo,
        bannerImage: access.store.bannerImage,
        whatsappNumber: access.store.whatsappNumber,
      },
      categories: catalogCategories,
      products: catalogProducts,
    });
  } catch (error) {
    console.error("Store config GET error:", error);
    return NextResponse.json(
      { error: "Failed to load store config" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid config", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const access = await requireStoreOwnership(request, parsed.data.storeId);
    if (!access.ok) return access.response;

    const config: StoreConfig = resolveConfig(
      parsed.data.config,
      seedFromStore(access.store)
    );

    if (!deriveThemeTokens(config.brand.color).valid) {
      return NextResponse.json(
        { error: "Pick a darker brand colour so text stays readable." },
        { status: 400 }
      );
    }

    await saveDraftConfig(access.store.id, config);

    // Keep the business row in sync for legacy surfaces.
    await db
      .update(stores)
      .set({
        storeName: config.brand.name || access.store.storeName,
        primaryColor: config.brand.color,
        ...(config.brand.logo ? { logo: config.brand.logo } : {}),
        updatedAt: new Date(),
      })
      .where(eq(stores.id, access.store.id));

    return NextResponse.json({
      message: "Draft saved",
      config,
      theme: deriveThemeTokens(config.brand.color),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("Store config PUT error:", error);
    return NextResponse.json(
      { error: "Failed to save store config" },
      { status: 500 }
    );
  }
}

/** Local helper — business row -> config seed. */
function seedFromStore(store: typeof stores.$inferSelect) {
  return {
    storeName: store.storeName,
    storeSlug: store.storeSlug,
    logo: store.logo,
    bannerImage: store.bannerImage,
    description: store.description,
    primaryColor: store.primaryColor,
    whatsappNumber: store.whatsappNumber,
    vertical: null,
    categories: [],
  } satisfies Parameters<typeof defaultConfig>[0];
}