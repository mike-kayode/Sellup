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

    const faqs = list.map((flag) => ({
      id: flag.id,
      question: flag.name,
      answer: flag.description || "",
      category: (flag.metadata as any)?.category || "general",
      isPublished: flag.isEnabled,
      createdAt: flag.createdAt,
    }));

    return NextResponse.json({
      faqs,
      total: totalAgg[0]?.total ?? 0,
    });
  } catch (error) {
    console.error("Admin FAQs error:", error);
    return NextResponse.json({ error: "Failed to load FAQs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const body = await request.json();
    const [faq] = await db.insert(featureFlags).values({
      key: `faq_${Date.now()}`,
      name: body.question,
      description: body.answer,
      isEnabled: body.isPublished ?? false,
      metadata: { category: body.category || "general" },
    }).returning();

    const clientInfo = getClientInfo(request);
    if (user) {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "faq.created",
        resourceType: "faq",
        resourceId: faq.id,
        newValue: { question: body.question, category: body.category },
        ...clientInfo,
      });
    }

    return NextResponse.json({ faq }, { status: 201 });
  } catch (error) {
    console.error("Admin FAQs create error:", error);
    return NextResponse.json({ error: "Failed to create FAQ" }, { status: 500 });
  }
}
