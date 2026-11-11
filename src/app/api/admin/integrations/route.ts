import { count, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, integrations } from "@/db/schema";
import { getClientInfo } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";
import { encryptSensitiveDataV2 } from "@/lib/encryption";

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.string().trim().min(1).max(50).regex(/^[a-z0-9_-]+$/i),
  description: z.string().trim().max(2_000).nullable().optional(),
  secret: z.string().min(1).max(10_000).optional(),
}).strict();

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100).optional(),
  type: z.string().trim().min(1).max(50).regex(/^[a-z0-9_-]+$/i).optional(),
  description: z.string().trim().max(2_000).nullable().optional(),
  secret: z.string().min(1).max(10_000).optional(),
  isEnabled: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).some((key) => key !== "id"), "Provide at least one field to update");

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50));
    const active = url.searchParams.get("isEnabled") || "all";
    const where = active === "true"
      ? eq(integrations.isEnabled, true)
      : active === "false"
        ? eq(integrations.isEnabled, false)
        : undefined;
    const [totalResult, rows] = await Promise.all([
      db.select({ total: count() }).from(integrations).where(where),
      db.select({
        id: integrations.id,
        name: integrations.name,
        type: integrations.type,
        status: integrations.status,
        description: integrations.description,
        isEnabled: integrations.isEnabled,
        hasSecret: integrations.encryptedSecret,
        createdAt: integrations.createdAt,
        updatedAt: integrations.updatedAt,
      }).from(integrations).where(where)
        .orderBy(desc(integrations.createdAt), desc(integrations.id))
        .limit(limit).offset((page - 1) * limit),
    ]);
    return NextResponse.json({
      integrations: rows.map(({ hasSecret, ...row }) => ({ ...row, hasSecret: Boolean(hasSecret) })),
      total: totalResult[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (cause) {
    console.error("Admin integrations list failed:", cause);
    return NextResponse.json({ error: "Failed to load integrations" }, { status: 500 });
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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid integration", details: parsed.error.flatten() }, { status: 400 });

  try {
    const encryptedSecret = parsed.data.secret ? encryptSensitiveDataV2(parsed.data.secret) : null;
    const { ipAddress, userAgent } = getClientInfo(request);
    const integration = await db.transaction(async (tx) => {
      const [created] = await tx.insert(integrations).values({
        name: parsed.data.name,
        type: parsed.data.type,
        description: parsed.data.description ?? null,
        encryptedSecret,
        isEnabled: false,
        status: "inactive",
      }).returning({
        id: integrations.id,
        name: integrations.name,
        type: integrations.type,
        description: integrations.description,
        isEnabled: integrations.isEnabled,
        createdAt: integrations.createdAt,
      });
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "integration.created",
        resourceType: "integration",
        resourceId: created.id,
        newValue: { ...created, hasSecret: Boolean(encryptedSecret) },
        ipAddress,
        userAgent,
      });
      return created;
    });
    return NextResponse.json({ integration: { ...integration, hasSecret: Boolean(encryptedSecret) } }, { status: 201 });
  } catch (cause) {
    console.error("Admin integration creation failed:", cause);
    return NextResponse.json({ error: "Failed to create integration" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid integration update", details: parsed.error.flatten() }, { status: 400 });

  try {
    const { id, secret, ...updates } = parsed.data;
    const set: Partial<typeof integrations.$inferInsert> = {
      ...updates,
      ...(secret ? { encryptedSecret: encryptSensitiveDataV2(secret) } : {}),
      ...(updates.isEnabled !== undefined ? { status: updates.isEnabled ? "active" : "inactive" } : {}),
      updatedAt: new Date(),
    };
    const { ipAddress, userAgent } = getClientInfo(request);
    const result = await db.transaction(async (tx) => {
      const [before] = await tx.select({
        id: integrations.id,
        name: integrations.name,
        type: integrations.type,
        status: integrations.status,
        description: integrations.description,
        isEnabled: integrations.isEnabled,
        encryptedSecret: integrations.encryptedSecret,
      }).from(integrations).where(eq(integrations.id, id)).limit(1);
      if (!before) return null;
      const [after] = await tx.update(integrations).set(set).where(eq(integrations.id, id)).returning({
        id: integrations.id,
        name: integrations.name,
        type: integrations.type,
        status: integrations.status,
        description: integrations.description,
        isEnabled: integrations.isEnabled,
        encryptedSecret: integrations.encryptedSecret,
      });
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "integration.updated",
        resourceType: "integration",
        resourceId: id,
        previousValue: { ...before, encryptedSecret: undefined, hasSecret: Boolean(before.encryptedSecret) },
        newValue: { ...after, encryptedSecret: undefined, hasSecret: Boolean(after.encryptedSecret) },
        ipAddress,
        userAgent,
      });
      return { ...after, encryptedSecret: undefined, hasSecret: Boolean(after.encryptedSecret) };
    });
    if (!result) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    return NextResponse.json({ integration: result });
  } catch (cause) {
    console.error("Admin integration update failed:", cause);
    return NextResponse.json({ error: "Failed to update integration" }, { status: 500 });
  }
}
