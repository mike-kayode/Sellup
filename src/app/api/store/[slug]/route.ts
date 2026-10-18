import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/store/[slug]
 * Public endpoint to fetch minimal public store info by slug.
 * Only exposes public fields needed by the storefront/checkout.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const result = await db
      .select({
        id: stores.id,
        storeName: stores.storeName,
        storeSlug: stores.storeSlug,
        whatsappNumber: stores.whatsappNumber,
        logo: stores.logo,
        primaryColor: stores.primaryColor,
        isPublished: stores.isPublished,
      })
      .from(stores)
      .where(eq(stores.storeSlug, slug))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const store = result[0];

    if (!store.isPublished) {
      return NextResponse.json(
        { error: "Store not published" },
        { status: 403 }
      );
    }

    return NextResponse.json({ store }, { status: 200 });
  } catch (error) {
    console.error("Store lookup error:", error);
    return NextResponse.json(
      { error: "Failed to load store" },
      { status: 500 }
    );
  }
}
