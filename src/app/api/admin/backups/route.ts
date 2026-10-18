import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { backupRecords } from "@/db/schema";
import { desc, count } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { createAuditLog, getClientInfo } from "@/lib/admin-audit";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const totalAgg = await db.select({ total: count() }).from(backupRecords);
    const backups = await db.select().from(backupRecords).orderBy(desc(backupRecords.createdAt)).limit(20);

    return NextResponse.json({
      backups: backups.map((backup) => ({
        id: backup.id,
        name: backup.name,
        size: backup.size || "0 MB",
        status: backup.status,
        createdAt: backup.createdAt,
      })),
      total: totalAgg[0]?.total ?? 0,
    });
  } catch (error) {
    console.error("Admin backups error:", error);
    return NextResponse.json({ error: "Failed to load backups" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const [backup] = await db.insert(backupRecords).values({
      name: `full_backup_${new Date().toISOString().split("T")[0].replace(/-/g, "_")}.sql`,
      size: "0 MB",
      status: "pending",
      type: "full",
      createdBy: user?.id || null,
    }).returning();

    const clientInfo = getClientInfo(request);
    if (user) {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "backup.created",
        resourceType: "backup",
        resourceId: backup.id,
        newValue: { name: backup.name },
        ...clientInfo,
      });
    }

    return NextResponse.json({ backup }, { status: 201 });
  } catch (error) {
    console.error("Admin backup create error:", error);
    return NextResponse.json({ error: "Failed to create backup" }, { status: 500 });
  }
}
