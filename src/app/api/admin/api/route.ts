import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { desc, count } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { createAuditLog, getClientInfo } from "@/lib/admin-audit";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const totalAgg = await db.select({ total: count() }).from(apiKeys);
    const keys = await db.select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    }).from(apiKeys).orderBy(desc(apiKeys.createdAt)).limit(50);

    return NextResponse.json({
      keys,
      total: totalAgg[0]?.total ?? 0,
    });
  } catch (error) {
    console.error("Admin API error:", error);
    return NextResponse.json({ error: "Failed to load API keys" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const body = await request.json();
    const secret = `nb_live_sk_${randomBytes(18).toString("hex")}`;
    const hashedKey = createHash("sha256").update(secret).digest("hex");
    const prefix = secret.slice(0, 12);

    const [key] = await db.insert(apiKeys).values({
      name: body.name || "New API Key",
      prefix,
      hashedKey,
      isActive: true,
      lastUsedAt: null,
    }).returning();

    const clientInfo = getClientInfo(request);
    if (user) {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "api_key.created",
        resourceType: "api_key",
        resourceId: key.id,
        newValue: { name: key.name, prefix: key.prefix },
        ...clientInfo,
      });
    }

    return NextResponse.json({
      key: {
        ...key,
        secret,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Admin API create error:", error);
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}
