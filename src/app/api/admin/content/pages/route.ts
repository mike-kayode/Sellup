import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, contentPages } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";

const pageSchema = z.object({
  title: z.string().trim().min(1).max(255),
  slug: z.string().trim().min(1).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  content: z.string().max(100_000).nullable().optional(),
  status: z.enum(["draft", "published", "scheduled"]).default("draft"),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
  seoTitle: z.string().trim().max(255).nullable().optional(),
  seoDescription: z.string().trim().max(2000).nullable().optional(),
}).strict().refine((value) => value.status !== "scheduled" || Boolean(value.scheduledAt), {
  message: "A scheduled page requires a publication date",
  path: ["scheduledAt"],
}).refine((value) => !value.scheduledAt || new Date(value.scheduledAt) > new Date(), {
  message: "Publication date must be in the future",
  path: ["scheduledAt"],
});

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  try {
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") || "").trim().slice(0, 100);
    const status = url.searchParams.get("status") || "all";
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50));
    const filters = [];
    if (status !== "all") filters.push(eq(contentPages.status, status));
    if (search) filters.push(ilike(contentPages.title, `%${search}%`));
    const where = filters.length ? and(...filters) : undefined;
    const [totalResult, pages] = await Promise.all([
      db.select({ total: count() }).from(contentPages).where(where),
      db.select().from(contentPages).where(where).orderBy(desc(contentPages.updatedAt), desc(contentPages.id))
        .limit(limit).offset((page - 1) * limit),
    ]);
    return NextResponse.json({ pages, total: totalResult[0]?.total ?? 0, page, limit });
  } catch (error) {
    console.error("Admin content pages error:", error);
    return NextResponse.json({ error: "Failed to load pages" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = pageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid page", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const page = await db.transaction(async (tx) => {
      const [created] = await tx.insert(contentPages).values({
        ...parsed.data,
        scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
        authorId: user.id,
      }).returning();
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "content.page.created",
        resourceType: "content_page",
        resourceId: created.id,
        newValue: created,
        ipAddress,
        userAgent,
      });
      return created;
    });
    return NextResponse.json({ page }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "That page slug is already in use" }, { status: 409 });
    }
    console.error("Admin content page create error:", error);
    return NextResponse.json({ error: "Failed to create page" }, { status: 500 });
  }
}
