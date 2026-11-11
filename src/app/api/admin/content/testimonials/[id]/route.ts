import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, testimonials } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";

type Context = { params: Promise<{ id: string }> };
const updateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  business: z.string().trim().max(255).nullable().optional(),
  image: z.string().trim().max(500).nullable().optional(),
  review: z.string().trim().min(1).max(10_000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  isPublished: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "No changes supplied");

export async function PUT(request: NextRequest, context: Context) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid testimonial ID" }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid testimonial", details: parsed.error.flatten() }, { status: 400 });
  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const testimonial = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(testimonials).where(eq(testimonials.id, id)).limit(1);
      if (!before) return null;
      const [after] = await tx.update(testimonials).set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(testimonials.id, id)).returning();
      await tx.insert(auditLogs).values({
        actorId: user.id, actorRole: user.role, action: "content.testimonial.updated",
        resourceType: "testimonial", resourceId: id, previousValue: before, newValue: after,
        ipAddress, userAgent,
      });
      return after;
    });
    if (!testimonial) return NextResponse.json({ error: "Testimonial not found" }, { status: 404 });
    return NextResponse.json({ testimonial });
  } catch (error) {
    console.error("Admin testimonial update error:", error);
    return NextResponse.json({ error: "Failed to update testimonial" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid testimonial ID" }, { status: 400 });
  if (new URL(request.url).searchParams.get("confirm") !== "unpublish") return NextResponse.json({ error: "Confirm testimonial unpublication" }, { status: 400 });
  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const testimonial = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(testimonials).where(eq(testimonials.id, id)).limit(1);
      if (!before) return null;
      const [after] = await tx.update(testimonials).set({ isPublished: false, updatedAt: new Date() })
        .where(eq(testimonials.id, id)).returning();
      await tx.insert(auditLogs).values({
        actorId: user.id, actorRole: user.role, action: "content.testimonial.unpublished",
        resourceType: "testimonial", resourceId: id, previousValue: before, newValue: after,
        ipAddress, userAgent,
      });
      return after;
    });
    if (!testimonial) return NextResponse.json({ error: "Testimonial not found" }, { status: 404 });
    return NextResponse.json({ testimonial });
  } catch (error) {
    console.error("Admin testimonial unpublish error:", error);
    return NextResponse.json({ error: "Failed to unpublish testimonial" }, { status: 500 });
  }
}
