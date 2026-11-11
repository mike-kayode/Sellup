import { and, asc, eq, gt, isNotNull, isNull, lt, lte, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  announcementDeliveryProgress,
  announcementDeliveries,
  announcements,
  businesses,
} from "@/db/schema";
import { EmailTemplate, sendEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp";

const FANOUT_BATCH_SIZE = 25;
const DELIVERY_BATCH_SIZE = 10;
const LEASE_TIMEOUT_MS = 10 * 60 * 1000;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000];

type Channel = "email" | "whatsapp";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const now = new Date();
    const fanout = await fanOutNextAnnouncement(now);
    const delivery = await deliverDueMessages(now);
    return NextResponse.json({
      fanoutStores: fanout.stores,
      queued: fanout.queued,
      fanoutComplete: fanout.complete,
      processed: delivery.processed,
      sent: delivery.sent,
      retried: delivery.retried,
      failed: delivery.failed,
    });
  } catch (error) {
    console.error("Announcement delivery cron failed:", error);
    return NextResponse.json({ error: "Announcement delivery failed" }, { status: 500 });
  }
}

async function fanOutNextAnnouncement(now: Date): Promise<{
  stores: number;
  queued: number;
  complete: boolean;
}> {
  return db.transaction(async (tx) => {
    const [progress] = await tx.select({
      announcementId: announcementDeliveryProgress.announcementId,
      lastStoreId: announcementDeliveryProgress.lastStoreId,
      target: announcements.target,
      targetPlan: announcements.targetPlan,
      targetStoreId: announcements.targetStoreId,
      sendEmail: announcements.sendEmail,
      sendWhatsApp: announcements.sendWhatsApp,
    }).from(announcementDeliveryProgress)
      .innerJoin(announcements, eq(announcements.id, announcementDeliveryProgress.announcementId))
      .where(and(
        eq(announcementDeliveryProgress.isComplete, false),
        eq(announcements.isActive, true),
        or(isNull(announcements.scheduledAt), lte(announcements.scheduledAt, now)),
        or(isNull(announcements.expiresAt), gt(announcements.expiresAt, now)),
        or(eq(announcements.sendEmail, true), eq(announcements.sendWhatsApp, true)),
      ))
      .orderBy(asc(announcementDeliveryProgress.updatedAt))
      .limit(1)
      .for("update");

    if (!progress) return { stores: 0, queued: 0, complete: false };

    const targetIsValid = progress.target === "all"
      || (progress.target === "plan" && Boolean(progress.targetPlan))
      || (progress.target === "store" && Boolean(progress.targetStoreId));
    if (!targetIsValid) {
      await tx.update(announcementDeliveryProgress).set({
        isComplete: true,
        updatedAt: now,
      }).where(eq(announcementDeliveryProgress.announcementId, progress.announcementId));
      console.error("Announcement delivery skipped because its target is invalid");
      return { stores: 0, queued: 0, complete: true };
    }

    const conditions = [];
    if (progress.lastStoreId) conditions.push(gt(businesses.id, progress.lastStoreId));
    if (progress.target === "plan" && progress.targetPlan) {
      conditions.push(eq(businesses.plan, progress.targetPlan));
    } else if (progress.target === "store" && progress.targetStoreId) {
      conditions.push(eq(businesses.id, progress.targetStoreId));
    }

    const recipients = await tx.select({
      id: businesses.id,
      email: businesses.email,
      whatsappNumber: businesses.whatsappNumber,
      emailOptOut: businesses.announcementEmailOptOut,
      whatsappOptOut: businesses.announcementWhatsAppOptOut,
    }).from(businesses)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(businesses.id))
      .limit(FANOUT_BATCH_SIZE);

    const deliveries: Array<{
      announcementId: string;
      storeId: string;
      channel: Channel;
      recipient: string;
    }> = [];
    for (const recipient of recipients) {
      if (progress.sendEmail && recipient.email && !recipient.emailOptOut) {
        deliveries.push({
          announcementId: progress.announcementId,
          storeId: recipient.id,
          channel: "email",
          recipient: recipient.email,
        });
      }
      if (progress.sendWhatsApp && recipient.whatsappNumber && !recipient.whatsappOptOut) {
        deliveries.push({
          announcementId: progress.announcementId,
          storeId: recipient.id,
          channel: "whatsapp",
          recipient: recipient.whatsappNumber,
        });
      }
    }

    if (deliveries.length) {
      await tx.insert(announcementDeliveries).values(deliveries).onConflictDoNothing();
    }

    const complete = recipients.length < FANOUT_BATCH_SIZE || progress.target === "store";
    await tx.update(announcementDeliveryProgress).set({
      lastStoreId: recipients.at(-1)?.id ?? progress.lastStoreId,
      isComplete: complete,
      updatedAt: now,
    }).where(eq(announcementDeliveryProgress.announcementId, progress.announcementId));

    return { stores: recipients.length, queued: deliveries.length, complete };
  });
}

