import { NextRequest, NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, systemSettings } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";

const platformSettingsSchema = z
  .object({
    platformName: z.string().trim().min(1).max(100),
    supportEmail: z.string().trim().email().max(255),
    supportPhone: z.string().trim().max(32),
    defaultCurrency: z.enum(["NGN", "USD", "GHS"]),
    defaultTimezone: z.string().trim().min(1).max(100),
    enableRegistration: z.boolean(),
    requireEmailVerification: z.boolean(),
    defaultPlan: z.enum(["freemium", "starter", "business", "pro"]),
    trialDays: z.number().int().min(0).max(365),
    taxDefaults: z
      .object({
        enabled: z.boolean(),
        ratePercent: z.number().min(0).max(100),
        inclusive: z.boolean(),
      })
      .strict(),
  })
  .strict();

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request);
    if (error) return error;

    const records = await db
      .select({
        key: systemSettings.key,
        value: systemSettings.value,
        updatedAt: systemSettings.updatedAt,
      })
      .from(systemSettings)
      .where(inArray(systemSettings.key, [
        "platformName",
        "supportEmail",
        "supportPhone",
        "defaultCurrency",
        "default_currency",
        "defaultTimezone",
        "enableRegistration",
        "requireEmailVerification",
        "defaultPlan",
        "trialDays",
        "taxDefaults",
      ]));
    const settings: Record<string, unknown> = {};
    for (const record of records) {
      const value = record.value;
      settings[record.key] =
        value && typeof value === "object" && !Array.isArray(value) && "value" in value
          ? value.value
          : value;
    }
    if (settings.defaultCurrency === undefined) {
      settings.defaultCurrency = settings.default_currency;
    }

    return NextResponse.json({
      settings,
      updatedAt: records.reduce<Date | null>(
        (latest, record) =>
          !latest || record.updatedAt > latest ? record.updatedAt : latest,
        null
      ),
    });
  } catch (error) {
    console.error("Admin settings error:", error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = platformSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid platform settings", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const values = parsed.data;
    const settingValues: Record<string, unknown> = {
      platformName: values.platformName,
      supportEmail: values.supportEmail,
      supportPhone: values.supportPhone,
      defaultCurrency: values.defaultCurrency,
      default_currency: values.defaultCurrency,
      defaultTimezone: values.defaultTimezone,
      enableRegistration: values.enableRegistration,
      requireEmailVerification: values.requireEmailVerification,
      defaultPlan: values.defaultPlan,
      trialDays: values.trialDays,
      taxDefaults: values.taxDefaults,
    };
    const keys = Object.keys(settingValues);
    const { ipAddress, userAgent } = getClientInfo(request);

    await db.transaction(async (tx) => {
      const current = await tx
        .select({ key: systemSettings.key, value: systemSettings.value })
        .from(systemSettings)
        .where(inArray(systemSettings.key, keys));
      const previousValue = Object.fromEntries(
        current.map((record) => [record.key, record.value])
      );

      for (const [key, value] of Object.entries(settingValues)) {
        await tx
          .insert(systemSettings)
          .values({ key, value, description: "Typed platform setting" })
          .onConflictDoUpdate({
            target: systemSettings.key,
            set: { value, updatedAt: new Date() },
          });
      }

      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "settings.updated",
        resourceType: "system_settings",
        previousValue,
        newValue: settingValues,
        ipAddress,
        userAgent,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin settings update error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
