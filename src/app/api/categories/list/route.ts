import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { categories, stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * POST /api/categories/list
 * Lists categories for a store owned by the authenticated user.
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
    const { storeId } = body;

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

    const result = await db
      .select({
        id: categories.id,
        storeId: categories.storeId,
        name: categories.name,
        slug: categories.slug,
        description: categories.description,
        image: categories.image,
        sortOrder: categories.sortOrder,
        createdAt: categories.createdAt,
      })
      .from(categories)
      .where(eq(categories.storeId, storeId))
      .orderBy(categories.sortOrder);

    return NextResponse.json(
      {
        categories: result,
        count: result.length,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error listing categories:", err);
    return NextResponse.json(
      { error: "Failed to list categories" },
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
