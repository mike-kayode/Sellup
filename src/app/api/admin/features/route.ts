import { count, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, featureFlags } from "@/db/schema";
import { getClientInfo } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";
import { clearFeatureFlagCache } from "@/lib/feature-flags";

const featureSchema = z.object({
  key: z.string().trim().min(1).max(100).regex(/^[a-z0-9][a-z0-9._-]*$/i),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5_000).nullable().optional(),
  isEnabled: z.boolean().default(false),
  enabledForPlans: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  enabledForStores: z.array(z.string().uuid()).max(500).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).strict();

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50));
    const enabled = url.searchParams.get("isEnabled") || "all";
    const where = enabled === "true"
      ? eq(featureFlags.isEnabled, true)
      : enabled === "false"
        ? eq(featureFlags.isEnabled, false)
        : undefined;
    const [totalResult, rows] = await Promise.all([
      db.select({ total: count() }).from(featureFlags).where(where),
      db.select().from(featureFlags).where(where)
        .orderBy(desc(featureFlags.createdAt), desc(featureFlags.id))
        .limit(limit).offset((page - 1) * limit),
    ]);
    return NextResponse.json({ features: rows, total: totalResult[0]?.total ?? 0, page, limit });
  } catch (cause) {
    console.error("Admin feature flags list failed:", cause);
    return NextResponse.json({ error: "Failed to load feature flags" }, { status: 500 });
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
  const parsed = featureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid feature flag", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const feature = await db.transaction(async (tx) => {
      const [created] = await tx.insert(featureFlags).values(parsed.data).returning();
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "feature.created",
        resourceType: "feature_flag",
        resourceId: created.id,
        newValue: created,
        ipAddress,
        userAgent,
      });
      return created;
    });
    clearFeatureFlagCache(feature.key);
    return NextResponse.json({ feature }, { status: 201 });
  } catch (cause) {
    console.error("Admin feature flag creation failed:", cause);
    return NextResponse.json({ error: "Failed to create feature flag" }, { status: 500 });
  }
}
