import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { featureFlags } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { createAuditLog, getClientInfo } from "@/lib/admin-audit";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const totalAgg = await db.select({ total: count() }).from(featureFlags);
    const list = await db.select().from(featureFlags).orderBy(desc(featureFlags.createdAt)).limit(50);

    const posts = list.map((flag) => ({
      id: flag.id,
      title: flag.name,
      slug: flag.key,
      excerpt: flag.description || "",
      isPublished: flag.isEnabled,
      createdAt: flag.createdAt,
    }));

    return NextResponse.json({
      posts,
      total: totalAgg[0]?.total ?? 0,
    });
  } catch (error) {
    console.error("Admin blog error:", error);
    return NextResponse.json({ error: "Failed to load blog posts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const body = await request.json();
    const [post] = await db.insert(featureFlags).values({
      key: body.slug || `blog_${Date.now()}`,
      name: body.title,
      description: body.excerpt,
      isEnabled: body.isPublished ?? false,
      metadata: { content: body.content, tags: body.tags || [] },
    }).returning();

    const clientInfo = getClientInfo(request);
    if (user) {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "blog_post.created",
        resourceType: "blog_post",
        resourceId: post.id,
        newValue: { title: body.title, slug: body.slug },
        ...clientInfo,
      });
    }

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error("Admin blog create error:", error);
    return NextResponse.json({ error: "Failed to create blog post" }, { status: 500 });
  }
}
