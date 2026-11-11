import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  auditLogs,
  customers,
  customerSessions,
} from "@/db/schema";
import { getClientInfo } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";

const paramsSchema = z.string().uuid();
const actionSchema = z
  .object({
    storeId: z.string().uuid(),
    action: z.enum(["block", "unblock"]),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!paramsSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Invalid buyer id" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid buyer action", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select({
        id: customers.id,
        storeId: customers.storeId,
        isBlocked: customers.isBlocked,
      })
      .from(customers)
      .where(
        and(eq(customers.id, id), eq(customers.storeId, parsed.data.storeId))
      )
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Buyer not found" }, { status: 404 });
    }

    const blocked = parsed.data.action === "block";
    if (existing.isBlocked === blocked) {
      return NextResponse.json({ error: "Buyer already has this status" }, { status: 409 });
    }

    const { ipAddress, userAgent } = getClientInfo(request);
    await db.transaction(async (tx) => {
      await tx
        .update(customers)
        .set({ isBlocked: blocked, updatedAt: new Date() })
        .where(
          and(eq(customers.id, id), eq(customers.storeId, parsed.data.storeId))
        );

      let revokedSessions: { id: string }[] = [];
      if (blocked) {
        revokedSessions = await tx
          .update(customerSessions)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(customerSessions.customerId, id),
              eq(customerSessions.storeId, parsed.data.storeId),
              isNull(customerSessions.revokedAt)
            )
          )
          .returning({ id: customerSessions.id });
      }

      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: `buyer.${parsed.data.action}`,
        resourceType: "customer",
        resourceId: id,
        storeId: parsed.data.storeId,
        previousValue: { isBlocked: existing.isBlocked },
        newValue: {
          isBlocked: blocked,
          reason: parsed.data.reason,
          revokedSessionCount: revokedSessions.length,
        },
        ipAddress,
        userAgent,
      });
    });

    return NextResponse.json({ success: true, isBlocked: blocked });
  } catch (error) {
    console.error("Admin buyer update error:", error);
    return NextResponse.json({ error: "Failed to update buyer" }, { status: 500 });
  }
}
