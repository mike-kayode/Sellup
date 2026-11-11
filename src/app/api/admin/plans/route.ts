import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, plans } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";
import { planInputSchema } from "@/lib/admin-plans";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") || "").trim().slice(0, 100);
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50));
    const conditions = search
      ? [or(ilike(plans.name, `%${search}%`), ilike(plans.slug, `%${search}%`))!]
      : [];
    const where = conditions.length ? and(...conditions) : undefined;
    const [totalResult, list] = await Promise.all([
      db.select({ total: count() }).from(plans).where(where),
      db.select().from(plans).where(where)
        .orderBy(desc(plans.sortOrder), desc(plans.createdAt))
        .limit(limit).offset((page - 1) * limit),
    ]);
    return NextResponse.json({ plans: list, total: totalResult[0]?.total ?? 0, page, limit });
  } catch (error) {
    console.error("Admin plans error:", error);
    return NextResponse.json({ error: "Failed to load plans" }, { status: 500 });
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
  const parsed = planInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const plan = await db.transaction(async (tx) => {
      const [created] = await tx.insert(plans).values(parsed.data).returning();
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "plan.created",
        resourceType: "plan",
        resourceId: created.id,
        newValue: created,
        ipAddress,
        userAgent,
      });
      return created;
    });
    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "A plan with that slug already exists" }, { status: 409 });
    }
    console.error("Admin plan create error:", error);
    return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
  }
}
