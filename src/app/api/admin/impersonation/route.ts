import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  adminImpersonationSessions,
  adminMemberships,
  auditLogs,
  businesses,
  users,
} from "@/db/schema";
import { getClientInfo } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";
import { createImpersonationToken } from "@/lib/admin-impersonation";

const impersonateSchema = z
  .object({
    storeId: z.string().uuid(),
    durationMinutes: z.number().int().min(1).max(480).default(60),
  })
  .strict();

export async function POST(request: NextRequest) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "superadmin") {
    return NextResponse.json({ error: "Superadmin only" }, { status: 403 });
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = impersonateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid impersonation request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [store] = await db
      .select({
        id: businesses.id,
        storeName: businesses.storeName,
        userId: businesses.userId,
      })
      .from(businesses)
      .where(eq(businesses.id, parsed.data.storeId))
      .limit(1);
    if (!store) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const [merchant] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, store.userId))
      .limit(1);
    if (!merchant || merchant.role !== "merchant" || !merchant.isActive) {
      return NextResponse.json(
        { error: "Active merchant account not found" },
        { status: 404 }
      );
    }

    const [membership] = await db
      .select({ isActive: adminMemberships.isActive, role: adminMemberships.role })
      .from(adminMemberships)
      .where(eq(adminMemberships.userId, user.id))
      .limit(1);
    if (!membership?.isActive || membership.role !== "superadmin") {
      return NextResponse.json({ error: "Superadmin only" }, { status: 403 });
    }

    const { token, tokenHash } = createImpersonationToken();
    const expiresAt = new Date(
      Date.now() + parsed.data.durationMinutes * 60 * 1000
    );
    const { ipAddress, userAgent } = getClientInfo(request);

    const session = await db.transaction(async (tx) => {
      const revokedSessions = await tx
        .update(adminImpersonationSessions)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(adminImpersonationSessions.adminUserId, user.id),
            isNull(adminImpersonationSessions.revokedAt)
          )
        )
        .returning({ id: adminImpersonationSessions.id });

      const [created] = await tx
        .insert(adminImpersonationSessions)
        .values({
          tokenHash,
          adminUserId: user.id,
          merchantUserId: merchant.id,
          storeId: store.id,
          expiresAt,
        })
        .returning();

      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "admin.merchant.impersonate",
        resourceType: "business",
        resourceId: store.id,
        storeId: store.id,
        previousValue: {
          revokedSessionIds: revokedSessions.map((session) => session.id),
        },
        newValue: {
          impersonationSessionId: created.id,
          merchantUserId: merchant.id,
          expiresAt: expiresAt.toISOString(),
          revokedPriorSessionCount: revokedSessions.length,
        },
        ipAddress,
        userAgent,
      });

      return created;
    });

    return NextResponse.json({
      impersonation: {
        id: session.id,
        token,
        storeId: store.id,
        storeName: store.storeName,
        merchantUserId: merchant.id,
        merchantEmail: merchant.email,
        merchantFullName: merchant.fullName,
        expiresAt,
      },
    });
  } catch (error) {
    console.error("Impersonation error:", error);
    return NextResponse.json(
      { error: "Failed to create impersonation session" },
      { status: 500 }
    );
  }
}
