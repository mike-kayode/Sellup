import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { createAuditLog, getClientInfo } from "@/lib/admin-audit";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const allSettings = await db.select().from(systemSettings);
    const settings: Record<string, any> = {};
    for (const s of allSettings) {
      settings[s.key] = s.value;
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Admin settings error:", error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const body = await request.json();
    const previousSettings: Record<string, any> = {};

    for (const [key, value] of Object.entries(body)) {
      const [existing] = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
      previousSettings[key] = existing?.value || null;

      await db.insert(systemSettings).values({
        key,
        value: typeof value === "string" ? { value } : value,
      }).onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: typeof value === "string" ? { value } : value, updatedAt: new Date() },
      });
    }

    const clientInfo = getClientInfo(request);
    if (user) {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "settings.updated",
        resourceType: "system_settings",
        previousValue: previousSettings,
        newValue: body,
        ...clientInfo,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin settings update error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
