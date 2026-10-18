import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { eq, desc, count, inArray, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "";
    const resourceType = url.searchParams.get("resourceType") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    let query = db.select({
      id: auditLogs.id,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      previousValue: auditLogs.previousValue,
      newValue: auditLogs.newValue,
      ipAddress: auditLogs.ipAddress,
      userAgent: auditLogs.userAgent,
      createdAt: auditLogs.createdAt,
      actorId: auditLogs.actorId,
    }).from(auditLogs);

    const list = await query.orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset);

    const totalAgg = await db.select({ total: count() }).from(auditLogs);

    const actorIds = Array.from(new Set(list.map((l) => l.actorId).filter(Boolean))) as string[];
    const actorRows = actorIds.length
      ? await db.select({ id: users.id, fullName: users.fullName, email: users.email }).from(users).where(inArray(users.id, actorIds as readonly string[]))
      : [];

    const actorMap = new Map(actorRows.map((u) => [u.id, u]));

    const result = list.map((log) => {
      const actor = log.actorId ? actorMap.get(log.actorId) : null;
      return {
        ...log,
        actorName: actor?.fullName || actor?.email || "System",
        actorRole: actor?.email ? "admin" : "system",
      };
    });

    return NextResponse.json({
      logs: result,
      total: totalAgg[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin audit logs error:", error);
    return NextResponse.json({ error: "Failed to load audit logs" }, { status: 500 });
  }
}
