import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { announcementDeliveryProgress, announcements, auditLogs, businesses, plans } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";

const announcementSchema = z.object({
  title: z.string().trim().min(1).max(255),
  message: z.string().trim().min(1).max(20_000),
  type: z.enum(["info", "update", "maintenance", "warning", "promotion", "notification"]).default("info"),
  target: z.enum(["all", "plan", "store"]).default("all"),
  targetPlan: z.string().trim().min(1).max(100).nullable().optional(),
  targetStoreId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
  sendEmail: z.boolean().default(false),
  sendWhatsApp: z.boolean().default(false),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
}).strict().refine((value) => value.target !== "plan" || Boolean(value.targetPlan), {
  message: "A plan must be selected for plan targeting",
  path: ["targetPlan"],
}).refine((value) => value.target !== "store" || Boolean(value.targetStoreId), {
  message: "A store must be selected for store targeting",
  path: ["targetStoreId"],
}).refine((value) => !value.scheduledAt || !value.expiresAt || new Date(value.expiresAt) > new Date(value.scheduledAt), {
  message: "Expiry must be after the scheduled time",
  path: ["expiresAt"],
});

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  try {
    const url = new URL(request.url);
    const active = url.searchParams.get("isActive") || "all";
    const search = (url.searchParams.get("search") || "").trim().slice(0, 100);
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20));
    const filters = [];
    if (active === "true") filters.push(eq(announcements.isActive, true));
    if (active === "false") filters.push(eq(announcements.isActive, false));
    if (search) filters.push(ilike(announcements.title, `%${search}%`));
    const where = and(...filters);
    const [totalResult, rows, availablePlans, availableStores] = await Promise.all([
      db.select({ total: count() }).from(announcements).where(where),
      db.select().from(announcements).where(where).orderBy(desc(announcements.createdAt), desc(announcements.id))
        .limit(limit).offset((page - 1) * limit),
      db.select({ slug: plans.slug, name: plans.name }).from(plans)
        .where(eq(plans.isActive, true)).orderBy(plans.name).limit(100),
      db.select({ id: businesses.id, storeName: businesses.storeName }).from(businesses)
        .orderBy(businesses.storeName).limit(100),
    ]);
    return NextResponse.json({
      announcements: rows,
      availablePlans,
      availableStores,
      total: totalResult[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin announcements error:", error);
    return NextResponse.json({ error: "Failed to load announcements" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = announcementSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid announcement", details: parsed.error.flatten() }, { status: 400 });
  try {
    if (parsed.data.targetPlan) {
      const [targetPlan] = await db.select({ slug: plans.slug }).from(plans).where(eq(plans.slug, parsed.data.targetPlan)).limit(1);
      if (!targetPlan) return NextResponse.json({ error: "Target plan not found" }, { status: 400 });
    }
    if (parsed.data.targetStoreId) {
      const [targetStore] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, parsed.data.targetStoreId)).limit(1);
      if (!targetStore) return NextResponse.json({ error: "Target store not found" }, { status: 400 });
    }
    const { ipAddress, userAgent } = getClientInfo(request);
    const announcement = await db.transaction(async (tx) => {
      const [created] = await tx.insert(announcements).values({
        title: parsed.data.title,
        message: parsed.data.message,
        type: parsed.data.type,
        target: parsed.data.target,
        targetPlan: parsed.data.target === "plan" ? parsed.data.targetPlan : null,
        targetStoreId: parsed.data.target === "store" ? parsed.data.targetStoreId : null,
        isActive: parsed.data.isActive,
        sendEmail: parsed.data.sendEmail,
        sendWhatsApp: parsed.data.sendWhatsApp,
        scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      }).returning();
      if (created.sendEmail || created.sendWhatsApp) {
        await tx.insert(announcementDeliveryProgress).values({
          announcementId: created.id,
        });
      }
      await tx.insert(auditLogs).values({
        actorId: user.id, actorRole: user.role, action: "announcement.created",
        resourceType: "announcement", resourceId: created.id,
        storeId: created.targetStoreId,
        newValue: created, ipAddress, userAgent,
      });
      return created;
    });
    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error) {
    console.error("Admin announcement create error:", error);
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 });
  }
}
