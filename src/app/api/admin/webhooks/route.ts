import { randomBytes } from "crypto";
import { and, count, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, webhookDeliveries, webhooks } from "@/db/schema";
import { getClientInfo } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";

const createSchema = z.object({
  url: z.string().url().max(500).refine((value) => {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  }, "Webhook URL must use HTTP or HTTPS"),
  events: z.array(z.string().trim().min(1).max(100)).min(1).max(25),
  storeId: z.string().uuid().nullable().optional(),
}).strict();

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("disable"), id: z.string().uuid() }).strict(),
  z.object({ action: z.literal("redeliver"), deliveryId: z.string().uuid() }).strict(),
]);

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20));
    const webhookId = url.searchParams.get("webhookId");
    const requestedStatus = url.searchParams.get("status") || "all";
    const filters = [];
    if (webhookId && z.string().uuid().safeParse(webhookId).success) {
      filters.push(eq(webhooks.id, webhookId));
    }
    if (["active", "disabled"].includes(requestedStatus)) {
      filters.push(eq(webhooks.status, requestedStatus));
    }
    const where = filters.length ? and(...filters) : undefined;
    const deliveryFilters = [];
    if (webhookId && z.string().uuid().safeParse(webhookId).success) {
      deliveryFilters.push(eq(webhookDeliveries.webhookId, webhookId));
    }
    const deliveryStatus = url.searchParams.get("deliveryStatus") || "all";
    if (["pending", "delivered", "failed", "disabled"].includes(deliveryStatus)) {
      deliveryFilters.push(eq(webhookDeliveries.status, deliveryStatus));
    }
    const deliveryWhere = deliveryFilters.length ? and(...deliveryFilters) : undefined;

    const [totalResult, hookRows, deliveryTotal, deliveryRows] = await Promise.all([
      db.select({ total: count() }).from(webhooks).where(where),
      db.select({
        id: webhooks.id,
        storeId: webhooks.storeId,
        url: webhooks.url,
        events: webhooks.events,
        status: webhooks.status,
        lastDelivery: webhooks.lastDelivery,
        retryCount: webhooks.retryCount,
        failureCount: webhooks.failureCount,
        createdAt: webhooks.createdAt,
      }).from(webhooks).where(where)
        .orderBy(desc(webhooks.createdAt), desc(webhooks.id))
        .limit(limit).offset((page - 1) * limit),
      db.select({ total: count() }).from(webhookDeliveries).where(deliveryWhere),
      db.select({
        id: webhookDeliveries.id,
        webhookId: webhookDeliveries.webhookId,
        storeId: webhookDeliveries.storeId,
        event: webhookDeliveries.event,
        url: webhookDeliveries.url,
        status: webhookDeliveries.status,
        attempt: webhookDeliveries.attempt,
        maxAttempts: webhookDeliveries.maxAttempts,
        nextAttemptAt: webhookDeliveries.nextAttemptAt,
        lastHttpCode: webhookDeliveries.lastHttpCode,
        lastError: webhookDeliveries.lastError,
        createdAt: webhookDeliveries.createdAt,
        deliveredAt: webhookDeliveries.deliveredAt,
      }).from(webhookDeliveries).where(deliveryWhere)
        .orderBy(desc(webhookDeliveries.createdAt), desc(webhookDeliveries.id))
        .limit(limit).offset((page - 1) * limit),
    ]);

    return NextResponse.json({
      webhooks: hookRows.map((hook) => ({
        ...hook,
        events: Array.isArray(hook.events) ? hook.events : [],
      })),
      total: totalResult[0]?.total ?? 0,
      deliveries: deliveryRows,
      deliveryTotal: deliveryTotal[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (cause) {
    console.error("Admin webhooks list failed:", cause);
    return NextResponse.json({ error: "Failed to load webhooks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid webhook details", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const secret = `whsec_${randomBytes(32).toString("hex")}`;
    const { ipAddress, userAgent } = getClientInfo(request);
    const webhook = await db.transaction(async (tx) => {
      const [created] = await tx.insert(webhooks).values({
        url: parsed.data.url,
        events: parsed.data.events,
        storeId: parsed.data.storeId ?? null,
        status: "active",
        secret,
        retryCount: 0,
        failureCount: 0,
      }).returning({
        id: webhooks.id,
        url: webhooks.url,
        events: webhooks.events,
        storeId: webhooks.storeId,
        status: webhooks.status,
        createdAt: webhooks.createdAt,
      });
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "webhook.created",
        resourceType: "webhook",
        resourceId: created.id,
        storeId: created.storeId,
        newValue: { url: created.url, events: created.events, storeId: created.storeId },
        ipAddress,
        userAgent,
      });
      return created;
    });
    return NextResponse.json({ webhook: { ...webhook, secret } }, { status: 201 });
  } catch (cause) {
    console.error("Admin webhook creation failed:", cause);
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 });
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
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid webhook action", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const result = await db.transaction(async (tx) => {
      if (parsed.data.action === "disable") {
        const [before] = await tx.select({
          id: webhooks.id,
          status: webhooks.status,
          url: webhooks.url,
          storeId: webhooks.storeId,
        }).from(webhooks).where(eq(webhooks.id, parsed.data.id)).limit(1);
        if (!before) return { kind: "missing" as const };
        if (before.status === "disabled") return { kind: "ok" as const, item: before };
        const [after] = await tx.update(webhooks)
          .set({ status: "disabled", updatedAt: new Date() })
          .where(eq(webhooks.id, before.id))
          .returning({ id: webhooks.id, status: webhooks.status, url: webhooks.url, storeId: webhooks.storeId });
        await tx.insert(auditLogs).values({
          actorId: user.id,
          actorRole: user.role,
          action: "webhook.disabled",
          resourceType: "webhook",
          resourceId: before.id,
          storeId: before.storeId,
          previousValue: before,
          newValue: after,
          ipAddress,
          userAgent,
        });
        return { kind: "ok" as const, item: after };
      }

      const [before] = await tx.select({
        id: webhookDeliveries.id,
        webhookId: webhookDeliveries.webhookId,
        storeId: webhookDeliveries.storeId,
        status: webhookDeliveries.status,
        attempt: webhookDeliveries.attempt,
      }).from(webhookDeliveries).where(eq(webhookDeliveries.id, parsed.data.deliveryId)).limit(1);
      if (!before) return { kind: "missing" as const };
      if (before.status !== "failed") return { kind: "conflict" as const };
      const [activeWebhook] = await tx.select({ id: webhooks.id })
        .from(webhooks).where(and(eq(webhooks.id, before.webhookId), eq(webhooks.status, "active"))).limit(1);
      if (!activeWebhook) return { kind: "conflict" as const };

      const [after] = await tx.update(webhookDeliveries).set({
        status: "pending",
        attempt: 0,
        nextAttemptAt: new Date(Date.now() - 1000),
        lastError: null,
        lastHttpCode: null,
      }).where(eq(webhookDeliveries.id, before.id)).returning({
        id: webhookDeliveries.id,
        status: webhookDeliveries.status,
      });
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "webhook_delivery.redeliver",
        resourceType: "webhook_delivery",
        resourceId: before.id,
        storeId: before.storeId,
        previousValue: { status: before.status, attempt: before.attempt },
        newValue: { status: after.status, attempt: 0 },
        ipAddress,
        userAgent,
      });
      return { kind: "ok" as const, item: after };
    });
    if (result.kind === "missing") return NextResponse.json({ error: "Webhook or delivery not found" }, { status: 404 });
    if (result.kind === "conflict") return NextResponse.json({ error: "Only failed deliveries for active webhooks can be redelivered" }, { status: 409 });
    return NextResponse.json({ result: result.item });
  } catch (cause) {
    console.error("Admin webhook action failed:", cause);
    return NextResponse.json({ error: "Failed to update webhook" }, { status: 500 });
  }
}
