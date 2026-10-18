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

    const pages = list.map((flag) => ({
      id: flag.id,
      title: flag.name,
      slug: flag.key,
      status: flag.isEnabled ? "published" : "draft",
      updatedAt: flag.updatedAt,
    }));

    return NextResponse.json({
      pages,
      total: totalAgg[0]?.total ?? 0,
    });
  } catch (error) {
    console.error("Admin content pages error:", error);
    return NextResponse.json({ error: "Failed to load pages" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const body = await request.json();
    const [page] = await db.insert(featureFlags).values({
      key: body.slug || `page_${Date.now()}`,
      name: body.title,
      description: body.content,
      isEnabled: body.status === "published",
    }).returning();

    const clientInfo = getClientInfo(request);
    if (user) {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "content_page.created",
        resourceType: "content_page",
        resourceId: page.id,
        newValue: { title: body.title, slug: body.slug },
        ...clientInfo,
      });
    }

    return NextResponse.json({ page }, { status: 201 });
  } catch (error) {
    console.error("Admin content pages create error:", error);
    return NextResponse.json({ error: "Failed to create page" }, { status: 500 });
  }
}
