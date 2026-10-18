import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers, stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * POST /api/customers/list
 * Lists customers for a store owned by the authenticated user.
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
    const { storeId, limit = 50, offset = 0 } = body;

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
        id: customers.id,
        storeId: customers.storeId,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        deliveryAddress: customers.deliveryAddress,
        city: customers.city,
        state: customers.state,
        notes: customers.notes,
        totalSpent: customers.totalSpent,
        totalOrders: customers.totalOrders,
        lastOrderDate: customers.lastOrderDate,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
      })
      .from(customers)
      .where(eq(customers.storeId, storeId))
      .limit(limit)
      .offset(offset);

    const total = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.storeId, storeId));

    return NextResponse.json(
      {
        customers: result,
        count: result.length,
        total: total.length,
        limit,
        offset,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error listing customers:", err);
    return NextResponse.json(
      { error: "Failed to list customers" },
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
