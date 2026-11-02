
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq, and, gte, lt } from "drizzle-orm";
import { createAuditLog } from "@/lib/admin-audit";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user } = auth;

  if (user.role !== "superadmin" && user.role !== "admin" && user.role !== "finance_manager") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    // Find subscriptions that are past due (period ended but not renewed/cancelled).
    const now = new Date();
    const overdue = await db
      .select({
        id: subscriptions.id,
        storeId: subscriptions.storeId,
        plan: subscriptions.plan,
        status: subscriptions.status,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, "active"),
          lt(subscriptions.currentPeriodEnd, now)
        )
      );

    const results = [];

    for (const sub of overdue) {
      // Mark as past due for dunning process.
      await db
        .update(subscriptions)
        .set({ status: "past_due" })
        .where(eq(subscriptions.id, sub.id));

      results.push({
        subscriptionId: sub.id,
        storeId: sub.storeId,
        plan: sub.plan,
        action: "marked_past_due",
      });

      try {
        await createAuditLog({
          actorId: user.id,
          actorRole: user.role,
          action: "admin.subscription.dunning",
          resourceType: "subscription",
          resourceId: sub.id,
          previousValue: { status: "active" },
          newValue: { status: "past_due", storeId: sub.storeId },
          ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
          userAgent: request.headers.get("user-agent") ?? undefined,
          status: "success",
        });
      } catch { /* ignore */ }
    }

    return NextResponse.json({ processed: results.length, subscriptions: results });
  } catch (error) {
    console.error("Subscription dunning error:", error);
    return NextResponse.json({ error: "Dunning process failed" }, { status: 500 });
  }
}
