import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { analyticsEvents, orders, products, stores } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const updateStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum([
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "completed",
    "cancelled",
  ]),
});

export async function PUT(request: NextRequest) {
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
    const validatedData = updateStatusSchema.parse(body);

    // Fetch the order to determine its store
    const orderResult = await db
      .select({ id: orders.id, storeId: orders.storeId, status: orders.status, items: orders.items })
      .from(orders)
      .where(eq(orders.id, validatedData.orderId))
      .limit(1);

    if (orderResult.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Verify the user owns the order's store
    const storeResult = await db
      .select({ id: stores.id, userId: stores.userId })
      .from(stores)
      .where(eq(stores.id, orderResult[0].storeId))
      .limit(1);

    if (storeResult.length === 0 || storeResult[0].userId !== user.id) {
      return NextResponse.json(
        { error: "You do not have access to this order" },
        { status: 403 }
      );
    }

    const updatedOrder = await db.transaction(async (tx) => {
      if (validatedData.status === "cancelled" && orderResult[0].status !== "cancelled") {
        const items = Array.isArray(orderResult[0].items) ? orderResult[0].items as Array<{ productId: string; quantity: number }> : [];
        for (const item of items) {
          await tx.update(products).set({
            stock: sql`${products.stock} + ${item.quantity}`,
            updatedAt: new Date(),
          }).where(and(eq(products.id, item.productId), sql`${products.stock} is not null`));
        }
      }

      const [updated] = await tx.update(orders).set({
        status: validatedData.status,
        updatedAt: new Date(),
      }).where(eq(orders.id, validatedData.orderId)).returning({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
      });

      const eventByStatus: Record<string, string> = {
        confirmed: "ORDER_CONFIRMED",
        completed: "ORDER_COMPLETED",
        cancelled: "ORDER_CANCELLED",
      };
      const eventName = eventByStatus[validatedData.status];
      if (eventName) {
        await tx.insert(analyticsEvents).values({
          storeId: orderResult[0].storeId,
          orderId: validatedData.orderId,
          eventName,
        });
      }
      return updated;
    });

    return NextResponse.json(
      {
        message: "Order status updated successfully",
        order: updatedOrder,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("Order update error:", error);
    return NextResponse.json(
      { error: "Failed to update order" },
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
