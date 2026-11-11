import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, businesses } from "@/db/schema";
import { getClientInfo } from "@/lib/admin-audit";
import { requireMerchant } from "@/lib/merchant-auth";
import { eq } from "drizzle-orm";

const preferencesSchema = z.object({
  emailOptOut: z.boolean().optional(),
  whatsappOptOut: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one preference");

export async function GET(request: NextRequest) {
  const { merchant, error } = await requireMerchant(request);
  if (error) return error;
  try {
    const [business] = await db.select({
      emailOptOut: businesses.announcementEmailOptOut,
      whatsappOptOut: businesses.announcementWhatsAppOptOut,
    }).from(businesses).where(eq(businesses.id, merchant.storeId)).limit(1);
    if (!business) return NextResponse.json({ error: "Store not found" }, { status: 404 });
    return NextResponse.json({ preferences: business });
  } catch (cause) {
    console.error("Merchant notification preferences load failed:", cause);
    return NextResponse.json({ error: "Failed to load notification preferences" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { merchant, error } = await requireMerchant(request);
  if (error) return error;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = preferencesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid notification preferences", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const preferences = await db.transaction(async (tx) => {
      const [before] = await tx.select({
        emailOptOut: businesses.announcementEmailOptOut,
        whatsappOptOut: businesses.announcementWhatsAppOptOut,
      }).from(businesses).where(eq(businesses.id, merchant.storeId)).limit(1);
      if (!before) return null;
      const [after] = await tx.update(businesses).set({
        ...(parsed.data.emailOptOut !== undefined
          ? { announcementEmailOptOut: parsed.data.emailOptOut }
          : {}),
        ...(parsed.data.whatsappOptOut !== undefined
          ? { announcementWhatsAppOptOut: parsed.data.whatsappOptOut }
          : {}),
        updatedAt: new Date(),
      }).where(eq(businesses.id, merchant.storeId)).returning({
        emailOptOut: businesses.announcementEmailOptOut,
        whatsappOptOut: businesses.announcementWhatsAppOptOut,
      });
      await tx.insert(auditLogs).values({
        actorId: merchant.userId,
        actorRole: "merchant",
        action: "notification_preferences.updated",
        resourceType: "business",
        resourceId: merchant.storeId,
        storeId: merchant.storeId,
        previousValue: before,
        newValue: after,
        ipAddress,
        userAgent,
      });
      return after;
    });
    if (!preferences) return NextResponse.json({ error: "Store not found" }, { status: 404 });
    return NextResponse.json({ preferences });
  } catch (cause) {
    console.error("Merchant notification preferences update failed:", cause);
    return NextResponse.json({ error: "Failed to update notification preferences" }, { status: 500 });
  }
}
