import { NextRequest, NextResponse } from "next/server";
import { count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { announcementDeliveries } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";

type Context = { params: Promise<{ id: string }> };

function maskRecipient(channel: string, recipient: string): string {
  if (channel === "email") {
    const [local = "", domain = ""] = recipient.split("@");
    return `${local.slice(0, 1)}***@${domain}`;
  }
  return `***${recipient.slice(-4)}`;
}

export async function GET(request: NextRequest, context: Context) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid announcement ID" }, { status: 400 });
  }
  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20));
  try {
    const [totalResult, rows] = await Promise.all([
      db.select({ total: count() }).from(announcementDeliveries)
        .where(eq(announcementDeliveries.announcementId, id)),
      db.select({
        id: announcementDeliveries.id,
        channel: announcementDeliveries.channel,
        recipient: announcementDeliveries.recipient,
        status: announcementDeliveries.status,
        attempts: announcementDeliveries.attempts,
        lastError: announcementDeliveries.lastError,
        sentAt: announcementDeliveries.sentAt,
        createdAt: announcementDeliveries.createdAt,
      }).from(announcementDeliveries)
        .where(eq(announcementDeliveries.announcementId, id))
        .orderBy(desc(announcementDeliveries.createdAt), desc(announcementDeliveries.id))
        .limit(limit)
        .offset((page - 1) * limit),
    ]);
    return NextResponse.json({
      deliveries: rows.map((row) => ({
        ...row,
        recipient: maskRecipient(row.channel, row.recipient),
      })),
      total: totalResult[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin announcement delivery log failed:", error);
    return NextResponse.json({ error: "Failed to load delivery log" }, { status: 500 });
  }
}
