import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, faqs } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";

const faqSchema = z.object({
  question: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(20_000),
  category: z.string().trim().min(1).max(100).default("general"),
  sortOrder: z.number().int().min(0).max(100_000).default(0),
  isPublished: z.boolean().default(false),
}).strict();

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  try {
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") || "").trim().slice(0, 100);
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50));
    const where = search ? ilike(faqs.question, `%${search}%`) : undefined;
    const [totalResult, rows] = await Promise.all([
      db.select({ total: count() }).from(faqs).where(where),
      db.select().from(faqs).where(where).orderBy(desc(faqs.sortOrder), desc(faqs.createdAt))
        .limit(limit).offset((page - 1) * limit),
    ]);
    return NextResponse.json({ faqs: rows, total: totalResult[0]?.total ?? 0, page, limit });
  } catch (error) {
    console.error("Admin FAQs error:", error);
    return NextResponse.json({ error: "Failed to load FAQs" }, { status: 500 });
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
  const parsed = faqSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid FAQ", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const faq = await db.transaction(async (tx) => {
      const [created] = await tx.insert(faqs).values(parsed.data).returning();
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "content.faq.created",
        resourceType: "faq",
        resourceId: created.id,
        newValue: created,
        ipAddress,
        userAgent,
      });
      return created;
    });
    return NextResponse.json({ faq }, { status: 201 });
  } catch (error) {
    console.error("Admin FAQ create error:", error);
    return NextResponse.json({ error: "Failed to create FAQ" }, { status: 500 });
  }
}
