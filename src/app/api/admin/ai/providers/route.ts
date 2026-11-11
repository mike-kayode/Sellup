import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { aiProviders, auditLogs } from "@/db/schema";
import { getClientInfo } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";
import { encryptSensitiveDataV2 } from "@/lib/encryption";
import { isAllowedAiProviderEndpoint } from "@/lib/ai-wrapper";

const endpointSchema = z.string().url().max(500)
  .refine(isAllowedAiProviderEndpoint, "Endpoint must use HTTPS and an approved provider host");

const providerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  endpoint: endpointSchema.optional().or(z.literal("")),
  apiKey: z.string().min(1).max(10_000).optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
}).strict();

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100).optional(),
  endpoint: endpointSchema.nullable().optional().or(z.literal("")),
  apiKey: z.string().min(1).max(10_000).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 1, "Provide at least one field to update");

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  try {
    const rows = await db.select({
      id: aiProviders.id,
      name: aiProviders.name,
      endpoint: aiProviders.endpoint,
      isActive: aiProviders.isActive,
      isDefault: aiProviders.isDefault,
      hasApiKey: aiProviders.encryptedApiKey,
      createdAt: aiProviders.createdAt,
      updatedAt: aiProviders.updatedAt,
    }).from(aiProviders).orderBy(aiProviders.createdAt).limit(100);
    return NextResponse.json({
      providers: rows.map(({ hasApiKey, ...row }) => ({ ...row, hasApiKey: Boolean(hasApiKey) })),
    });
  } catch (cause) {
    console.error("AI provider list failed:", cause);
    return NextResponse.json({ error: "Failed to list providers" }, { status: 500 });
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
  const parsed = providerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid provider", details: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.isActive && !parsed.data.apiKey) {
    return NextResponse.json({ error: "An active provider requires an API key" }, { status: 400 });
  }

  try {
    const encryptedApiKey = parsed.data.apiKey
      ? encryptSensitiveDataV2(parsed.data.apiKey)
      : null;
    const { ipAddress, userAgent } = getClientInfo(request);
    const provider = await db.transaction(async (tx) => {
      if (parsed.data.isDefault) {
        await tx.update(aiProviders).set({ isDefault: false, updatedAt: new Date() });
      }
      const [created] = await tx.insert(aiProviders).values({
        name: parsed.data.name,
        endpoint: parsed.data.endpoint || null,
        encryptedApiKey,
        isActive: parsed.data.isActive,
        isDefault: parsed.data.isDefault,
      }).returning({
        id: aiProviders.id,
        name: aiProviders.name,
        endpoint: aiProviders.endpoint,
        isActive: aiProviders.isActive,
        isDefault: aiProviders.isDefault,
        createdAt: aiProviders.createdAt,
      });
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "ai_provider.created",
        resourceType: "ai_provider",
        resourceId: created.id,
        newValue: { ...created, hasApiKey: Boolean(encryptedApiKey) },
        ipAddress,
        userAgent,
      });
      return created;
    });
    return NextResponse.json({ provider: { ...provider, hasApiKey: Boolean(encryptedApiKey) } }, { status: 201 });
  } catch (cause) {
    console.error("AI provider create failed:", cause);
    return NextResponse.json({ error: "Failed to create provider" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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
  if (!parsed.success) return NextResponse.json({ error: "Invalid provider update", details: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.isDefault && parsed.data.isActive === false) {
    return NextResponse.json({ error: "An inactive provider cannot be the default" }, { status: 400 });
  }

  try {
    const { id, apiKey, ...fields } = parsed.data;
    const { ipAddress, userAgent } = getClientInfo(request);
    const provider = await db.transaction(async (tx) => {
      const [before] = await tx.select({
        id: aiProviders.id,
        name: aiProviders.name,
        endpoint: aiProviders.endpoint,
        isActive: aiProviders.isActive,
        isDefault: aiProviders.isDefault,
        encryptedApiKey: aiProviders.encryptedApiKey,
      }).from(aiProviders).where(eq(aiProviders.id, id)).for("update").limit(1);
      if (!before) return null;
      const isActive = fields.isActive ?? before.isActive;
      const isDefault = fields.isDefault ?? before.isDefault;
      const encryptedApiKey = apiKey ? encryptSensitiveDataV2(apiKey) : before.encryptedApiKey;
      if (isActive && !encryptedApiKey) throw new Error("AI_PROVIDER_KEY_REQUIRED");
      if (isDefault && !isActive) throw new Error("AI_PROVIDER_DEFAULT_INACTIVE");
      if (isDefault) {
        await tx.update(aiProviders).set({ isDefault: false, updatedAt: new Date() });
      }
      const [updated] = await tx.update(aiProviders).set({
        ...fields,
        encryptedApiKey,
        isActive,
        isDefault,
        updatedAt: new Date(),
      }).where(eq(aiProviders.id, id)).returning({
        id: aiProviders.id,
        name: aiProviders.name,
        endpoint: aiProviders.endpoint,
        isActive: aiProviders.isActive,
        isDefault: aiProviders.isDefault,
        createdAt: aiProviders.createdAt,
        updatedAt: aiProviders.updatedAt,
      });
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "ai_provider.updated",
        resourceType: "ai_provider",
        resourceId: id,
        previousValue: { ...before, encryptedApiKey: undefined, hasApiKey: Boolean(before.encryptedApiKey) },
        newValue: { ...updated, hasApiKey: Boolean(encryptedApiKey) },
        ipAddress,
        userAgent,
      });
      return { ...updated, hasApiKey: Boolean(encryptedApiKey) };
    });
    if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    return NextResponse.json({ provider });
  } catch (cause) {
    if (cause instanceof Error && cause.message === "AI_PROVIDER_KEY_REQUIRED") {
      return NextResponse.json({ error: "An active provider requires an API key" }, { status: 400 });
    }
    if (cause instanceof Error && cause.message === "AI_PROVIDER_DEFAULT_INACTIVE") {
      return NextResponse.json({ error: "An inactive provider cannot be the default" }, { status: 400 });
    }
    console.error("AI provider update failed:", cause);
    return NextResponse.json({ error: "Failed to update provider" }, { status: 500 });
  }
}
