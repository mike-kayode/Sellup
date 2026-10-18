import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, stores } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * POST /api/orders/list
 * Lists orders for a store owned by the authenticated user.
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
    const { storeId, status } = body;

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

    const conditions = [eq(orders.storeId, storeId)];

    if (status) {
      conditions.push(eq(orders.status, status));
    }

    const result = await db
      .select({
        id: orders.id,
        storeId: orders.storeId,
        customerId: orders.customerId,
        orderNumber: orders.orderNumber,
        items: orders.items,
        subtotal: orders.subtotal,
        discount: orders.discount,
        tax: orders.tax,
        total: orders.total,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        notes: orders.notes,
        couponCode: orders.couponCode,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      })
      .from(orders)
      .where(and(...conditions))
      .orderBy(orders.createdAt);

    return NextResponse.json(
      {
        orders: result,
        count: result.length,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error listing orders:", err);
    return NextResponse.json(
      { error: "Failed to list orders" },
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
