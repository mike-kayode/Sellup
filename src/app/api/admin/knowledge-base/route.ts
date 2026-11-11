import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, knowledgeBaseArticles } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";

const articleSchema = z.object({
  title: z.string().trim().min(1).max(255),
  slug: z.string().trim().min(1).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  content: z.string().trim().min(1).max(100_000),
  category: z.string().trim().min(1).max(100).default("general"),
  tags: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  isPublished: z.boolean().default(false),
  seoTitle: z.string().trim().max(255).nullable().optional(),
  seoDescription: z.string().trim().max(2000).nullable().optional(),
}).strict();

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  try {
    const url = new URL(request.url);
    const category = (url.searchParams.get("category") || "").trim().slice(0, 100);
    const published = url.searchParams.get("isPublished") || "all";
    const search = (url.searchParams.get("search") || "").trim().slice(0, 100);
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20));
    const filters = [];
    if (category) filters.push(eq(knowledgeBaseArticles.category, category));
    if (published === "true") filters.push(eq(knowledgeBaseArticles.isPublished, true));
    if (published === "false") filters.push(eq(knowledgeBaseArticles.isPublished, false));
    if (search) filters.push(ilike(knowledgeBaseArticles.title, `%${search}%`));
    const where = filters.length ? and(...filters) : undefined;
    const [totalResult, articles] = await Promise.all([
      db.select({ total: count() }).from(knowledgeBaseArticles).where(where),
      db.select().from(knowledgeBaseArticles).where(where)
        .orderBy(desc(knowledgeBaseArticles.updatedAt), desc(knowledgeBaseArticles.id))
        .limit(limit).offset((page - 1) * limit),
    ]);
    return NextResponse.json({ articles, total: totalResult[0]?.total ?? 0, page, limit });
  } catch (error) {
    console.error("Admin knowledge base error:", error);
    return NextResponse.json({ error: "Failed to load knowledge base" }, { status: 500 });
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
  const parsed = articleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid article", details: parsed.error.flatten() }, { status: 400 });
  const slug = parsed.data.slug || parsed.data.title.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const article = await db.transaction(async (tx) => {
      const [created] = await tx.insert(knowledgeBaseArticles).values({
        ...parsed.data,
        slug,
        authorId: user.id,
      }).returning();
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "content.knowledge_base_article.created",
        resourceType: "knowledge_base_article",
        resourceId: created.id,
        newValue: created,
        ipAddress,
        userAgent,
      });
      return created;
    });
    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return NextResponse.json({ error: "That article slug is already in use" }, { status: 409 });
    console.error("Admin knowledge base create error:", error);
    return NextResponse.json({ error: "Failed to create article" }, { status: 500 });
  }
}
