import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";

function csvCell(value: unknown): string {
  const text = value === null || value === undefined
    ? ""
    : typeof value === "string" ? value : JSON.stringify(value);
  return `"${text.replace(/"/g, '""').replace(/[\r\n]+/g, " ")}"`;
}

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const url = new URL(request.url);
    const action = (url.searchParams.get("action") || "").trim().slice(0, 100);
    const resourceType = (url.searchParams.get("resourceType") || "").trim().slice(0, 100);
    const actorIdRaw = url.searchParams.get("actorId") || "";
    const fromRaw = url.searchParams.get("from") || "";
    const toRaw = url.searchParams.get("to") || "";
    const actorId = actorIdRaw ? z.string().uuid().safeParse(actorIdRaw) : null;
    if (actorId && !actorId.success) {
      return NextResponse.json({ error: "Invalid actor ID" }, { status: 400 });
    }
    const from = fromRaw ? new Date(fromRaw) : null;
    const to = toRaw ? new Date(toRaw) : null;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) || (from && to && from > to)) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const format = url.searchParams.get("format") || "";
    const exporting = format === "csv";
    const limit = exporting ? 5000 : Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20));
    const filters = [];
    if (action) filters.push(eq(auditLogs.action, action));
    if (resourceType) filters.push(eq(auditLogs.resourceType, resourceType));
    if (actorId?.success) filters.push(eq(auditLogs.actorId, actorId.data));
    if (from) filters.push(gte(auditLogs.createdAt, from));
    if (to) filters.push(lte(auditLogs.createdAt, to));
    const where = filters.length ? and(...filters) : undefined;

    const [totalResult, rows] = await Promise.all([
      db.select({ total: count() }).from(auditLogs).where(where),
      db.select({
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
        actorRole: auditLogs.actorRole,
        storeId: auditLogs.storeId,
      }).from(auditLogs).where(where)
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(limit).offset(exporting ? 0 : (page - 1) * limit),
    ]);

    if (exporting) {
      const header = ["created_at", "actor_id", "actor_role", "action", "resource_type", "resource_id", "store_id", "previous_value", "new_value", "ip_address"];
      const lines = rows.map((row) => [
        row.createdAt?.toISOString(),
        row.actorId,
        row.actorRole,
        row.action,
        row.resourceType,
        row.resourceId,
        row.storeId,
        row.previousValue,
        row.newValue,
        row.ipAddress,
      ].map(csvCell).join(","));
      return new NextResponse([header.join(","), ...lines].join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="admin-audit-logs.csv"',
          "Cache-Control": "no-store",
        },
      });
    }

    const actorIds = [...new Set(rows.map((row) => row.actorId).filter((id): id is string => Boolean(id)))];
    const actors = actorIds.length
      ? await db.select({ id: users.id, fullName: users.fullName, email: users.email })
        .from(users).where(inArray(users.id, actorIds))
      : [];
    const actorMap = new Map(actors.map((actor) => [actor.id, actor]));
    const result = rows.map((row) => {
      const actor = row.actorId ? actorMap.get(row.actorId) : null;
      return { ...row, actorName: actor?.fullName || actor?.email || "System" };
    });

    return NextResponse.json({ logs: result, total: totalResult[0]?.total ?? 0, page, limit });
  } catch (error) {
    console.error("Admin audit logs error:", error);
    return NextResponse.json({ error: "Failed to load audit logs" }, { status: 500 });
  }
}
