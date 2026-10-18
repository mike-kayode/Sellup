import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { coupons, stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const updateCouponSchema = z.object({
  couponId: z.string().uuid(),
  storeId: z.string().uuid(),
  code: z.string().min(3).max(50).optional(),
  description: z.string().optional(),
  discountType: z.enum(["percentage", "fixed"]).optional(),
  discountValue: z.string().or(z.number()).optional(),
  maxUsage: z.number().optional(),
  minOrderAmount: z.string().or(z.number()).optional(),
  expiresAt: z.string().optional(),
  isActive: z.boolean().optional(),
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
    const validatedData = updateCouponSchema.parse(body);

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

    const updateData: any = {};
    if (validatedData.code) updateData.code = validatedData.code.toUpperCase();
    if (validatedData.description) updateData.description = validatedData.description;
    if (validatedData.discountType) updateData.discountType = validatedData.discountType;
    if (validatedData.discountValue !== undefined) updateData.discountValue = validatedData.discountValue.toString();
    if (validatedData.maxUsage !== undefined) updateData.maxUsage = validatedData.maxUsage;
    if (validatedData.minOrderAmount !== undefined) updateData.minOrderAmount = validatedData.minOrderAmount?.toString();
    if (validatedData.expiresAt !== undefined) updateData.expiresAt = validatedData.expiresAt ? new Date(validatedData.expiresAt) : null;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;

    const updatedCoupon = await db
      .update(coupons)
      .set(updateData)
      .where(eq(coupons.id, validatedData.couponId))
      .returning();

    return NextResponse.json(
      {
        message: "Coupon updated successfully",
        coupon: updatedCoupon[0],
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

    console.error("Update coupon error:", error);
    return NextResponse.json(
      { error: "Failed to update coupon" },
      { status: 500 }
    );
  }
}
