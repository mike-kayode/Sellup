
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { exchangeRates, businesses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireMerchant } from "@/lib/merchant-auth";
import { createMerchantAuditLog } from "@/lib/admin-audit";

const exchangeRateSchema = z.object({
  fromCurrency: z.string().min(2).max(10),
  toCurrency: z.string().min(2).max(10),
  rate: z.string().min(1),
  source: z.string().max(50).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireMerchant(request);
  if (auth.error) return auth.error;
  const { merchant } = auth!;

  try {
    const rows = await db
      .select()
      .from(exchangeRates)
      .where(eq(exchangeRates.storeId, merchant.storeId))
      .orderBy(exchangeRates.fromCurrency, exchangeRates.toCurrency);

    return NextResponse.json({ exchangeRates: rows });
  } catch (error) {
    console.error("Exchange rates get error:", error);
    return NextResponse.json({ error: "Failed to get exchange rates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireMerchant(request);
  if (auth.error) return auth.error;
  const { merchant } = auth!;

  try {
    const body = await request.json();
    const { fromCurrency, toCurrency, rate, source } =
      exchangeRateSchema.parse(body);

    const [existing] = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.storeId, merchant.storeId),
          eq(exchangeRates.fromCurrency, fromCurrency.toUpperCase()),
          eq(exchangeRates.toCurrency, toCurrency.toUpperCase())
        )
      )
      .limit(1);

    let row;
    if (existing) {
      [row] = await db
        .update(exchangeRates)
        .set({
          rate,
          source: source ?? "manual",
          updatedAt: new Date(),
        })
        .where(eq(exchangeRates.id, existing.id))
        .returning();
    } else {
      [row] = await db
        .insert(exchangeRates)
        .values({
          storeId: merchant.storeId,
          fromCurrency: fromCurrency.toUpperCase(),
          toCurrency: toCurrency.toUpperCase(),
          rate,
          source: source ?? "manual",
        })
        .returning();
    }

    try {
      await createMerchantAuditLog({
        actorId: merchant.userId,
        actorRole: "merchant",
        action: "merchant.exchange_rate.update",
        resourceType: "exchange_rate",
        resourceId: row.id,
        storeId: merchant.storeId,
        previousValue: undefined,
        newValue: { fromCurrency: row.fromCurrency, toCurrency: row.toCurrency, rate: row.rate },
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: request.headers.get("user-agent") ?? undefined,
        status: "success",
      });
    } catch { /* ignore */ }

    return NextResponse.json({ exchangeRate: row });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }
    console.error("Exchange rates update error:", error);
    return NextResponse.json({ error: "Failed to update exchange rate" }, { status: 500 });
  }
}

