import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, blogPosts } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";

type Context = { params: Promise<{ id: string }> };
const updateSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  slug: z.string().trim().min(1).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  excerpt: z.string().trim().max(5000).nullable().optional(),
  content: z.string().max(100_000).nullable().optional(),
  coverImage: z.string().trim().max(500).nullable().optional(),
  category: z.string().trim().max(100).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  isPublished: z.boolean().optional(),
  publishedAt: z.string().datetime({ offset: true }).nullable().optional(),
  seoTitle: z.string().trim().max(255).nullable().optional(),
  seoDescription: z.string().trim().max(2000).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "No changes supplied");

export async function PUT(request: NextRequest, context: Context) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid blog post ID" }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid blog post", details: parsed.error.flatten() }, { status: 400 });
  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const post = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
      if (!before) return null;
      const publishDate = parsed.data.publishedAt === undefined
        ? before.publishedAt
        : parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : null;
      const [after] = await tx.update(blogPosts).set({
        ...parsed.data,
        publishedAt: parsed.data.isPublished === false
          ? null
          : publishDate || (parsed.data.isPublished ? new Date() : null),
        updatedAt: new Date(),
      }).where(eq(blogPosts.id, id)).returning();
      await tx.insert(auditLogs).values({
        actorId: user.id, actorRole: user.role, action: "content.blog_post.updated",
        resourceType: "blog_post", resourceId: id, previousValue: before, newValue: after,
        ipAddress, userAgent,
      });
      return after;
    });
    if (!post) return NextResponse.json({ error: "Blog post not found" }, { status: 404 });
    return NextResponse.json({ post });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return NextResponse.json({ error: "That blog slug is already in use" }, { status: 409 });
    console.error("Admin blog post update error:", error);
    return NextResponse.json({ error: "Failed to update blog post" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid blog post ID" }, { status: 400 });
  if (new URL(request.url).searchParams.get("confirm") !== "unpublish") return NextResponse.json({ error: "Confirm blog post unpublication" }, { status: 400 });
  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const post = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
      if (!before) return null;
      const [after] = await tx.update(blogPosts).set({ isPublished: false, publishedAt: null, updatedAt: new Date() })
        .where(eq(blogPosts.id, id)).returning();
      await tx.insert(auditLogs).values({
        actorId: user.id, actorRole: user.role, action: "content.blog_post.unpublished",
        resourceType: "blog_post", resourceId: id, previousValue: before, newValue: after,
        ipAddress, userAgent,
      });
      return after;
    });
    if (!post) return NextResponse.json({ error: "Blog post not found" }, { status: 404 });
    return NextResponse.json({ post });
  } catch (error) {
    console.error("Admin blog post unpublish error:", error);
    return NextResponse.json({ error: "Failed to unpublish blog post" }, { status: 500 });
  }
}
