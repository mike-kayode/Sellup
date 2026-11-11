import { createHash, randomBytes } from "crypto";
import { and, count, desc, eq, ilike } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { apiKeys, auditLogs } from "@/db/schema";
import { getClientInfo } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
}).strict();

const revokeSchema = z.object({
  action: z.literal("revoke"),
  id: z.string().uuid(),
}).strict();

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50));
    const search = (url.searchParams.get("search") || "").trim().slice(0, 100);
    const status = url.searchParams.get("status") || "all";
    const filters = [];
    if (search) filters.push(ilike(apiKeys.name, `%${search}%`));
    if (status === "active") filters.push(eq(apiKeys.isActive, true));
    if (status === "revoked") filters.push(eq(apiKeys.isActive, false));
    const where = filters.length ? and(...filters) : undefined;

    const [totalResult, rows] = await Promise.all([
      db.select({ total: count() }).from(apiKeys).where(where),
      db.select({
        id: apiKeys.id,
        name: apiKeys.name,
        prefix: apiKeys.prefix,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
        expiresAt: apiKeys.expiresAt,
        isActive: apiKeys.isActive,
        storeId: apiKeys.storeId,
      }).from(apiKeys).where(where)
        .orderBy(desc(apiKeys.createdAt), desc(apiKeys.id))
        .limit(limit).offset((page - 1) * limit),
    ]);

    return NextResponse.json({ keys: rows, total: totalResult[0]?.total ?? 0, page, limit });
  } catch (cause) {
    console.error("Admin API keys list failed:", cause);
    return NextResponse.json({ error: "Failed to load API keys" }, { status: 500 });
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
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid API key details", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const secret = `nb_live_sk_${randomBytes(24).toString("hex")}`;
    const hashedKey = createHash("sha256").update(secret).digest("hex");
    const prefix = secret.slice(0, 12);
    const { ipAddress, userAgent } = getClientInfo(request);
    const key = await db.transaction(async (tx) => {
      const [created] = await tx.insert(apiKeys).values({
        name: parsed.data.name,
        prefix,
        hashedKey,
        isActive: true,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      }).returning({
        id: apiKeys.id,
        name: apiKeys.name,
        prefix: apiKeys.prefix,
        isActive: apiKeys.isActive,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      });
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "api_key.created",
        resourceType: "api_key",
        resourceId: created.id,
        newValue: { name: created.name, prefix: created.prefix, expiresAt: created.expiresAt },
        ipAddress,
        userAgent,
      });
      return created;
    });

    return NextResponse.json({ key: { ...key, secret } }, { status: 201 });
  } catch (cause) {
    console.error("Admin API key creation failed:", cause);
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
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
  const parsed = revokeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid revoke request", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const key = await db.transaction(async (tx) => {
      const [before] = await tx.select({
        id: apiKeys.id,
        name: apiKeys.name,
        prefix: apiKeys.prefix,
        isActive: apiKeys.isActive,
      }).from(apiKeys).where(eq(apiKeys.id, parsed.data.id)).limit(1);
      if (!before) return null;
      if (!before.isActive) return before;
      const [after] = await tx.update(apiKeys).set({
        isActive: false,
        updatedAt: new Date(),
      }).where(eq(apiKeys.id, before.id)).returning({
        id: apiKeys.id,
        name: apiKeys.name,
        prefix: apiKeys.prefix,
        isActive: apiKeys.isActive,
      });
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "api_key.revoked",
        resourceType: "api_key",
        resourceId: before.id,
        previousValue: before,
        newValue: after,
        ipAddress,
        userAgent,
      });
      return after;
    });
    if (!key) return NextResponse.json({ error: "API key not found" }, { status: 404 });
    return NextResponse.json({ key });
  } catch (cause) {
    console.error("Admin API key revoke failed:", cause);
    return NextResponse.json({ error: "Failed to revoke API key" }, { status: 500 });
  }
}
