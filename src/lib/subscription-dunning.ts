import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  businesses,
  payments,
  plans,
  subscriptions,
  users,
} from "@/db/schema";
import { decimalToMinorUnits } from "@/lib/admin-payments";
import { EmailTemplate, sendEmail } from "@/lib/email";
import { initializePayment, PaymentProvider } from "@/lib/payment";
import { getPlan } from "@/lib/subscriptions";
import { normalizePlan } from "@/lib/entitlements";

const DUNNING_BATCH_SIZE = 25;
const RETRY_DELAY_DAYS = [1, 3, 7];
const MAX_DUNNING_ATTEMPTS = RETRY_DELAY_DAYS.length + 1;
const LEASE_TIMEOUT_MS = 10 * 60 * 1000;

interface DunningActor {
  id: string | null;
  role: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface DueSubscription {
  id: string;
  storeId: string;
  plan: string;
  gateway: string | null;
  attempts: number;
  ownerId: string;
  storeName: string;
  email: string | null;
}

export async function markExpiredSubscriptionsPastDue(actor: DunningActor) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const expired = await tx.select({
      id: subscriptions.id,
      storeId: subscriptions.storeId,
      plan: subscriptions.plan,
      status: subscriptions.status,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
    }).from(subscriptions)
      .where(and(
        eq(subscriptions.status, "active"),
        lt(subscriptions.currentPeriodEnd, now),
      ))
      .orderBy(asc(subscriptions.currentPeriodEnd), asc(subscriptions.id))
      .limit(DUNNING_BATCH_SIZE);

    const processed = [];
    for (const subscription of expired) {
      const [updated] = await tx.update(subscriptions)
        .set({
          status: "past_due",
          dunningAttempts: 0,
          dunningNextAttemptAt: now,
          dunningLockedAt: null,
          dunningLastError: null,
          updatedAt: now,
        })
        .where(and(
          eq(subscriptions.id, subscription.id),
          eq(subscriptions.status, "active"),
        ))
        .returning({ id: subscriptions.id });
      if (!updated) continue;

      await tx.insert(auditLogs).values({
        actorId: actor.id,
        actorRole: actor.role,
        action: "subscription.dunning_started",
        resourceType: "subscription",
        resourceId: subscription.id,
        storeId: subscription.storeId,
        previousValue: {
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
        newValue: { status: "past_due", nextAttemptAt: now },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      });
      processed.push({ subscriptionId: subscription.id, storeId: subscription.storeId });
    }

    return {
      processed: processed.length,
      subscriptions: processed,
      batchLimit: DUNNING_BATCH_SIZE,
    };
  });
}

