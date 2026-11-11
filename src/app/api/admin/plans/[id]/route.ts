import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, plans } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";
import { planUpdateSchema } from "@/lib/admin-plans";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = planUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(plans).where(eq(plans.id, id)).limit(1);
      if (!existing) return null;
      const [saved] = await tx.update(plans)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(plans.id, id))
        .returning();
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "plan.updated",
        resourceType: "plan",
        resourceId: id,
        previousValue: existing,
        newValue: saved,
        ipAddress,
        userAgent,
      });
      return saved;
    });
    if (!updated) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    return NextResponse.json({ plan: updated });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "A plan with that slug already exists" }, { status: 409 });
    }
    console.error("Admin plan update error:", error);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 });
  }
  const confirmation = new URL(request.url).searchParams.get("confirm");
  if (confirmation !== "deactivate") {
    return NextResponse.json({ error: "Confirm plan deactivation" }, { status: 400 });
  }

  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(plans).where(eq(plans.id, id)).limit(1);
      if (!existing) return null;
      const [saved] = await tx.update(plans)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(plans.id, id))
        .returning();
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "plan.deactivated",
        resourceType: "plan",
        resourceId: id,
        previousValue: existing,
        newValue: saved,
        ipAddress,
        userAgent,
      });
      return saved;
    });
    if (!result) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    return NextResponse.json({ plan: result });
  } catch (error) {
    console.error("Admin plan deactivation error:", error);
    return NextResponse.json({ error: "Failed to deactivate plan" }, { status: 500 });
  }
}
