import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { coupons, stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const deleteCouponSchema = z.object({
  couponId: z.string().uuid(),
  storeId: z.string().uuid(),
});

export async function DELETE(request: NextRequest) {
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
    const validatedData = deleteCouponSchema.parse(body);

    // Verify the user owns the store
    const storeResult = await db
      .select({ id: stores.id, userId: stores.userId })
      .from(stores)
      .where(eq(stores.id, validatedData.storeId))
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

    // Verify coupon belongs to store
    const coupon = await db
      .select()
      .from(coupons)
      .where(eq(coupons.id, validatedData.couponId))
      .limit(1);

    if (coupon.length === 0 || coupon[0].storeId !== validatedData.storeId) {
      return NextResponse.json(
        { error: "Coupon not found" },
        { status: 404 }
      );
    }

    await db
      .delete(coupons)
      .where(eq(coupons.id, validatedData.couponId));

    return NextResponse.json(
      { message: "Coupon deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("Delete coupon error:", error);
    return NextResponse.json(
      { error: "Failed to delete coupon" },
      { status: 500 }
    );
  }
}