export async function processDueSubscriptionRetries(actor: DunningActor) {
  const now = new Date();
  const staleLease = new Date(now.getTime() - LEASE_TIMEOUT_MS);
  const due = await db.transaction(async (tx) => {
    const rows = await tx.select({
      id: subscriptions.id,
      storeId: subscriptions.storeId,
      plan: subscriptions.plan,
      gateway: subscriptions.gateway,
      attempts: subscriptions.dunningAttempts,
      ownerId: businesses.userId,
      storeName: businesses.storeName,
      storeEmail: businesses.email,
      ownerEmail: users.email,
    }).from(subscriptions)
      .innerJoin(businesses, eq(businesses.id, subscriptions.storeId))
      .innerJoin(users, eq(users.id, businesses.userId))
      .where(and(
        eq(subscriptions.status, "past_due"),
        lte(subscriptions.dunningNextAttemptAt, now),
        or(isNull(subscriptions.dunningLockedAt), lt(subscriptions.dunningLockedAt, staleLease)),
      ))
      .orderBy(asc(subscriptions.dunningNextAttemptAt), asc(subscriptions.id))
      .limit(DUNNING_BATCH_SIZE)
      .for("update");

    const claimed: DueSubscription[] = [];
    for (const row of rows) {
      const [claim] = await tx.update(subscriptions)
        .set({ dunningLockedAt: now })
        .where(and(
          eq(subscriptions.id, row.id),
          eq(subscriptions.status, "past_due"),
          or(isNull(subscriptions.dunningLockedAt), lt(subscriptions.dunningLockedAt, staleLease)),
        ))
        .returning({ id: subscriptions.id });
      if (!claim) continue;
      claimed.push({
        id: row.id,
        storeId: row.storeId,
        plan: row.plan,
        gateway: row.gateway,
        attempts: row.attempts,
        ownerId: row.ownerId,
        storeName: row.storeName,
        email: row.storeEmail || row.ownerEmail,
      });
    }
    return claimed;
  });

  let paymentLinksCreated = 0;
  let emailsSent = 0;
  let emailFailures = 0;
  let retryFailures = 0;

  for (const subscription of due) {
    const attempt = subscription.attempts + 1;
    try {
      if (attempt > MAX_DUNNING_ATTEMPTS) {
        await updateRetryFailure(subscription, attempt - 1, now, "Maximum retry attempts reached", actor);
        retryFailures++;
        continue;
      }
      if (!subscription.email) throw new Error("BILLING_CONTACT_MISSING");

      const gateway = getPaymentProvider(subscription.gateway);
      const [configuredPlan] = await db.select({
        price: plans.price,
        yearlyPrice: plans.yearlyPrice,
        interval: plans.interval,
        currency: plans.currency,
        isActive: plans.isActive,
      }).from(plans).where(eq(plans.slug, subscription.plan)).limit(1);
      if (configuredPlan && !configuredPlan.isActive) throw new Error("SUBSCRIPTION_PLAN_INACTIVE");
      if (configuredPlan?.currency && configuredPlan.currency.toUpperCase() !== "NGN") {
        throw new Error("SUBSCRIPTION_CURRENCY_UNSUPPORTED");
      }

      const planInfo = getPlan(normalizePlan(subscription.plan));
      const interval = configuredPlan?.interval === "year" ? "year" : "month";
      const amount = configuredPlan
        ? interval === "year"
          ? configuredPlan.yearlyPrice || configuredPlan.price
          : configuredPlan.price
        : String(planInfo.price);
      const amountMinor = decimalToMinorUnits(amount);
      if (amountMinor === null || amountMinor <= 0) throw new Error("SUBSCRIPTION_PRICE_INVALID");
      const reference = `DUN-${subscription.id.slice(0, 8)}-${Date.now()}-${randomUUID().slice(0, 8)}`;
      const callbackUrl = new URL("/dashboard/billing", process.env.NEXT_PUBLIC_APP_URL || "https://app.sellup.ng");
      callbackUrl.searchParams.set("renewal", "complete");
      callbackUrl.searchParams.set("reference", reference);
      callbackUrl.searchParams.set("provider", gateway);

      const publicKey = gateway === PaymentProvider.PAYSTACK
        ? process.env.PAYSTACK_PUBLIC_KEY
        : process.env.FLUTTERWAVE_PUBLIC_KEY;
      const secretKey = gateway === PaymentProvider.PAYSTACK
        ? process.env.PAYSTACK_SECRET_KEY
        : process.env.FLUTTERWAVE_SECRET_KEY;
      if (!publicKey || !secretKey) throw new Error("PAYMENT_GATEWAY_NOT_CONFIGURED");

      const initialized = await initializePayment(gateway, { provider: gateway, publicKey, secretKey }, {
        email: subscription.email,
        amount: amountMinor,
        orderId: reference,
        callbackUrl: callbackUrl.toString(),
        metadata: {
          type: "subscription",
          dunning: true,
          storeId: subscription.storeId,
          plan: subscription.plan,
          interval,
        },
      });
      if (!initialized.success || !initialized.reference || !initialized.authorizationUrl) {
        throw new Error("PAYMENT_LINK_INITIALIZATION_FAILED");
      }

      const retryAt = attempt < MAX_DUNNING_ATTEMPTS
        ? new Date(now.getTime() + RETRY_DELAY_DAYS[attempt - 1] * 24 * 60 * 60 * 1000)
        : null;
      await db.transaction(async (tx) => {
        await tx.update(payments)
          .set({ status: "expired" })
          .where(and(
            eq(payments.storeId, subscription.storeId),
            eq(payments.status, "pending"),
            sql`${payments.metadata}->>'dunning' = 'true'`,
          ));
        await tx.insert(payments).values({
          storeId: subscription.storeId,
          userId: subscription.ownerId,
          amount: (amountMinor / 100).toFixed(2),
          currency: configuredPlan?.currency || "NGN",
          gateway,
          reference,
          status: "pending",
          metadata: {
            type: "subscription",
            dunning: true,
            plan: subscription.plan,
            interval,
            checkoutUrl: initialized.authorizationUrl,
          },
        });
        await tx.update(subscriptions).set({
          dunningAttempts: attempt,
          dunningNextAttemptAt: retryAt,
          dunningLockedAt: null,
          dunningLastError: null,
          updatedAt: now,
        }).where(and(
          eq(subscriptions.id, subscription.id),
          eq(subscriptions.status, "past_due"),
        ));
        await tx.insert(auditLogs).values({
          actorId: actor.id,
          actorRole: actor.role,
          action: "subscription.dunning_payment_link_created",
          resourceType: "subscription",
          resourceId: subscription.id,
          storeId: subscription.storeId,
          newValue: { attempt, retryAt, gateway, paymentReference: reference },
          ipAddress: actor.ipAddress,
          userAgent: actor.userAgent,
        });
      });
      paymentLinksCreated++;

      const sent = await sendEmail({
        to: subscription.email,
        subject: "Action needed: renew your Sell Up subscription",
        template: EmailTemplate.BILLING_PAST_DUE,
        data: {
          customerName: subscription.storeName,
          storeName: subscription.storeName,
          paymentUrl: initialized.authorizationUrl,
          attempt,
        },
      });
      if (sent) emailsSent++;
      else emailFailures++;
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : "DUNNING_RETRY_FAILED";
      await updateRetryFailure(subscription, attempt, now, errorCode, actor);
      retryFailures++;
      console.error("Subscription payment retry failed:", errorCode);
    }
  }

  return {
    due: due.length,
    paymentLinksCreated,
    emailsSent,
    emailFailures,
    retryFailures,
    batchLimit: DUNNING_BATCH_SIZE,
  };
}