async function deliverDueMessages(now: Date): Promise<{
  processed: number;
  sent: number;
  retried: number;
  failed: number;
}> {
  const staleBefore = new Date(now.getTime() - LEASE_TIMEOUT_MS);
  const staleRows = await db.select({
    id: announcementDeliveries.id,
    attempts: announcementDeliveries.attempts,
    maxAttempts: announcementDeliveries.maxAttempts,
  })
    .from(announcementDeliveries)
    .where(and(
      eq(announcementDeliveries.status, "sending"),
      lt(announcementDeliveries.lockedAt, staleBefore),
    ))
    .orderBy(asc(announcementDeliveries.lockedAt))
    .limit(DELIVERY_BATCH_SIZE);
  for (const row of staleRows) {
    await db.update(announcementDeliveries)
      .set({
        status: row.attempts >= row.maxAttempts ? "failed" : "pending",
        lockedAt: null,
        nextAttemptAt: now,
        ...(row.attempts >= row.maxAttempts
          ? { lastError: "Delivery worker lease expired after maximum attempts" }
          : {}),
      })
      .where(and(
        eq(announcementDeliveries.id, row.id),
        eq(announcementDeliveries.status, "sending"),
      ));
  }

  const expiredRows = await db.select({ id: announcementDeliveries.id })
    .from(announcementDeliveries)
    .innerJoin(announcements, eq(announcements.id, announcementDeliveries.announcementId))
    .where(and(
      eq(announcementDeliveries.status, "pending"),
      isNotNull(announcements.expiresAt),
      lte(announcements.expiresAt, now),
    ))
    .orderBy(asc(announcementDeliveries.nextAttemptAt))
    .limit(DELIVERY_BATCH_SIZE);
  for (const row of expiredRows) {
    await db.update(announcementDeliveries).set({
      status: "cancelled",
      lockedAt: null,
      lastError: "Announcement expired before delivery",
    }).where(and(
      eq(announcementDeliveries.id, row.id),
      eq(announcementDeliveries.status, "pending"),
    ));
  }

  const due = await db.select({
    id: announcementDeliveries.id,
    announcementId: announcementDeliveries.announcementId,
    storeId: announcementDeliveries.storeId,
    channel: announcementDeliveries.channel,
    recipient: announcementDeliveries.recipient,
    attempts: announcementDeliveries.attempts,
    maxAttempts: announcementDeliveries.maxAttempts,
    title: announcements.title,
    message: announcements.message,
    email: businesses.email,
    whatsappNumber: businesses.whatsappNumber,
    emailOptOut: businesses.announcementEmailOptOut,
    whatsappOptOut: businesses.announcementWhatsAppOptOut,
  }).from(announcementDeliveries)
    .innerJoin(announcements, eq(announcements.id, announcementDeliveries.announcementId))
    .innerJoin(businesses, eq(businesses.id, announcementDeliveries.storeId))
    .where(and(
      eq(announcementDeliveries.status, "pending"),
      lte(announcementDeliveries.nextAttemptAt, now),
      eq(announcements.isActive, true),
      or(isNull(announcements.scheduledAt), lte(announcements.scheduledAt, now)),
      or(isNull(announcements.expiresAt), gt(announcements.expiresAt, now)),
    ))
    .orderBy(asc(announcementDeliveries.nextAttemptAt), asc(announcementDeliveries.id))
    .limit(DELIVERY_BATCH_SIZE);

  let sent = 0;
  let retried = 0;
  let failed = 0;
  let processed = 0;

  for (const row of due) {
    const [claimed] = await db.update(announcementDeliveries).set({
      status: "sending",
      attempts: row.attempts + 1,
      lockedAt: now,
      lastError: null,
    }).where(and(
      eq(announcementDeliveries.id, row.id),
      eq(announcementDeliveries.status, "pending"),
    )).returning({ id: announcementDeliveries.id });
    if (!claimed) continue;

    processed++;
    const recipientStillValid = row.channel === "email"
      ? !row.emailOptOut && row.email === row.recipient
      : row.channel === "whatsapp"
        ? !row.whatsappOptOut && row.whatsappNumber === row.recipient
        : false;
    if (!recipientStillValid) {
      await db.update(announcementDeliveries).set({
        status: "cancelled",
        lockedAt: null,
        lastError: "Recipient opted out or contact information changed",
      }).where(eq(announcementDeliveries.id, row.id));
      continue;
    }

    let delivered = false;
    try {
      delivered = row.channel === "email"
        ? await sendEmail({
            to: row.recipient,
            subject: row.title,
            template: EmailTemplate.ANNOUNCEMENT,
            data: {
              title: row.title,
              message: row.message,
              preferencesUrl: `${(process.env.NEXT_PUBLIC_APP_URL || "https://app.sellup.ng").replace(/\/+$/, "")}/dashboard/settings`,
            },
          })
        : row.channel === "whatsapp"
          ? await sendWhatsApp({ to: row.recipient, message: `${row.title}\n\n${row.message}` })
          : false;
    } catch (error) {
      console.error("Announcement delivery provider call failed:", error);
    }

    if (delivered) {
      await db.update(announcementDeliveries).set({
        status: "sent",
        sentAt: new Date(),
        lockedAt: null,
        lastError: null,
      }).where(eq(announcementDeliveries.id, row.id));
      sent++;
      continue;
    }

    const attempt = row.attempts + 1;
    const hasRetries = attempt < row.maxAttempts;
    await db.update(announcementDeliveries).set({
      status: hasRetries ? "pending" : "failed",
      lockedAt: null,
      nextAttemptAt: hasRetries
        ? new Date(now.getTime() + RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)])
        : now,
      lastError: "Delivery provider returned a failure",
    }).where(eq(announcementDeliveries.id, row.id));
    if (hasRetries) retried++;
    else failed++;
  }

  return { processed, sent, retried, failed };
}
