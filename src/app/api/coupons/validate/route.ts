import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { coupons } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const validateCouponSchema = z.object({
  storeId: z.string().uuid(),
  code: z.string().min(3).max(50),
  subtotal: z.string().or(z.number()),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = validateCouponSchema.parse(body);

    const coupon = await db
      .select()
      .from(coupons)
      .where(
        and(
          eq(coupons.storeId, validatedData.storeId),
          eq(coupons.code, validatedData.code.toUpperCase()),
          eq(coupons.isActive, true)
        )
      )
      .limit(1);

    if (coupon.length === 0) {
      return NextResponse.json(
        { error: "Coupon not found" },
        { status: 404 }
      );
    }

    const c = coupon[0];

    // Check expiration
    if (c.expiresAt && new Date(c.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: "Coupon has expired" },
        { status: 400 }
      );
    }

    // Check max usage
    if (c.maxUsage && c.currentUsage && c.currentUsage >= c.maxUsage) {
      return NextResponse.json(
        { error: "Coupon usage limit reached" },
        { status: 400 }
      );
    }

    // Check minimum order amount
    const subtotal = parseFloat(validatedData.subtotal.toString());
    if (
      c.minOrderAmount &&
      subtotal < parseFloat(c.minOrderAmount)
    ) {
      return NextResponse.json(
        {
          error: `Minimum order amount is ₦${parseFloat(c.minOrderAmount).toLocaleString()}`,
        },
        { status: 400 }
      );
    }

    // Calculate discount
    let discount = 0;
    if (c.discountType === "percentage") {
      discount = (subtotal * parseFloat(c.discountValue)) / 100;
    } else {
      discount = parseFloat(c.discountValue);
    }

    return NextResponse.json(
      {
        coupon: {
          id: c.id,
          code: c.code,
          discountType: c.discountType,
          discountValue: c.discountValue,
          discount: discount.toString(),
        },
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

    console.error("Coupon validation error:", error);
    return NextResponse.json(
      { error: "Failed to validate coupon" },
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
