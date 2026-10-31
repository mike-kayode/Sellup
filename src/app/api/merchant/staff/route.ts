import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { staffMembers, businesses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { requireMerchant } from "@/lib/merchant-auth";
import { createMerchantAuditLog } from "@/lib/admin-audit";

const staffSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(["owner", "manager", "cashier", "fulfilment", "marketer"]),
});

export async function GET(request: NextRequest) {
  const auth = await requireMerchant(request);
  if (auth.error) return auth.error;
  const { merchant } = auth!;

  try {
    const rows = await db
      .select({
        id: staffMembers.id,
        email: staffMembers.email,
        name: staffMembers.name,
        role: staffMembers.role,
        isActive: staffMembers.isActive,
        createdAt: staffMembers.createdAt,
      })
      .from(staffMembers)
      .where(eq(staffMembers.storeId, merchant.storeId))
      .orderBy(staffMembers.createdAt);

    // Audit: merchant viewed staff list.
    try {
      await createMerchantAuditLog({
        actorId: merchant.userId,
        actorRole: "merchant",
        action: "merchant.staff.list",
        resourceType: "staff",
        storeId: merchant.storeId,
        previousValue: undefined,
        newValue: { storeId: merchant.storeId, count: rows.length },
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: request.headers.get("user-agent") ?? undefined,
        status: "success",
      });
    } catch {
      // ignore audit failures
    }

    return NextResponse.json({ staff: rows });
  } catch (error) {
    console.error("Merchant staff list error:", error);
    return NextResponse.json({ error: "Failed to list staff" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireMerchant(request);
  if (auth.error) return auth.error;
  const { merchant } = auth!;

  // The merchant (store owner) always has staff.manage.
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rate = await checkAuthRateLimit(`merchant-staff-create:${ip}`);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, name, role } = staffSchema.parse(body);

    const normalizedEmail = email.toLowerCase();
    const [existing] = await db
      .select({ id: staffMembers.id })
      .from(staffMembers)
      .where(
        and(
          eq(staffMembers.storeId, merchant.storeId),
          eq(staffMembers.email, normalizedEmail)
        )
      )
      .limit(1);
    if (existing) {
      return NextResponse.json({ error: "Staff member already exists" }, { status: 409 });
    }

    const [inserted] = await db
      .insert(staffMembers)
      .values({
        storeId: merchant.storeId,
        email: normalizedEmail,
        name,
        role,
        isActive: true,
        permissions: [],
      })
      .returning();

    // Audit.
    try {
      await createMerchantAuditLog({
        actorId: merchant.userId,
        actorRole: "merchant",
        action: "merchant.staff.create",
        resourceType: "staff",
        resourceId: inserted.id,
        storeId: merchant.storeId,
        previousValue: undefined,
        newValue: { storeId: merchant.storeId, email: normalizedEmail, role },
        ipAddress: ip,
        userAgent: request.headers.get("user-agent") ?? undefined,
        status: "success",
      });
    } catch {
      // ignore audit failures
    }

    return NextResponse.json({ staff: inserted }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("Merchant staff create error:", error);
    return NextResponse.json({ error: "Failed to create staff" }, { status: 500 });
  }
}

export async function PUT() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
export async function DELETE() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
