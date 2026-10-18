import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, stores } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * POST /api/products/list
 * Lists products for a store owned by the authenticated user.
 */
export async function POST(request: NextRequest) {
  try {
    // Resolve authenticated user
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = auth.slice(7);
    const supabase = getSupabaseAdmin();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { storeId, categoryId, isActive } = body;

    if (!storeId) {
      return NextResponse.json(
        { error: "storeId is required" },
        { status: 400 }
      );
    }

    // Verify the user owns the store
    const storeResult = await db
      .select({ id: stores.id, userId: stores.userId })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);

    if (storeResult.length === 0) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    if (storeResult[0].userId !== user.id) {
      return NextResponse.json(
        { error: "You do not have access to this store" },
        { status: 403 }
      );
    }

    const conditions = [eq(products.storeId, storeId)];

    if (categoryId) {
      conditions.push(eq(products.categoryId, categoryId));
    }

    if (isActive !== undefined) {
      conditions.push(eq(products.isActive, isActive));
    }

const result = await db
      .select({
        id: products.id,
        storeId: products.storeId,
        categoryId: products.categoryId,
        name: products.name,
        slug: products.slug,
        description: products.description,
        price: products.price,
        comparePrice: products.comparePrice,
        costPrice: products.costPrice,
        stock: products.stock,
        sku: products.sku,
        images: products.images,
        variants: products.variants,
        isActive: products.isActive,
        isFeatured: products.isFeatured,
        sortOrder: products.sortOrder,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .where(and(...conditions));

    return NextResponse.json(
      {
        products: result,
        count: result.length,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error listing products:", err);
    return NextResponse.json(
      { error: "Failed to list products" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
