import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, faqs } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";

type Context = { params: Promise<{ id: string }> };
const updateSchema = z.object({
  question: z.string().trim().min(1).max(500).optional(),
  answer: z.string().trim().min(1).max(20_000).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
  isPublished: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "No changes supplied");

export async function PUT(request: NextRequest, context: Context) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid FAQ ID" }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid FAQ", details: parsed.error.flatten() }, { status: 400 });
  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const faq = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(faqs).where(eq(faqs.id, id)).limit(1);
      if (!before) return null;
      const [after] = await tx.update(faqs).set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(faqs.id, id)).returning();
      await tx.insert(auditLogs).values({
        actorId: user.id, actorRole: user.role, action: "content.faq.updated",
        resourceType: "faq", resourceId: id, previousValue: before, newValue: after,
        ipAddress, userAgent,
      });
      return after;
    });
    if (!faq) return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
    return NextResponse.json({ faq });
  } catch (error) {
    console.error("Admin FAQ update error:", error);
    return NextResponse.json({ error: "Failed to update FAQ" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid FAQ ID" }, { status: 400 });
  if (new URL(request.url).searchParams.get("confirm") !== "unpublish") return NextResponse.json({ error: "Confirm FAQ unpublication" }, { status: 400 });
  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const faq = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(faqs).where(eq(faqs.id, id)).limit(1);
      if (!before) return null;
      const [after] = await tx.update(faqs).set({ isPublished: false, updatedAt: new Date() })
        .where(eq(faqs.id, id)).returning();
      await tx.insert(auditLogs).values({
        actorId: user.id, actorRole: user.role, action: "content.faq.unpublished",
        resourceType: "faq", resourceId: id, previousValue: before, newValue: after,
        ipAddress, userAgent,
      });
      return after;
    });
    if (!faq) return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
    return NextResponse.json({ faq });
  } catch (error) {
    console.error("Admin FAQ unpublish error:", error);
    return NextResponse.json({ error: "Failed to unpublish FAQ" }, { status: 500 });
  }
}
