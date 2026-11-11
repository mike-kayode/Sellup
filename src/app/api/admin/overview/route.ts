import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  backgroundJobs,
  businesses,
  domains,
  orders,
  payments,
  plans,
  subscriptions,
  systemSettings,
  users,
  webhookDeliveries,
} from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";

const supportedRanges = [7, 30, 90] as const;

function readCurrency(value: unknown): string {
  const setting =
    value && typeof value === "object" && "value" in value
      ? value.value
      : value;
  return typeof setting === "string" && /^[A-Za-z]{3}$/.test(setting)
    ? setting.toUpperCase()
    : "NGN";
}

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request);
    if (error) return error;

    const requestedRange = Number(
      new URL(request.url).searchParams.get("range") ?? "30"
    );
    if (!supportedRanges.includes(requestedRange as (typeof supportedRanges)[number])) {
      return NextResponse.json(
        { error: "Range must be 7, 30, or 90 days" },
        { status: 400 }
      );
    }

    const days = requestedRange as (typeof supportedRanges)[number];
    const now = new Date();
    const startAt = new Date(now);
    startAt.setUTCHours(0, 0, 0, 0);
    startAt.setUTCDate(startAt.getUTCDate() - days + 1);
    const expiresBefore = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [currencySetting] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, "default_currency"))
      .limit(1);
    const currency = readCurrency(currencySetting?.value);

    const [
      merchants,
      activeStores,
      newSignups,
      orderCount,
      gmv,
      mrrByCurrency,
      failedPayments,
      chartRows,
      failedJobs,
      failingWebhooks,
      expiringDomains,
    ] = await Promise.all([
      db
        .select({ total: count() })
        .from(users)
        .where(eq(users.role, "merchant")),
      db
        .select({ total: count() })
        .from(businesses)
        .where(
          and(
            eq(businesses.isPublished, true),
            eq(businesses.isSuspended, false)
          )
        ),
      db
        .select({ total: count() })
        .from(users)
        .where(and(eq(users.role, "merchant"), gte(users.createdAt, startAt))),
      db
        .select({ total: count() })
        .from(orders)
        .where(gte(orders.createdAt, startAt)),
      db
        .select({
          total: sql<string>`COALESCE(SUM(${orders.total}), 0)::text`,
        })
        .from(orders)
        .innerJoin(businesses, eq(orders.storeId, businesses.id))
        .where(
          and(
            gte(orders.createdAt, startAt),
            eq(orders.paymentStatus, "paid"),
            eq(businesses.currency, currency)
          )
        ),
      db
        .select({
          currency: plans.currency,
          amount: sql<string>`COALESCE(SUM(
            CASE
              WHEN lower(${plans.interval}) IN ('year', 'yearly', 'annual')
                THEN COALESCE(${plans.yearlyPrice}, ${plans.price}) / 12
              ELSE ${plans.price}
            END
          ), 0)::text`,
        })
        .from(subscriptions)
        .innerJoin(plans, eq(plans.slug, subscriptions.plan))
        .where(eq(subscriptions.status, "active"))
        .groupBy(plans.currency)
        .orderBy(plans.currency),
      db
        .select({ total: count() })
        .from(payments)
        .where(
          and(eq(payments.status, "failed"), gte(payments.createdAt, startAt))
        ),
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${orders.createdAt}), 'YYYY-MM-DD')`,
          orders: count(),
          gmv: sql<string>`COALESCE(SUM(
            CASE
              WHEN ${orders.paymentStatus} = 'paid'
                AND ${businesses.currency} = ${currency}
              THEN ${orders.total}
              ELSE 0
            END
          ), 0)::text`,
        })
        .from(orders)
        .innerJoin(businesses, eq(orders.storeId, businesses.id))
        .where(gte(orders.createdAt, startAt))
        .groupBy(sql`date_trunc('day', ${orders.createdAt})`)
        .orderBy(sql`date_trunc('day', ${orders.createdAt})`),
      db
        .select({
          id: backgroundJobs.id,
          name: backgroundJobs.name,
          createdAt: backgroundJobs.createdAt,
        })
        .from(backgroundJobs)
        .where(eq(backgroundJobs.status, "failed"))
        .orderBy(desc(backgroundJobs.createdAt))
        .limit(5),
      db
        .select({
          id: webhookDeliveries.id,
          event: webhookDeliveries.event,
          createdAt: webhookDeliveries.createdAt,
        })
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.status, "failed"))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(5),
      db
        .select({
          id: domains.id,
          domain: domains.domain,
          expiresAt: domains.expiresAt,
        })
        .from(domains)
        .where(
          and(
            gte(domains.expiresAt, now),
            lte(domains.expiresAt, expiresBefore)
          )
        )
        .orderBy(domains.expiresAt)
        .limit(5),
    ]);

    const chartData = new Map(
      chartRows.map((row) => [row.day, { orders: row.orders, gmv: row.gmv }])
    );
    const daily = Array.from({ length: days }, (_, index) => {
      const date = new Date(startAt);
      date.setUTCDate(startAt.getUTCDate() + index);
      const day = date.toISOString().slice(0, 10);
      const values = chartData.get(day);
      return {
        date: day,
        orders: values?.orders ?? 0,
        gmv: values?.gmv ?? "0",
      };
    });

    return NextResponse.json({
      range: days,
      currency,
      stats: {
        merchants: merchants[0]?.total ?? 0,
        activeStores: activeStores[0]?.total ?? 0,
        gmv: gmv[0]?.total ?? "0",
        orders: orderCount[0]?.total ?? 0,
        mrrByCurrency,
        newSignups: newSignups[0]?.total ?? 0,
        failedPayments: failedPayments[0]?.total ?? 0,
      },
      daily,
      alerts: {
        failedJobs,
        failingWebhooks,
        expiringDomains,
      },
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    return NextResponse.json(
      { error: "Failed to load admin overview" },
      { status: 500 }
    );
  }
}
