
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";
import { businesses, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createAuditLog } from "@/lib/admin-audit";

const impersonateSchema = z.object({
  storeId: z.string().uuid(),
  durationMinutes: z.number().int().min(1).max(480).default(60), // max 8 hours
});

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user } = auth;

  // Only superadmin can impersonate.
  if (user.role !== "superadmin") {
    return NextResponse.json({ error: "Superadmin only" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { storeId, durationMinutes } = impersonateSchema.parse(body);

    // Verify the store exists.
    const [store] = await db
      .select({ id: businesses.id, storeName: businesses.storeName, userId: businesses.userId })
      .from(businesses)
      .where(eq(businesses.id, storeId))
      .limit(1);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Get the merchant user record.
    const [merchantUser] = await db
      .select({ id: users.id, email: users.email, fullName: users.fullName, role: users.role })
      .from(users)
      .where(eq(users.id, store.userId))
      .limit(1);

    if (!merchantUser) {
      return NextResponse.json({ error: "Merchant user not found" }, { status: 404 });
    }

    const impersonationExpiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    try {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "admin.merchant.impersonate",
        resourceType: "business",
        resourceId: storeId,
        previousValue: undefined,
        newValue: {
          impersonatedStoreId: storeId,
          impersonatedStoreName: store.storeName,
          impersonatedUserId: merchantUser.id,
          impersonatedUserEmail: merchantUser.email,
          impersonatedByAdminId: user.id,
          impersonationExpiresAt: impersonationExpiresAt.toISOString(),
        },
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: request.headers.get("user-agent") ?? undefined,
        status: "success",
      });
    } catch { /* ignore */ }

    return NextResponse.json({
      message: "Impersonation session created",
      impersonation: {
        storeId,
        storeName: store.storeName,
        merchantUserId: merchantUser.id,
        merchantEmail: merchantUser.email,
        expiresAt: impersonationExpiresAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }
    console.error("Impersonation error:", error);
    return NextResponse.json({ error: "Failed to create impersonation session" }, { status: 500 });
  }
}
