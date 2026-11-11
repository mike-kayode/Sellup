import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { adminImpersonationSessions, auditLogs } from "@/db/schema";
import { getClientInfo } from "@/lib/admin-audit";
import {
  isAdminImpersonationToken,
  resolveActiveImpersonation,
} from "@/lib/admin-impersonation";

export async function DELETE(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (!token || !isAdminImpersonationToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const impersonation = await resolveActiveImpersonation(token);
    if (!impersonation) {
      return NextResponse.json(
        { error: "Impersonation session is expired or revoked" },
        { status: 401 }
      );
    }

    const { ipAddress, userAgent } = getClientInfo(request);
    await db.transaction(async (tx) => {
      const [revoked] = await tx
        .update(adminImpersonationSessions)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(adminImpersonationSessions.id, impersonation.id),
            isNull(adminImpersonationSessions.revokedAt)
          )
        )
        .returning({ id: adminImpersonationSessions.id });

      if (!revoked) return;

      await tx.insert(auditLogs).values({
        actorId: impersonation.adminUserId,
        actorRole: "superadmin",
        action: "admin.merchant.impersonation_exit",
        resourceType: "business",
        resourceId: impersonation.storeId,
        storeId: impersonation.storeId,
        previousValue: {
          impersonationSessionId: impersonation.id,
        },
        newValue: { revoked: true },
        ipAddress,
        userAgent,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Impersonation exit error:", error);
    return NextResponse.json(
      { error: "Failed to end impersonation session" },
      { status: 500 }
    );
  }
}
