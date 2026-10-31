
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMerchant } from "@/lib/merchant-auth";
import { generateText } from "@/lib/ai-wrapper";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { createMerchantAuditLog } from "@/lib/admin-audit";

const schema = z.object({
  feature: z.enum(["product_copy", "seo", "background_cleanup", "catalog_bulk", "assistant", "insight"]),
  systemPrompt: z.string().max(2000).optional(),
  userPrompt: z.string().min(1).max(4000),
  maxTokens: z.number().int().min(1).max(4000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  providerName: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireMerchant(request);
  if (auth.error) return auth.error;
  const { merchant } = auth!;

  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rate = await checkAuthRateLimit(`ai-generate:${ip}`);
    if (!rate.success) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await request.json();
    const { feature, systemPrompt, userPrompt, maxTokens, temperature, providerName } = schema.parse(body);

    const result = await generateText({
      storeId: merchant.storeId,
      feature,
      systemPrompt: systemPrompt || "",
      userPrompt,
      maxTokens,
      temperature,
      providerName,
    });

    try {
      await createMerchantAuditLog({
        actorId: merchant.userId,
        actorRole: "merchant",
        action: "merchant.ai.generate",
        resourceType: "ai_generation",
        storeId: merchant.storeId,
        previousValue: undefined,
        newValue: { storeId: merchant.storeId, feature, provider: result.provider, inputTokens: result.inputTokens, outputTokens: result.outputTokens },
        ipAddress: ip,
        userAgent: request.headers.get("user-agent") ?? undefined,
        status: "success",
      });
    } catch { /* ignore */ }

    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }
    console.error("AI generate error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate" }, { status: 500 });
  }
}

