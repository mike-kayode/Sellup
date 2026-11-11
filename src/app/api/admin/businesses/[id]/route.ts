import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  adminImpersonationSessions,
  aiGenerations,
  apiKeys,
  auditLogs,
  businessInternalNotes,
  businesses,
  domains,
  orders,
  products,
  staffMembers,
  subscriptions,
  users,
  webhooks,
} from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";

const businessIdSchema = z.string().uuid();
const reasonSchema = z.string().trim().min(1).max(500);
const statusActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suspend"), reason: reasonSchema }).strict(),
  z.object({ action: z.literal("restrict"), reason: reasonSchema }).strict(),
  z.object({ action: z.literal("restore"), reason: reasonSchema }).strict(),
  z.object({ action: z.literal("verify"), reason: reasonSchema }).strict(),
]);
const deleteSchema = z
  .object({ confirmation: z.string().trim().min(1).max(255) })
  .strict();

export async function GET(
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
    if (!businessIdSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Invalid business id" }, { status: 400 });
    }

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, id))
      .limit(1);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
      owner,
      orderTotals,
      productTotal,
      staffTotal,
      subscription,
      recentOrders,
      recentProducts,
      businessDomains,
      businessApiKeys,
      businessWebhooks,
      aiUsage,
      notes,
      activeSessions,
    ] = await Promise.all([
      db
        .select({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          phone: users.phone,
          role: users.role,
          isEmailVerified: users.isEmailVerified,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, business.userId))
        .limit(1),
      db
        .select({
          total: count(),
          revenue: sql<string>`COALESCE(SUM(
            CASE WHEN ${orders.paymentStatus} = 'paid' THEN ${orders.total} ELSE 0 END
          ), 0)::text`,
        })
        .from(orders)
        .where(eq(orders.storeId, id)),
      db
        .select({ total: count() })
        .from(products)
        .where(eq(products.storeId, id)),
      db
        .select({ total: count() })
        .from(staffMembers)
        .where(eq(staffMembers.storeId, id)),
      db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.storeId, id))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1),
      db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          total: orders.total,
          status: orders.status,
          paymentStatus: orders.paymentStatus,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(eq(orders.storeId, id))
        .orderBy(desc(orders.createdAt))
        .limit(10),
      db
        .select({
          id: products.id,
          name: products.name,
          price: products.price,
          isActive: products.isActive,
          createdAt: products.createdAt,
        })
        .from(products)
        .where(eq(products.storeId, id))
        .orderBy(desc(products.createdAt))
        .limit(10),
      db
        .select({
          id: domains.id,
          domain: domains.domain,
          status: domains.status,
          sslStatus: domains.sslStatus,
          verificationStatus: domains.verificationStatus,
          dnsCheckedAt: domains.dnsCheckedAt,
          expiresAt: domains.expiresAt,
        })
        .from(domains)
        .where(eq(domains.storeId, id))
        .orderBy(desc(domains.createdAt))
        .limit(20),
      db
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          prefix: apiKeys.prefix,
          scopes: apiKeys.scopes,
          isActive: apiKeys.isActive,
          lastUsedAt: apiKeys.lastUsedAt,
          expiresAt: apiKeys.expiresAt,
          createdAt: apiKeys.createdAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.storeId, id))
        .orderBy(desc(apiKeys.createdAt))
        .limit(20),
      db
        .select({
          id: webhooks.id,
          url: webhooks.url,
          events: webhooks.events,
          status: webhooks.status,
          lastDelivery: webhooks.lastDelivery,
          failureCount: webhooks.failureCount,
          createdAt: webhooks.createdAt,
        })
        .from(webhooks)
        .where(eq(webhooks.storeId, id))
        .orderBy(desc(webhooks.createdAt))
        .limit(20),
      db
        .select({
          provider: aiGenerations.provider,
          feature: aiGenerations.feature,
          requests: count(),
          inputTokens: sql<number>`COALESCE(SUM(${aiGenerations.inputTokens}), 0)::int`,
          outputTokens: sql<number>`COALESCE(SUM(${aiGenerations.outputTokens}), 0)::int`,
          costUsd: sql<string>`COALESCE(SUM(${aiGenerations.costUsd}), 0)::text`,
        })
        .from(aiGenerations)
        .where(
          and(
            eq(aiGenerations.storeId, id),
            gte(aiGenerations.createdAt, since)
          )
        )
        .groupBy(aiGenerations.provider, aiGenerations.feature)
        .orderBy(desc(sql`count(*)`))
        .limit(20),
      db
        .select({
          id: businessInternalNotes.id,
          actorId: businessInternalNotes.actorId,
          note: businessInternalNotes.note,
          createdAt: businessInternalNotes.createdAt,
          actorName: users.fullName,
        })
        .from(businessInternalNotes)
        .leftJoin(users, eq(users.id, businessInternalNotes.actorId))
        .where(eq(businessInternalNotes.storeId, id))
        .orderBy(desc(businessInternalNotes.createdAt))
        .limit(20),
      db
        .select({ total: count() })
        .from(adminImpersonationSessions)
        .where(
          and(
            eq(adminImpersonationSessions.storeId, id),
            sql`${adminImpersonationSessions.revokedAt} IS NULL`,
            gte(adminImpersonationSessions.expiresAt, new Date())
          )
        ),
    ]);

    return NextResponse.json({
      business,
      owner: owner[0] ?? null,
      canImpersonate: user.role === "superadmin",
      stats: {
        orders: orderTotals[0]?.total ?? 0,
        products: productTotal[0]?.total ?? 0,
        staff: staffTotal[0]?.total ?? 0,
        revenue: orderTotals[0]?.revenue ?? "0",
      },
      subscription: subscription[0] ?? null,
      recentOrders,
      recentProducts,
      domains: businessDomains,
      apiKeys: businessApiKeys,
      webhooks: businessWebhooks.map((webhook) => {
        let endpoint = webhook.url;
        try {
          const parsed = new URL(webhook.url);
          endpoint = `${parsed.origin}${parsed.pathname}`;
        } catch {
          endpoint = "Invalid endpoint";
        }
        return { ...webhook, url: endpoint };
      }),
      aiUsage: {
        rangeDays: 30,
        groups: aiUsage,
      },
      notes,
      activeImpersonationSessions: activeSessions[0]?.total ?? 0,
    });
  } catch (error) {
    console.error("Admin business detail error:", error);
    return NextResponse.json(
      { error: "Failed to load business details" },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    if (!businessIdSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Invalid business id" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = statusActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid business action", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, id))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const previousValue = {
      isPublished: existing.isPublished,
      isSuspended: existing.isSuspended,
      isRestricted: existing.isRestricted,
      isVerified: existing.isVerified,
      statusReason: existing.statusReason,
    };
    const updates: {
      isSuspended?: boolean;
      isRestricted?: boolean;
      isVerified?: boolean;
      statusReason?: string | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    const action = parsed.data.action;

    if (action === "suspend") {
      updates.isSuspended = true;
      updates.statusReason = parsed.data.reason;
    } else if (action === "restrict") {
      updates.isRestricted = true;
      updates.statusReason = parsed.data.reason;
    } else if (action === "restore") {
      updates.isSuspended = false;
      updates.isRestricted = false;
      updates.statusReason = null;
    } else {
      updates.isVerified = true;
    }

    const { ipAddress, userAgent } = getClientInfo(request);
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(businesses)
        .set(updates)
        .where(eq(businesses.id, id))
        .returning();
      if (!row) throw new Error("Business not found during update");

      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: `business.${action}`,
        resourceType: "business",
        resourceId: id,
        storeId: id,
        previousValue,
        newValue: {
          isPublished: row.isPublished,
          isSuspended: row.isSuspended,
          isRestricted: row.isRestricted,
          isVerified: row.isVerified,
          statusReason: row.statusReason,
          reason: parsed.data.reason,
        },
        ipAddress,
        userAgent,
      });
      return row;
    });

    return NextResponse.json({ business: updated });
  } catch (error) {
    console.error("Admin business update error:", error);
    return NextResponse.json(
      { error: "Failed to update business" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    if (!businessIdSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Invalid business id" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Typed business-name confirmation is required" },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, id))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }
    if (parsed.data.confirmation !== existing.storeName) {
      return NextResponse.json(
        { error: "Business name confirmation does not match" },
        { status: 400 }
      );
    }

    const { ipAddress, userAgent } = getClientInfo(request);
    await db.transaction(async (tx) => {
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "business.deleted",
        resourceType: "business",
        resourceId: id,
        storeId: id,
        previousValue: {
          storeName: existing.storeName,
          storeSlug: existing.storeSlug,
          ownerId: existing.userId,
        },
        newValue: { deleted: true },
        ipAddress,
        userAgent,
      });
      await tx.delete(businesses).where(eq(businesses.id, id));
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin business delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete business" },
      { status: 500 }
    );
  }
}
