import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { coupons, stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const listCouponsSchema = z.object({
  storeId: z.string().uuid(),
  limit: z.number().default(50),
  offset: z.number().default(0),
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
    const validatedData = listCouponsSchema.parse(body);

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

    // Get total count
    const allCoupons = await db
      .select()
      .from(coupons)
      .where(eq(coupons.storeId, validatedData.storeId));

    // Get paginated coupons
    const paginatedCoupons = await db
      .select()
      .from(coupons)
      .where(eq(coupons.storeId, validatedData.storeId))
      .limit(validatedData.limit)
      .offset(validatedData.offset);

    return NextResponse.json(
      {
        coupons: paginatedCoupons,
        total: allCoupons.length,
        limit: validatedData.limit,
        offset: validatedData.offset,
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

    console.error("List coupons error:", error);
    return NextResponse.json(
      { error: "Failed to list coupons" },
      { status: 500 }
    );
  }
}
