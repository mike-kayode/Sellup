import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhookDeliveries, webhooks } from "@/db/schema";
import { eq, and, lt, sql } from "drizzle-orm";
import crypto from "crypto";

const BATCH_SIZE = 25;
const BACKOFF_MULTIPLIERS = [60, 300, 1800, 7200, 43200]; // 1m, 5m, 30m, 2h, 12s

export async function POST(request: NextRequest) {
  // Cron secret protection.
  const secret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const now = new Date();

    // Fetch due deliveries (pending, next attempt <= now), bounded batch.
    const due = await db
      .select({
        id: webhookDeliveries.id,
        storeId: webhookDeliveries.storeId,
        webhookId: webhookDeliveries.webhookId,
        event: webhookDeliveries.event,
        url: webhookDeliveries.url,
        status: webhookDeliveries.status,
        attempt: webhookDeliveries.attempt,
        maxAttempts: webhookDeliveries.maxAttempts,
        nextAttemptAt: webhookDeliveries.nextAttemptAt,
        lastHttpCode: webhookDeliveries.lastHttpCode,
        lastError: webhookDeliveries.lastError,
      })
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.status, "pending"),
          lt(webhookDeliveries.nextAttemptAt, now)
        )
      )
      .limit(BATCH_SIZE);

    if (due.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    // Load webhook configs for signing.
    const webhookIds = [...new Set(due.map((d) => d.webhookId))];
    const webhookRows = await db
      .select({ id: webhooks.id, secret: webhooks.secret, status: webhooks.status })
      .from(webhooks)
      .where(sql`${webhooks.id} IN (${sql.raw(placeholders)})`, ...webhookIds);
    const webhookMap = new Map(webhookRows.map((w) => [w.id, w]));

    let delivered = 0;
    let failed = 0;

    for (const d of due) {
      const webhook = webhookMap.get(d.webhookId);
      if (!webhook || webhook.status !== "active") {
        await db
          .update(webhookDeliveries)
          .set({ status: "disabled", lastError: "Webhook inactive or missing" })
          .where(eq(webhookDeliveries.id, d.id));
        failed++;
        continue;
      }

      const body = JSON.stringify({ event: d.event, timestamp: new Date().toISOString(), data: {}, storeId: d.storeId });
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = crypto
        .createHmac("sha256", webhook.secret ?? "")
        .update(`${timestamp}.${body}`)
        .digest("hex");

      try {
        const res = await fetch(d.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Event": d.event,
            "X-Webhook-Timestamp": timestamp,
            "X-Webhook-Signature": `t=${timestamp},v1=${signature}`,
          },
          body,
        });

        if (res.ok) {
          await db
            .update(webhookDeliveries)
            .set({
              status: "delivered",
              deliveredAt: new Date(),
              lastHttpCode: res.status,
            })
            .where(eq(webhookDeliveries.id, d.id));
          delivered++;
        } else {
          throw new Error("HTTP " + res.status);
        }
      } catch (err: any) {
        const attempt = d.attempt + 1;
        const max = d.maxAttempts ?? 5;
        const backoffMs = BACKOFF_MULTIPLIERS[Math.min(attempt - 1, BACKOFF_MULTIPLIERS.length - 1)] * 1000;
        const nextAttempt = attempt >= max
          ? null
          : new Date(Date.now() + backoffMs);

        await db
          .update(webhookDeliveries)
          .set({
            status: nextAttempt ? "pending" : "failed",
            attempt,
            lastHttpCode: undefined,
            lastError: err?.message ?? String(err),
            nextAttemptAt: nextAttempt,
          })
          .where(eq(webhookDeliveries.id, d.id));
        failed++;
      }
    }

    return NextResponse.json({ processed: due.length, delivered, failed });
  } catch (error) {
    console.error("Webhook delivery cron error:", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
