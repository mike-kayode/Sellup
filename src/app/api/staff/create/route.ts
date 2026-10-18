import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { stores, staffMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const createStaffSchema = z.object({
  storeId: z.string().uuid(),
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["manager", "staff", "viewer"]).default("staff"),
  permissions: z.array(z.string()).default([]),
});

/**
 * POST /api/staff/create
 * Add a staff member to a store owned by the authenticated user.
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
    const validated = createStaffSchema.parse(body);

    // Verify store ownership
    const store = await db
      .select({ id: stores.id, userId: stores.userId })
      .from(stores)
      .where(eq(stores.id, validated.storeId))
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

    const newStaff = await db
      .insert(staffMembers)
      .values({
        storeId: validated.storeId,
        name: validated.name,
        email: validated.email,
        role: validated.role,
        permissions: validated.permissions,
        isActive: true,
      })
      .returning();

    return NextResponse.json(
      { message: "Staff member added", staff: newStaff[0] },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("Staff create error:", error);
    return NextResponse.json(
      { error: "Failed to add staff member" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
