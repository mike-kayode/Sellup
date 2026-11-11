import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, blogPosts } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";

const blogPostSchema = z.object({
  title: z.string().trim().min(1).max(255),
  slug: z.string().trim().min(1).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  excerpt: z.string().trim().max(5000).nullable().optional(),
  content: z.string().max(100_000).nullable().optional(),
  coverImage: z.string().trim().max(500).nullable().optional(),
  category: z.string().trim().max(100).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  isPublished: z.boolean().default(false),
  publishedAt: z.string().datetime({ offset: true }).nullable().optional(),
  seoTitle: z.string().trim().max(255).nullable().optional(),
  seoDescription: z.string().trim().max(2000).nullable().optional(),
}).strict();

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  try {
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") || "").trim().slice(0, 100);
    const published = url.searchParams.get("published") || "all";
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50));
    const filters = [];
    if (published === "true") filters.push(eq(blogPosts.isPublished, true));
    if (published === "false") filters.push(eq(blogPosts.isPublished, false));
    if (search) filters.push(ilike(blogPosts.title, `%${search}%`));
    const where = filters.length ? and(...filters) : undefined;
    const [totalResult, posts] = await Promise.all([
      db.select({ total: count() }).from(blogPosts).where(where),
      db.select().from(blogPosts).where(where).orderBy(desc(blogPosts.createdAt), desc(blogPosts.id))
        .limit(limit).offset((page - 1) * limit),
    ]);
    return NextResponse.json({ posts, total: totalResult[0]?.total ?? 0, page, limit });
  } catch (error) {
    console.error("Admin blog error:", error);
    return NextResponse.json({ error: "Failed to load blog posts" }, { status: 500 });
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
  const parsed = blogPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid blog post", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const post = await db.transaction(async (tx) => {
      const [created] = await tx.insert(blogPosts).values({
        ...parsed.data,
        publishedAt: parsed.data.isPublished
          ? parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : new Date()
          : null,
        authorId: user.id,
      }).returning();
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "content.blog_post.created",
        resourceType: "blog_post",
        resourceId: created.id,
        newValue: created,
        ipAddress,
        userAgent,
      });
      return created;
    });
    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "That blog slug is already in use" }, { status: 409 });
    }
    console.error("Admin blog post create error:", error);
    return NextResponse.json({ error: "Failed to create blog post" }, { status: 500 });
  }
}
