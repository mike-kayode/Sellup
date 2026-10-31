import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireMerchant } from "@/lib/merchant-auth";
import { createMerchantAuditLog } from "@/lib/admin-audit";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";

const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).nonempty(),
  secret: z.string().min(16).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireMerchant(request);
  if (auth.error) return auth.error;
  const { merchant } = auth!;

  try {
    const rows = await db
      .select({
        id: webhooks.id,
        url: webhooks.url,
        events: webhooks.events,
        status: webhooks.status,
        secret: webhooks.secret,
        lastDelivery: webhooks.lastDelivery,
        retryCount: webhooks.retryCount,
        failureCount: webhooks.failureCount,
        createdAt: webhooks.createdAt,
        updatedAt: webhooks.updatedAt,
      })
      .from(webhooks)
      .where(eq(webhooks.storeId, merchant.storeId))
      .orderBy(webhooks.createdAt);

    return NextResponse.json({ webhooks: rows });
  } catch (error) {
    console.error("Webhooks list error:", error);
    return NextResponse.json({ error: "Failed to list webhooks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireMerchant(request);
  if (auth.error) return auth.error;
  const { merchant } = auth!;

  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rate = await checkAuthRateLimit("merchant-webhook-create:" + ip);
    if (!rate.success) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await request.json();
    const { url, events, secret } = createWebhookSchema.parse(body);

    const webhookSecret = secret || crypto.randomBytes(32).toString("hex");

    const [inserted] = await db
      .insert(webhooks)
      .values({
        storeId: merchant.storeId,
        url,
        events,
        secret: webhookSecret,
        status: "active",
      })
      .returning();

    try {
      await createMerchantAuditLog({
        actorId: merchant.userId,
        actorRole: "merchant",
        action: "merchant.webhook.create",
        resourceType: "webhook",
        resourceId: inserted.id,
        storeId: merchant.storeId,
        previousValue: undefined,
        newValue: { storeId: merchant.storeId, url, events },
        ipAddress: ip,
        userAgent: request.headers.get("user-agent") ?? undefined,
        status: "success",
      });
    } catch { /* ignore */ }

    return NextResponse.json({ webhook: inserted }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }
    console.error("Webhook create error:", error);
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 });
  }
}
