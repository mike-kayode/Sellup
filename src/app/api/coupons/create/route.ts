import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { coupons, stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const createCouponSchema = z.object({
  storeId: z.string().uuid(),
  code: z.string().min(3).max(50).toUpperCase(),
  description: z.string().optional(),
  discountType: z.enum(["percentage", "fixed"]).default("percentage"),
  discountValue: z.string().or(z.number()),
  maxUsage: z.number().optional(),
  minOrderAmount: z.string().or(z.number()).optional(),
  expiresAt: z.string().optional(),
});

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
    const validatedData = createCouponSchema.parse(body);

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

    const newCoupon = await db
      .insert(coupons)
      .values({
        storeId: validatedData.storeId,
        code: validatedData.code,
        description: validatedData.description,
        discountType: validatedData.discountType,
        discountValue: validatedData.discountValue.toString(),
        maxUsage: validatedData.maxUsage,
        minOrderAmount: validatedData.minOrderAmount?.toString(),
        expiresAt: validatedData.expiresAt
          ? new Date(validatedData.expiresAt)
          : null,
      })
      .returning({
        id: coupons.id,
        code: coupons.code,
        discountValue: coupons.discountValue,
      });

    return NextResponse.json(
      {
        message: "Coupon created successfully",
        coupon: newCoupon[0],
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("Coupon creation error:", error);
    return NextResponse.json(
      { error: "Failed to create coupon" },
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
