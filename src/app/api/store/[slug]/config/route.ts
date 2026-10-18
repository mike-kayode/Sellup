import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, stores } from "@/db/schema";
import { resolveConfig } from "@/lib/storefront/config";
import { deriveThemeTokens } from "@/lib/storefront/theme";
import { getPublishedConfig } from "@/lib/storefront/store";

/**
 * GET /api/store/[slug]/config
 * Public, cacheable published storefront config + derived theme tokens.
 * This is the read side the live storefront and any future edge cache use.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const rows = await db
      .select({
        id: stores.id,
        storeName: stores.storeName,
        storeSlug: stores.storeSlug,
        logo: stores.logo,
        bannerImage: stores.bannerImage,
        description: stores.description,
        primaryColor: stores.primaryColor,
        whatsappNumber: stores.whatsappNumber,
        isPublished: stores.isPublished,
      })
      .from(stores)
      .where(eq(stores.storeSlug, slug))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }
    const store = rows[0];
    if (!store.isPublished) {
      return NextResponse.json({ error: "Store not published" }, { status: 403 });
    }

    const categoryRows = await db
      .select()
      .from(categories)
      .where(eq(categories.storeId, store.id));

    const raw = await getPublishedConfig(store.id);
    const config = resolveConfig(raw, {
      ...store,
      categories: categoryRows.map((c) => ({ id: c.id, name: c.name })),
    });
    const theme = deriveThemeTokens(config.brand.color);

    return NextResponse.json(
      { template: config.template, config, theme },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("Store config lookup error:", error);
    return NextResponse.json(
      { error: "Failed to load store config" },
      { status: 500 }
    );
  }
}