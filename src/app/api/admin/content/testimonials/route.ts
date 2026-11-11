import { NextRequest, NextResponse } from "next/server";
import { count, desc, ilike } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, testimonials } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";

const testimonialSchema = z.object({
  name: z.string().trim().min(1).max(255),
  business: z.string().trim().max(255).nullable().optional(),
  image: z.string().trim().max(500).nullable().optional(),
  review: z.string().trim().min(1).max(10_000),
  rating: z.number().int().min(1).max(5).default(5),
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
    const where = search ? ilike(testimonials.name, `%${search}%`) : undefined;
    const [totalResult, rows] = await Promise.all([
      db.select({ total: count() }).from(testimonials).where(where),
      db.select().from(testimonials).where(where).orderBy(desc(testimonials.createdAt))
        .limit(limit).offset((page - 1) * limit),
    ]);
    return NextResponse.json({ testimonials: rows, total: totalResult[0]?.total ?? 0, page, limit });
  } catch (error) {
    console.error("Admin testimonials error:", error);
    return NextResponse.json({ error: "Failed to load testimonials" }, { status: 500 });
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
  const parsed = testimonialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid testimonial", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const testimonial = await db.transaction(async (tx) => {
      const [created] = await tx.insert(testimonials).values(parsed.data).returning();
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "content.testimonial.created",
        resourceType: "testimonial",
        resourceId: created.id,
        newValue: created,
        ipAddress,
        userAgent,
      });
      return created;
    });
    return NextResponse.json({ testimonial }, { status: 201 });
  } catch (error) {
    console.error("Admin testimonial create error:", error);
    return NextResponse.json({ error: "Failed to create testimonial" }, { status: 500 });
  }
}
