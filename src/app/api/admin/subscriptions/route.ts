import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, plans, subscriptions, stores } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";

const updateSchema = z.object({
  subscriptionId: z.string().uuid(),
  plan: z.string().min(1).max(50).optional(),
  status: z.enum(["active", "trialing", "past_due", "cancelled", "incomplete"]).optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  reason: z.string().trim().min(1).max(500),
}).strict().refine(
  ({ subscriptionId: _id, reason: _reason, ...changes }) => Object.keys(changes).length > 0,
  "At least one subscription field must be changed"
);

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "all";
    const plan = url.searchParams.get("plan") || "all";
    const search = (url.searchParams.get("search") || "").trim().slice(0, 100);
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20));
    const filters = [];
    if (status !== "all") filters.push(eq(subscriptions.status, status));
    if (plan !== "all") filters.push(eq(subscriptions.plan, plan));
    if (search) filters.push(sql`lower(${stores.storeName}) LIKE ${`${search.toLowerCase()}%`}`);
    const where = filters.length ? and(...filters) : undefined;

    const [totalResult, subList, availablePlans] = await Promise.all([
      db.select({ total: count() }).from(subscriptions)
        .innerJoin(stores, eq(stores.id, subscriptions.storeId))
        .where(where),
      db.select({
        id: subscriptions.id,
        plan: subscriptions.plan,
        status: subscriptions.status,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        gateway: subscriptions.gateway,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        createdAt: subscriptions.createdAt,
        storeId: subscriptions.storeId,
        storeName: stores.storeName,
        storeSlug: stores.storeSlug,
      }).from(subscriptions)
        .innerJoin(stores, eq(stores.id, subscriptions.storeId))
        .where(where)
        .orderBy(desc(subscriptions.createdAt), desc(subscriptions.id))
        .limit(limit).offset((page - 1) * limit),
      db.select({ slug: plans.slug, name: plans.name })
        .from(plans).where(eq(plans.isActive, true)).orderBy(plans.sortOrder, plans.name),
    ]);

    return NextResponse.json({
      subscriptions: subList,
      availablePlans,
      total: totalResult[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin subscriptions error:", error);
    return NextResponse.json({ error: "Failed to load subscriptions" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subscription update", details: parsed.error.flatten() }, { status: 400 });
  }
  const { subscriptionId, reason, ...changes } = parsed.data;

  try {
    if (changes.plan) {
      const [activePlan] = await db.select({ slug: plans.slug }).from(plans)
        .where(and(eq(plans.slug, changes.plan), eq(plans.isActive, true))).limit(1);
      if (!activePlan) return NextResponse.json({ error: "Unknown or inactive plan" }, { status: 400 });
    }
    const { ipAddress, userAgent } = getClientInfo(request);
    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId)).limit(1);
      if (!existing) return null;
      const [saved] = await tx.update(subscriptions)
        .set({
          ...changes,
          ...(changes.status && changes.status !== "past_due"
            ? {
                dunningAttempts: 0,
                dunningNextAttemptAt: null,
                dunningLockedAt: null,
                dunningLastError: null,
              }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscriptionId))
        .returning();
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "admin.subscription.updated",
        resourceType: "subscription",
        resourceId: subscriptionId,
        storeId: existing.storeId,
        previousValue: existing,
        newValue: { ...saved, reason },
        ipAddress,
        userAgent,
      });
      return saved;
    });
    if (!updated) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    return NextResponse.json({ subscription: updated });
  } catch (error) {
    console.error("Admin subscription update error:", error);
    return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 });
  }
}
