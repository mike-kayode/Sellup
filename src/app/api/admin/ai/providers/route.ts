
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { aiProviders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encryptSensitiveDataV2 } from "@/lib/encryption";
import { createAuditLog } from "@/lib/admin-audit";

const upsertSchema = z.object({
  name: z.string().min(1).max(100),
  endpoint: z.string().url().optional().or(z.literal("")),
  apiKey: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  try {
    const rows = await db
      .select({
        id: aiProviders.id,
        name: aiProviders.name,
        endpoint: aiProviders.endpoint,
        isActive: aiProviders.isActive,
        isDefault: aiProviders.isDefault,
        createdAt: aiProviders.createdAt,
        updatedAt: aiProviders.updatedAt,
      })
      .from(aiProviders)
      .orderBy(aiProviders.createdAt);

    return NextResponse.json({ providers: rows });
  } catch (error) {
    console.error("AI providers list error:", error);
    return NextResponse.json({ error: "Failed to list providers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { user } = auth!;

  try {
    const body = await request.json();
    const { name, endpoint, apiKey, isActive, isDefault } = upsertSchema.parse(body);

    // If setting as default, unset other defaults
    if (isDefault) {
      await db.update(aiProviders).set({ isDefault: false });
    }

    const encryptedApiKey = apiKey ? encryptSensitiveDataV2(apiKey) : undefined;

    const [inserted] = await db
      .insert(aiProviders)
      .values({
        name,
        endpoint: endpoint || null,
        encryptedApiKey,
        isActive: isActive ?? true,
        isDefault: isDefault ?? false,
      })
      .returning();

    try {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "admin.ai.provider.create",
        resourceType: "ai_provider",
        resourceId: inserted.id,
        previousValue: undefined,
        newValue: { name, endpoint, isActive: inserted.isActive, isDefault: inserted.isDefault },
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: request.headers.get("user-agent") ?? undefined,
        status: "success",
      });
    } catch { /* ignore */ }

    return NextResponse.json({ provider: { ...inserted, encryptedApiKey: undefined } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }
    console.error("AI provider create error:", error);
    return NextResponse.json({ error: "Failed to create provider" }, { status: 500 });
  }
}

