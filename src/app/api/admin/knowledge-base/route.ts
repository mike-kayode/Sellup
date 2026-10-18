import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { knowledgeBaseArticles } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { createAuditLog, getClientInfo } from "@/lib/admin-audit";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const url = new URL(request.url);
    const category = url.searchParams.get("category") || "";
    const isPublished = url.searchParams.get("isPublished") || "all";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const totalAgg = await db.select({ total: count() }).from(knowledgeBaseArticles);
    const list = await db.select().from(knowledgeBaseArticles).orderBy(desc(knowledgeBaseArticles.createdAt)).limit(limit).offset(offset);

    return NextResponse.json({
      articles: list,
      total: totalAgg[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin knowledge base error:", error);
    return NextResponse.json({ error: "Failed to load knowledge base" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const body = await request.json();
    const slug = (body.slug || body.title || `kb-${Date.now()}`).toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `kb-${Date.now()}`;

    const [article] = await db.insert(knowledgeBaseArticles).values({
      title: body.title,
      slug,
      content: body.content || "",
      category: body.category || "general",
      tags: body.tags || [],
      isPublished: body.isPublished ?? false,
      seoTitle: body.seoTitle || body.title,
      seoDescription: body.seoDescription || body.content,
      authorId: user?.id || null,
    }).returning();

    const clientInfo = getClientInfo(request);
    if (user) {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "article.created",
        resourceType: "knowledge_base_article",
        resourceId: article.id,
        newValue: { title: body.title, category: body.category || "general" },
        ...clientInfo,
      });
    }

    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    console.error("Admin knowledge base create error:", error);
    return NextResponse.json({ error: "Failed to create article" }, { status: 500 });
  }
}
