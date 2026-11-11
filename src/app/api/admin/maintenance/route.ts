import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, systemSettings } from "@/db/schema";
import { getClientInfo } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";
import {
  DEFAULT_MAINTENANCE_SETTINGS,
  maintenanceSettingsSchema,
} from "@/lib/admin-settings";

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin(request);
    if (error) return error;

    const [record] = await db
      .select({
        value: systemSettings.value,
        updatedAt: systemSettings.updatedAt,
      })
      .from(systemSettings)
      .where(eq(systemSettings.key, "maintenance"))
      .limit(1);
    if (!record) {
      return NextResponse.json({ settings: DEFAULT_MAINTENANCE_SETTINGS });
    }

    const parsed = maintenanceSettingsSchema.safeParse(record.value);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Stored maintenance settings are invalid" },
        { status: 500 }
      );
    }
    return NextResponse.json({
      settings: parsed.data,
      updatedAt: record.updatedAt,
    });
  } catch (error) {
    console.error("Admin maintenance error:", error);
    return NextResponse.json(
      { error: "Failed to load maintenance settings" },
      { status: 500 }
    );
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
    const parsed = maintenanceSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid maintenance settings", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, "maintenance"))
      .limit(1);
    const { ipAddress, userAgent } = getClientInfo(request);
    await db.transaction(async (tx) => {
      await tx
        .insert(systemSettings)
        .values({
          key: "maintenance",
          value: parsed.data,
          description: "Platform maintenance mode settings",
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: parsed.data, updatedAt: new Date() },
        });

      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "maintenance.updated",
        resourceType: "system_settings",
        resourceId: null,
        previousValue: existing?.value ?? null,
        newValue: parsed.data,
        ipAddress,
        userAgent,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin maintenance update error:", error);
    return NextResponse.json(
      { error: "Failed to update maintenance settings" },
      { status: 500 }
    );
  }
}
