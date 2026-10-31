
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { taxSettings, businesses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireMerchant } from "@/lib/merchant-auth";
import { createMerchantAuditLog } from "@/lib/admin-audit";

const taxSettingsSchema = z.object({
  taxName: z.string().min(1).max(50).optional(),
  taxRate: z.string().optional(),
  taxRegistered: z.boolean().optional(),
  taxNumber: z.string().max(100).optional().or(z.literal("")),
  taxCountry: z.string().min(2).max(10).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireMerchant(request);
  if (auth.error) return auth.error;
  const { merchant } = auth!;

  try {
    const [row] = await db
      .select()
      .from(taxSettings)
      .where(eq(taxSettings.storeId, merchant.storeId))
      .limit(1);

    if (!row) {
      // Return default empty tax settings.
      return NextResponse.json({
        taxSettings: {
          taxName: "VAT",
          taxRate: "0.0000",
          taxRegistered: false,
          taxNumber: "",
          taxCountry: merchant.country || "NG",
        },
      });
    }

    return NextResponse.json({ taxSettings: row });
  } catch (error) {
    console.error("Tax settings get error:", error);
    return NextResponse.json({ error: "Failed to get tax settings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireMerchant(request);
  if (auth.error) return auth.error;
  const { merchant } = auth!;

  try {
    const body = await request.json();
    const { taxName, taxRate, taxRegistered, taxNumber, taxCountry } =
      taxSettingsSchema.parse(body);

    const [existing] = await db
      .select()
      .from(taxSettings)
      .where(eq(taxSettings.storeId, merchant.storeId))
      .limit(1);

    const values: Record<string, any> = {
      taxName: taxName ?? "VAT",
      taxRate: taxRate ?? "0.0000",
      taxRegistered: taxRegistered ?? false,
      taxNumber: taxNumber ?? null,
      taxCountry: taxCountry ?? merchant.country || "NG",
      updatedAt: new Date(),
    };

    let row;
    if (existing) {
      [row] = await db
        .update(taxSettings)
        .set(values)
        .where(eq(taxSettings.storeId, merchant.storeId))
        .returning();
    } else {
      [row] = await db
        .insert(taxSettings)
        .values({ ...values, storeId: merchant.storeId })
        .returning();
    }

    try {
      await createMerchantAuditLog({
        actorId: merchant.userId,
        actorRole: "merchant",
        action: "merchant.tax_settings.update",
        resourceType: "tax_settings",
        resourceId: row.id,
        storeId: merchant.storeId,
        previousValue: undefined,
        newValue: values,
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: request.headers.get("user-agent") ?? undefined,
        status: "success",
      });
    } catch { /* ignore */ }

    return NextResponse.json({ taxSettings: row });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }
    console.error("Tax settings update error:", error);
    return NextResponse.json({ error: "Failed to update tax settings" }, { status: 500 });
  }
}

