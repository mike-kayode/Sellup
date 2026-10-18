import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { createAuditLog, getClientInfo } from "@/lib/admin-audit";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const url = new URL(request.url);
    const event = url.searchParams.get("event") || "";
    const status = url.searchParams.get("status") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const totalAgg = await db.select({ total: count() }).from(webhooks);
    const list = await db.select().from(webhooks).orderBy(desc(webhooks.createdAt)).limit(limit).offset(offset);

    const webhookRows = list.map((hook) => ({
      id: hook.id,
      url: hook.url,
      events: Array.isArray(hook.events) ? hook.events : [],
      status: hook.status,
      lastDelivery: hook.lastDelivery,
      retryCount: hook.retryCount,
      createdAt: hook.createdAt,
    }));

    return NextResponse.json({
      webhooks: webhookRows,
      total: totalAgg[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin webhooks error:", error);
    return NextResponse.json({ error: "Failed to load webhooks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const body = await request.json();
    const [webhook] = await db.insert(webhooks).values({
      url: body.url,
      events: body.events || [body.event || "order.created"],
      status: body.status || "active",
      secret: body.secret || `whsec_${Math.random().toString(36).slice(2, 12)}`,
      retryCount: 0,
      failureCount: 0,
    }).returning();

    const clientInfo = getClientInfo(request);
    if (user) {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "webhook.created",
        resourceType: "webhook",
        resourceId: webhook.id,
        newValue: { url: body.url, event: body.event },
        ...clientInfo,
      });
    }

    return NextResponse.json({ webhook }, { status: 201 });
  } catch (error) {
    console.error("Admin webhooks create error:", error);
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 });
  }
}
