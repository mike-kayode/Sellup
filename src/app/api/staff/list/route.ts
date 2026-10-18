import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stores, staffMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * POST /api/staff/list
 * List staff members for a store owned by the authenticated user.
 */
export async function POST(request: NextRequest) {
  try {
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
    const storeId = body?.storeId as string | undefined;
    if (!storeId) {
      return NextResponse.json({ error: "storeId is required" }, { status: 400 });
    }

    // Verify store ownership
    const store = await db
      .select({ id: stores.id, userId: stores.userId })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);

    if (store.length === 0) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    if (store[0].userId !== user.id) {
      return NextResponse.json(
        { error: "You do not have access to this store" },
        { status: 403 }
      );
    }

    const staff = await db
      .select()
      .from(staffMembers)
      .where(eq(staffMembers.storeId, storeId));

    return NextResponse.json({ staff }, { status: 200 });
  } catch (error) {
    console.error("Staff list error:", error);
    return NextResponse.json(
      { error: "Failed to list staff" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
