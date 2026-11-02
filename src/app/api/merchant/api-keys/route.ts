import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireMerchant } from "@/lib/merchant-auth";
import { createMerchantAuditLog } from "@/lib/admin-audit";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";

function generateKey(): { rawKey: string; prefix: string; hashedKey: string } {
  const raw = "sk_live_" + crypto.randomBytes(32).toString("hex");
  const prefix = raw.slice(0, 8);
  const hashed = crypto.createHash("sha256").update(raw).digest("hex");
  return { rawKey: raw, prefix, hashedKey: hashed };
}

const createKeySchema = z.object({
  name: z.string().min(2).max(100),
  scopes: z.array(z.string()).optional(),
  expiresInDays: z.number().int().min(1).max(3650).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireMerchant(request);
  if (auth.error) return auth.error;
  const { merchant } = auth!;

  try {
    const rows = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        prefix: apiKeys.prefix,
        scopes: apiKeys.scopes,
        expiresAt: apiKeys.expiresAt,
        lastUsedAt: apiKeys.lastUsedAt,
        lastUsedIp: apiKeys.lastUsedIp,
        isActive: apiKeys.isActive,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.storeId, merchant.storeId))
      .orderBy(apiKeys.createdAt);

    // Never return the raw key or hash.
    return NextResponse.json({ apiKeys: rows.map((r) => ({ ...r, hashedKey: undefined })) });
  } catch (error) {
    console.error("API keys list error:", error);
    return NextResponse.json({ error: "Failed to list API keys" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireMerchant(request);
  if (auth.error) return auth.error;
  const { merchant } = auth!;

  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rate = await checkAuthRateLimit("merchant-api-key-create:" + ip);
    if (!rate.success) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await request.json();
    const { name, scopes = [], expiresInDays } = createKeySchema.parse(body);

    const { rawKey, prefix, hashedKey } = generateKey();
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null;

    const [inserted] = await db
      .insert(apiKeys)
      .values({
        name,
        prefix,
        hashedKey,
        storeId: merchant.storeId,
        scopes,
        expiresAt,
        isActive: true,
      })
      .returning();

    // Audit.
    try {
      await createMerchantAuditLog({
        actorId: merchant.userId,
        actorRole: "merchant",
        action: "merchant.api-key.create",
        resourceType: "api_key",
        resourceId: inserted.id,
        storeId: merchant.storeId,
        previousValue: undefined,
        newValue: { storeId: merchant.storeId, name, prefix, scopes },
        ipAddress: ip,
        userAgent: request.headers.get("user-agent") ?? undefined,
        status: "success",
      });
    } catch {
      // ignore audit failures
    }

    // Return the raw key ONCE.
    return NextResponse.json(
      { apiKey: { ...inserted, hashedKey: undefined }, rawKey },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }
    console.error("API key create error:", error);
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}