function getPaymentProvider(value: string | null): PaymentProvider {
  if (value === PaymentProvider.PAYSTACK || value === PaymentProvider.FLUTTERWAVE) return value;
  if (value) throw new Error("PAYMENT_GATEWAY_UNSUPPORTED");
  if (process.env.PAYSTACK_SECRET_KEY && process.env.PAYSTACK_PUBLIC_KEY) return PaymentProvider.PAYSTACK;
  if (process.env.FLUTTERWAVE_SECRET_KEY && process.env.FLUTTERWAVE_PUBLIC_KEY) return PaymentProvider.FLUTTERWAVE;
  throw new Error("PAYMENT_GATEWAY_NOT_CONFIGURED");
}

async function updateRetryFailure(
  subscription: DueSubscription,
  attempt: number,
  now: Date,
  errorCode: string,
  actor: DunningActor,
) {
  const retryAt = attempt < MAX_DUNNING_ATTEMPTS
    ? new Date(now.getTime() + RETRY_DELAY_DAYS[Math.max(0, attempt - 1)] * 24 * 60 * 60 * 1000)
    : null;
  await db.transaction(async (tx) => {
    await tx.update(subscriptions).set({
      dunningAttempts: attempt,
      dunningNextAttemptAt: retryAt,
      dunningLockedAt: null,
      dunningLastError: errorCode.slice(0, 255),
      updatedAt: now,
    }).where(and(
      eq(subscriptions.id, subscription.id),
      eq(subscriptions.status, "past_due"),
    ));
    await tx.insert(auditLogs).values({
      actorId: actor.id,
      actorRole: actor.role,
      action: "subscription.dunning_retry_failed",
      resourceType: "subscription",
      resourceId: subscription.id,
      storeId: subscription.storeId,
      newValue: { attempt, retryAt, errorCode: errorCode.slice(0, 255) },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  });
}
