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

    const testimonials = list.map((flag) => ({
      id: flag.id,
      name: (flag.metadata as any)?.name || flag.name,
      business: (flag.metadata as any)?.business || "",
      review: flag.description || "",
      rating: (flag.metadata as any)?.rating || 5,
      isPublished: flag.isEnabled,
      createdAt: flag.createdAt,
    }));

    return NextResponse.json({
      testimonials,
      total: totalAgg[0]?.total ?? 0,
    });
  } catch (error) {
    console.error("Admin testimonials error:", error);
    return NextResponse.json({ error: "Failed to load testimonials" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const body = await request.json();
    const [testimonial] = await db.insert(featureFlags).values({
      key: `testimonial_${Date.now()}`,
      name: body.name,
      description: body.review,
      isEnabled: body.isPublished ?? false,
      metadata: { business: body.business, rating: body.rating || 5 },
    }).returning();

    const clientInfo = getClientInfo(request);
    if (user) {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "testimonial.created",
        resourceType: "testimonial",
        resourceId: testimonial.id,
        newValue: { name: body.name, business: body.business },
        ...clientInfo,
      });
    }

    return NextResponse.json({ testimonial }, { status: 201 });
  } catch (error) {
    console.error("Admin testimonials create error:", error);
    return NextResponse.json({ error: "Failed to create testimonial" }, { status: 500 });
  }
}
