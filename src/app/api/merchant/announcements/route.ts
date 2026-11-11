import { and, desc, eq, gte, isNull, lte, notExists, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  announcementDismissals,
  announcements,
  auditLogs,
  businesses,
} from "@/db/schema";
import { getClientInfo } from "@/lib/admin-audit";
import { requireMerchant } from "@/lib/merchant-auth";

export async function GET(request: NextRequest) {
  const { merchant, error } = await requireMerchant(request);
  if (error) return error;

  try {
    const [business] = await db
      .select({ plan: businesses.plan })
      .from(businesses)
      .where(eq(businesses.id, merchant.storeId))
      .limit(1);
    if (!business) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    const now = new Date();
    const rows = await db
      .select({
        id: announcements.id,
        title: announcements.title,
        message: announcements.message,
        type: announcements.type,
        scheduledAt: announcements.scheduledAt,
        expiresAt: announcements.expiresAt,
      })
      .from(announcements)
      .where(
        and(
          eq(announcements.isActive, true),
          or(
            eq(announcements.target, "all"),
            and(eq(announcements.target, "store"), eq(announcements.targetStoreId, merchant.storeId)),
            and(eq(announcements.target, "plan"), eq(announcements.targetPlan, business.plan ?? "freemium")),
          ),
          or(isNull(announcements.scheduledAt), lte(announcements.scheduledAt, now)),
          or(isNull(announcements.expiresAt), gte(announcements.expiresAt, now)),
          notExists(
            db
              .select({ one: sql`1` })
              .from(announcementDismissals)
              .where(
                and(
                  eq(announcementDismissals.announcementId, announcements.id),
                  eq(announcementDismissals.userId, merchant.userId),
                  eq(announcementDismissals.storeId, merchant.storeId),
                ),
              ),
          ),
        ),
      )
      .orderBy(desc(announcements.createdAt), desc(announcements.id))
      .limit(10);

    return NextResponse.json({ announcements: rows });
  } catch (cause) {
    console.error("Merchant announcements query failed:", cause);
    return NextResponse.json({ error: "Failed to load announcements" }, { status: 500 });
  }
}

const dismissSchema = z.object({ id: z.string().uuid() }).strict();

export async function PATCH(request: NextRequest) {
  const { merchant, error } = await requireMerchant(request);
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = dismissSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid announcement" }, { status: 400 });
  }

  try {
    const [business] = await db
      .select({ plan: businesses.plan })
      .from(businesses)
      .where(eq(businesses.id, merchant.storeId))
      .limit(1);
    if (!business) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    const now = new Date();
    const [announcement] = await db
      .select({ id: announcements.id, targetStoreId: announcements.targetStoreId })
      .from(announcements)
      .where(
        and(
          eq(announcements.id, parsed.data.id),
          eq(announcements.isActive, true),
          or(
            eq(announcements.target, "all"),
            and(eq(announcements.target, "store"), eq(announcements.targetStoreId, merchant.storeId)),
            and(eq(announcements.target, "plan"), eq(announcements.targetPlan, business.plan ?? "freemium")),
          ),
          or(isNull(announcements.scheduledAt), lte(announcements.scheduledAt, now)),
          or(isNull(announcements.expiresAt), gte(announcements.expiresAt, now)),
        ),
      )
      .limit(1);
    if (!announcement) return NextResponse.json({ error: "Announcement not found" }, { status: 404 });

    const { ipAddress, userAgent } = getClientInfo(request);
    await db.transaction(async (tx) => {
      await tx
        .insert(announcementDismissals)
        .values({
          announcementId: announcement.id,
          userId: merchant.userId,
          storeId: merchant.storeId,
        })
        .onConflictDoNothing();
      await tx.insert(auditLogs).values({
        actorId: merchant.userId,
        actorRole: "merchant",
        action: "announcement.dismissed",
        resourceType: "announcement",
        resourceId: announcement.id,
        storeId: merchant.storeId,
        newValue: { dismissed: true },
        ipAddress,
        userAgent,
      });
    });

    return NextResponse.json({ success: true });
  } catch (cause) {
    console.error("Merchant announcement dismissal failed:", cause);
    return NextResponse.json({ error: "Failed to dismiss announcement" }, { status: 500 });
  }
}
