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

    const settings = await db.select().from(systemSettings);
    const maintenanceSetting = settings.find((s) => s.key === "maintenance");

    return NextResponse.json({
      settings: maintenanceSetting?.value || {
        enabled: false,
        message: "We are currently performing maintenance. Please check back soon.",
        scheduledStart: "",
        scheduledEnd: "",
        allowAdminAccess: true,
      },
    });
  } catch (error) {
    console.error("Admin maintenance error:", error);
    return NextResponse.json({ error: "Failed to load maintenance settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const body = await request.json();
    const [existing] = await db.select().from(systemSettings).where(eq(systemSettings.key, "maintenance")).limit(1);
    const previousValue = (existing?.value as Record<string, any>) || null;

    await db.insert(systemSettings).values({
      key: "maintenance",
      value: body,
      description: "Platform maintenance mode settings",
    }).onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: body, updatedAt: new Date() },
    });

    const clientInfo = getClientInfo(request);
    if (user) {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "maintenance.updated",
        resourceType: "system_settings",
        resourceId: "maintenance",
        previousValue,
        newValue: body,
        ...clientInfo,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin maintenance update error:", error);
    return NextResponse.json({ error: "Failed to update maintenance settings" }, { status: 500 });
  }
}
