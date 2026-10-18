import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { desc, count } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const totalAgg = await db.select({ total: count() }).from(auditLogs);
    const list = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset);

    const securityEvents = list
      .filter((log) => ["login_failed", "account_locked", "suspicious_activity", "password_reset", "session_revoked"].includes(log.action))
      .map((log) => ({
        id: log.id,
        action: log.action,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
        actorName: log.actorId || "System",
      }));

    return NextResponse.json({
      events: securityEvents,
      total: securityEvents.length,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin security error:", error);
    return NextResponse.json({ error: "Failed to load security events" }, { status: 500 });
  }
}
