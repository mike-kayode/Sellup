import { and, asc, count, desc, eq, ilike, lte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { blogPosts, contentPages, faqs, knowledgeBaseArticles, testimonials } from "@/db/schema";

const TYPES = ["pages", "blog", "faqs", "testimonials", "knowledge-base"] as const;
type ContentType = (typeof TYPES)[number];

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "";
  if (!TYPES.includes(type as ContentType)) {
    return NextResponse.json({ error: "A valid content type is required" }, { status: 400 });
  }
  const contentType = type as ContentType;
  const search = (url.searchParams.get("search") || "").trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20));
  const now = new Date();

  try {
    if (contentType === "pages") {
      const filters = [eq(contentPages.status, "published")];
      if (search) filters.push(ilike(contentPages.title, `%${search}%`));
      const where = and(...filters);
      const [totalResult, rows] = await Promise.all([
        db.select({ total: count() }).from(contentPages).where(where),
        db.select({
          id: contentPages.id,
          title: contentPages.title,
          slug: contentPages.slug,
          content: contentPages.content,
          seoTitle: contentPages.seoTitle,
          seoDescription: contentPages.seoDescription,
          updatedAt: contentPages.updatedAt,
        }).from(contentPages).where(where).orderBy(desc(contentPages.updatedAt), asc(contentPages.slug))
          .limit(limit).offset((page - 1) * limit),
      ]);
      return NextResponse.json({ items: rows, total: totalResult[0]?.total ?? 0, page, limit });
    }

    if (contentType === "blog") {
      const filters = [eq(blogPosts.isPublished, true), lte(blogPosts.publishedAt, now)];
      if (search) filters.push(ilike(blogPosts.title, `%${search}%`));
      const where = and(...filters);
      const [totalResult, rows] = await Promise.all([
        db.select({ total: count() }).from(blogPosts).where(where),
        db.select({
          id: blogPosts.id,
          title: blogPosts.title,
          slug: blogPosts.slug,
          excerpt: blogPosts.excerpt,
          content: blogPosts.content,
          coverImage: blogPosts.coverImage,
          category: blogPosts.category,
          tags: blogPosts.tags,
          publishedAt: blogPosts.publishedAt,
          seoTitle: blogPosts.seoTitle,
          seoDescription: blogPosts.seoDescription,
        }).from(blogPosts).where(where).orderBy(desc(blogPosts.publishedAt), desc(blogPosts.id))
          .limit(limit).offset((page - 1) * limit),
      ]);
      return NextResponse.json({ items: rows, total: totalResult[0]?.total ?? 0, page, limit });
    }

    if (contentType === "faqs") {
      const where = search
        ? and(eq(faqs.isPublished, true), ilike(faqs.question, `%${search}%`))
        : eq(faqs.isPublished, true);
      const [totalResult, rows] = await Promise.all([
        db.select({ total: count() }).from(faqs).where(where),
        db.select({
          id: faqs.id,
          question: faqs.question,
          answer: faqs.answer,
          category: faqs.category,
          sortOrder: faqs.sortOrder,
        }).from(faqs).where(where).orderBy(asc(faqs.sortOrder), asc(faqs.id))
          .limit(limit).offset((page - 1) * limit),
      ]);
      return NextResponse.json({ items: rows, total: totalResult[0]?.total ?? 0, page, limit });
    }

    if (contentType === "testimonials") {
      const where = search
        ? and(eq(testimonials.isPublished, true), ilike(testimonials.name, `%${search}%`))
        : eq(testimonials.isPublished, true);
      const [totalResult, rows] = await Promise.all([
        db.select({ total: count() }).from(testimonials).where(where),
        db.select({
          id: testimonials.id,
          name: testimonials.name,
          business: testimonials.business,
          image: testimonials.image,
          review: testimonials.review,
          rating: testimonials.rating,
        }).from(testimonials).where(where).orderBy(desc(testimonials.createdAt), desc(testimonials.id))
          .limit(limit).offset((page - 1) * limit),
      ]);
      return NextResponse.json({ items: rows, total: totalResult[0]?.total ?? 0, page, limit });
    }

    const filters = [eq(knowledgeBaseArticles.isPublished, true)];
    if (search) filters.push(ilike(knowledgeBaseArticles.title, `%${search}%`));
    const where = and(...filters);
    const [totalResult, rows] = await Promise.all([
      db.select({ total: count() }).from(knowledgeBaseArticles).where(where),
      db.select({
        id: knowledgeBaseArticles.id,
        title: knowledgeBaseArticles.title,
        slug: knowledgeBaseArticles.slug,
        content: knowledgeBaseArticles.content,
        category: knowledgeBaseArticles.category,
        tags: knowledgeBaseArticles.tags,
        seoTitle: knowledgeBaseArticles.seoTitle,
        seoDescription: knowledgeBaseArticles.seoDescription,
        updatedAt: knowledgeBaseArticles.updatedAt,
      }).from(knowledgeBaseArticles).where(where)
        .orderBy(desc(knowledgeBaseArticles.updatedAt), asc(knowledgeBaseArticles.slug))
        .limit(limit).offset((page - 1) * limit),
    ]);
    return NextResponse.json({ items: rows, total: totalResult[0]?.total ?? 0, page, limit });
  } catch (cause) {
    console.error("Public content query failed:", cause);
    return NextResponse.json({ error: "Failed to load content" }, { status: 500 });
  }
}
