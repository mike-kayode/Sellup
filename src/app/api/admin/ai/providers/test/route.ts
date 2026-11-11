import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { getClientInfo } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";
import { testAiProviderConnection } from "@/lib/ai-wrapper";

const requestSchema = z.object({ providerId: z.string().uuid() }).strict();

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
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid provider test request" }, { status: 400 });
  }

  const { ipAddress, userAgent } = getClientInfo(request);
  try {
    const result = await testAiProviderConnection(parsed.data.providerId);
    await db.insert(auditLogs).values({
      actorId: user.id,
      actorRole: user.role,
      action: "ai_provider.test_succeeded",
      resourceType: "ai_provider",
      resourceId: parsed.data.providerId,
      newValue: { provider: result.provider, latencyMs: result.latencyMs },
      ipAddress,
      userAgent,
    });
    return NextResponse.json(result);
  } catch (cause) {
    await db.insert(auditLogs).values({
      actorId: user.id,
      actorRole: user.role,
      action: "ai_provider.test_failed",
      resourceType: "ai_provider",
      resourceId: parsed.data.providerId,
      newValue: { outcome: "failed" },
      ipAddress,
      userAgent,
    });
    console.error("AI provider connection test failed:", cause);
    return NextResponse.json({ error: "Provider connection test failed" }, { status: 502 });
  }
}
