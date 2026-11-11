import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, knowledgeBaseArticles } from "@/db/schema";
import { getClientInfo } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  slug: z.string().trim().min(1).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  content: z.string().trim().min(1).max(100_000).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  tags: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  isPublished: z.boolean().optional(),
  seoTitle: z.string().trim().max(255).nullable().optional(),
  seoDescription: z.string().trim().max(2_000).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid article ID" }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid article update", details: parsed.error.flatten() }, { status: 400 });

  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const article = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(knowledgeBaseArticles)
        .where(eq(knowledgeBaseArticles.id, id)).limit(1);
      if (!before) return null;
      const [after] = await tx.update(knowledgeBaseArticles)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(knowledgeBaseArticles.id, id))
        .returning();
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "content.knowledge_base_article.updated",
        resourceType: "knowledge_base_article",
        resourceId: id,
        previousValue: before,
        newValue: after,
        ipAddress,
        userAgent,
      });
      return after;
    });
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    return NextResponse.json({ article });
  } catch (cause) {
    if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505") {
      return NextResponse.json({ error: "That article slug is already in use" }, { status: 409 });
    }
    console.error("Admin knowledge base update failed:", cause);
    return NextResponse.json({ error: "Failed to update article" }, { status: 500 });
  }
}
