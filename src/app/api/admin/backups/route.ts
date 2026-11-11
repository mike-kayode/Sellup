import { NextRequest, NextResponse } from "next/server";
import { count, desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, backupRecords } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20));
    const [totalResult, rows] = await Promise.all([
      db.select({ total: count() }).from(backupRecords),
      db.select({
        id: backupRecords.id,
        name: backupRecords.name,
        size: backupRecords.size,
        status: backupRecords.status,
        type: backupRecords.type,
        createdAt: backupRecords.createdAt,
        completedAt: backupRecords.completedAt,
      }).from(backupRecords)
        .orderBy(desc(backupRecords.createdAt), desc(backupRecords.id))
        .limit(limit).offset((page - 1) * limit),
    ]);
    return NextResponse.json({ backups: rows, total: totalResult[0]?.total ?? 0, page, limit });
  } catch (error) {
    console.error("Admin backups error:", error);
    return NextResponse.json({ error: "Failed to load backups" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const backup = await db.transaction(async (tx) => {
      const [created] = await tx.insert(backupRecords).values({
        name: `sellup-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`,
        size: null,
        status: "pending",
        type: "full",
        createdBy: user.id,
      }).returning();
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "backup.requested",
        resourceType: "backup",
        resourceId: created.id,
        newValue: { status: created.status, type: created.type },
        ipAddress,
        userAgent,
      });
      return created;
    });
    return NextResponse.json({ backup }, { status: 202 });
  } catch (error) {
    console.error("Admin backup request error:", error);
    return NextResponse.json({ error: "Failed to request backup" }, { status: 500 });
  }
}
