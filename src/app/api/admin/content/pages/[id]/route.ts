import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, contentPages } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";

type Context = { params: Promise<{ id: string }> };
const updateSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  slug: z.string().trim().min(1).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  content: z.string().max(100_000).nullable().optional(),
  status: z.enum(["draft", "published", "scheduled"]).optional(),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
  seoTitle: z.string().trim().max(255).nullable().optional(),
  seoDescription: z.string().trim().max(2000).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "No changes supplied");

export async function PUT(request: NextRequest, context: Context) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid page ID" }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid page", details: parsed.error.flatten() }, { status: 400 });
  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const page = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(contentPages).where(eq(contentPages.id, id)).limit(1);
      if (!before) return null;
      const requestedScheduledAt = parsed.data.scheduledAt === undefined
        ? before.scheduledAt
        : parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null;
      const status = parsed.data.status ?? before.status;
      const scheduledAt = status === "scheduled" ? requestedScheduledAt : null;
      if (status === "scheduled" && (!scheduledAt || scheduledAt <= new Date())) {
        throw new Error("PAGE_SCHEDULE_REQUIRED");
      }
      const [after] = await tx.update(contentPages).set({
        ...parsed.data,
        scheduledAt,
        updatedAt: new Date(),
      })
        .where(eq(contentPages.id, id)).returning();
      await tx.insert(auditLogs).values({
        actorId: user.id, actorRole: user.role, action: "content.page.updated",
        resourceType: "content_page", resourceId: id, previousValue: before, newValue: after,
        ipAddress, userAgent,
      });
      return after;
    });
    if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
    return NextResponse.json({ page });
  } catch (error) {
    if (error instanceof Error && error.message === "PAGE_SCHEDULE_REQUIRED") {
      return NextResponse.json({ error: "A scheduled page requires a future publication date" }, { status: 400 });
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return NextResponse.json({ error: "That page slug is already in use" }, { status: 409 });
    console.error("Admin content page update error:", error);
    return NextResponse.json({ error: "Failed to update page" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid page ID" }, { status: 400 });
  if (new URL(request.url).searchParams.get("confirm") !== "unpublish") return NextResponse.json({ error: "Confirm page unpublication" }, { status: 400 });
  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const page = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(contentPages).where(eq(contentPages.id, id)).limit(1);
      if (!before) return null;
      const [after] = await tx.update(contentPages).set({ status: "draft", scheduledAt: null, updatedAt: new Date() })
        .where(eq(contentPages.id, id)).returning();
      await tx.insert(auditLogs).values({
        actorId: user.id, actorRole: user.role, action: "content.page.unpublished",
        resourceType: "content_page", resourceId: id, previousValue: before, newValue: after,
        ipAddress, userAgent,
      });
      return after;
    });
    if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
    return NextResponse.json({ page });
  } catch (error) {
    console.error("Admin content page unpublish error:", error);
    return NextResponse.json({ error: "Failed to unpublish page" }, { status: 500 });
  }
}
