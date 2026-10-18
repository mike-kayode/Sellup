import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stores, products } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/store/[slug]/products/[productId]
 * Public endpoint to fetch a single active product for a published store.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; productId: string }> }
) {
  try {
    const { slug, productId } = await params;

    // Find the store by slug
    const storeResult = await db
      .select({ id: stores.id, isPublished: stores.isPublished })
      .from(stores)
      .where(eq(stores.storeSlug, slug))
      .limit(1);

    if (storeResult.length === 0) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const store = storeResult[0];

    if (!store.isPublished) {
      return NextResponse.json(
        { error: "Store not published" },
        { status: 403 }
      );
    }

    // Fetch the product scoped to the store, only active products
    const productResult = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.storeId, store.id),
          eq(products.id, productId),
          eq(products.isActive, true)
        )
      )
      .limit(1);

    if (productResult.length === 0) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    const product = productResult[0];

    // Only expose public fields
    return NextResponse.json(
      {
        product: {
          id: product.id,
          storeId: product.storeId,
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: product.price,
          comparePrice: product.comparePrice,
          images: product.images,
          stock: product.stock,
          categoryId: product.categoryId,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Product lookup error:", error);
    return NextResponse.json(
      { error: "Failed to load product" },
      { status: 500 }
    );
  }
}
