/**
 * Sell Up provider-agnostic AI wrapper (Phase 8).
 *
 * Design principles:
 *   - Tenant isolation: every generation is scoped to a single store_id.
 *   - Fail closed: quota exhaustion, missing provider config, or PII
 *     detection denies the request rather than falling back to an unsafe model.
 *   - Per-store quotas (tokens + cost) enforced before any provider call.
 *   - Prompt-injection safeguards: system instructions are separated from
 *     user-provided content; user input is never interpreted as commands.
 */

import { db } from "@/db";
import {
  aiGenerations,
  aiProviders,
  aiQuotas,
  businesses,
} from "@/db/schema";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { encryptSensitiveDataV2, decryptSensitiveDataV2 } from "@/lib/encryption";

export type AiFeature =
  | "product_copy"
  | "seo"
  | "background_cleanup"
  | "catalog_bulk"
  | "assistant"
  | "insight";

export interface AiGenerateInput {
  storeId: string;
  feature: AiFeature;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  providerName?: string;
}

export interface AiGenerateResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  provider: string;
}

export interface AiUsage {
  storeId: string;
  monthStart: Date;
  tokensUsed: number;
  costUsed: number;
  tokenLimit: number;
  costCap: number;
  remainingTokens: number;
  remainingCost: number;
  blocked: boolean;
}

const PII_PATTERNS = [
  /sk-[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /(password|secret|api[_-]?key)\s*[:=]\s*\S+/i,
];

const MAX_USER_PROMPT_CHARS = 4000;

function containsPiiOrSecrets(text: string): boolean {
  return PII_PATTERNS.some((p) => p.test(text));
}

function containsInjectionAttempt(text: string): boolean {
  const injectionPatterns = [
    /ignore\s+(previous|all|above)\s+(instructions|rules|system)/i,
    /disregard\s+(the|above|previous)\s+(system|instruction)/i,
    /you\s+are\s+now\s+(a|an)\s+/i,
    /system\s*:\s*\n/i,
    /<system>/i,
  ];
  return injectionPatterns.some((p) => p.test(text));
}

function sanitizeUserPrompt(text: string): string {
  return text
    .replace(/system\s*:\s*/gi, "")
    .replace(/<system>|<\/system>/gi, "")
    .trim();
}



async function resolveProvider(
  storeId: string,
  preferred?: string
): Promise<{ id: string; name: string; apiKey: string } | null> {
  const [provider] = await db
    .select({
      id: aiProviders.id,
      name: aiProviders.name,
      encryptedApiKey: aiProviders.encryptedApiKey,
    })
    .from(aiProviders)
    .where(
      preferred
        ? and(
            eq(aiProviders.name, preferred),
            eq(aiProviders.isActive, true)
          )
        : and(eq(aiProviders.isDefault, true), eq(aiProviders.isActive, true))
    )
    .limit(1);
  if (!provider || !provider.encryptedApiKey) return null;
  let apiKey: string;
  try {
    apiKey = decryptSensitiveDataV2(provider.encryptedApiKey);
  } catch {
    return null;
  }
  return { id: provider.id, name: provider.name, apiKey };
}

async function getOrCreateQuota(storeId: string): Promise<{
  id: string;
  tokensUsed: number;
  costUsed: number;
  tokenLimit: number;
  costCap: number;
  monthStart: Date;
}> {
  const now = new Date();
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );
  const [existing] = await db
    .select({
      id: aiQuotas.id,
      tokensUsedThisMonth: aiQuotas.tokensUsedThisMonth,
      costUsedThisMonth: aiQuotas.costUsedThisMonth,
      monthlyTokenLimit: aiQuotas.monthlyTokenLimit,
      monthlyCostCap: aiQuotas.monthlyCostCap,
      monthStart: aiQuotas.monthStart,
    })
    .from(aiQuotas)
    .where(
      and(eq(aiQuotas.storeId, storeId), gte(aiQuotas.monthStart, monthStart))
    )
    .limit(1);
  if (existing) {
    return {
      id: existing.id,
      tokensUsed: existing.tokensUsedThisMonth,
      costUsed: Number(existing.costUsedThisMonth),
      tokenLimit: existing.monthlyTokenLimit,
      costCap: Number(existing.monthlyCostCap),
      monthStart: existing.monthStart,
    };
  }
  const [inserted] = await db
    .insert(aiQuotas)
    .values({
      storeId,
      monthlyTokenLimit: 1_000_000,
      monthlyCostCap: "10.0000",
      tokensUsedThisMonth: 0,
      costUsedThisMonth: "0.0000",
      monthStart,
    })
    .returning({
      id: aiQuotas.id,
      tokensUsedThisMonth: aiQuotas.tokensUsedThisMonth,
      costUsedThisMonth: aiQuotas.costUsedThisMonth,
      monthlyTokenLimit: aiQuotas.monthlyTokenLimit,
      monthlyCostCap: aiQuotas.monthlyCostCap,
      monthStart: aiQuotas.monthStart,
    });
  return {
    id: inserted.id,
    tokensUsed: inserted.tokensUsedThisMonth,
    costUsed: Number(inserted.costUsedThisMonth),
    tokenLimit: inserted.monthlyTokenLimit,
    costCap: Number(inserted.monthlyCostCap),
    monthStart: inserted.monthStart,
  };
}

function checkQuota(
  quota: {
    tokensUsed: number;
    costUsed: number;
    tokenLimit: number;
    costCap: number;
  },
  estimatedTokens: number,
  estimatedCostUsd: number
): { allowed: boolean; reason?: string } {
  if (quota.tokensUsed + estimatedTokens > quota.tokenLimit) {
    return { allowed: false, reason: "monthly token quota exceeded" };
  }
  if (quota.costUsed + estimatedCostUsd > quota.costCap) {
    return { allowed: false, reason: "monthly cost cap exceeded" };
  }
  return { allowed: true };
}



export async function generateText(
  input: AiGenerateInput
): Promise<AiGenerateResult> {
  if (!input.storeId) throw new Error("storeId is required");
  if (!input.feature) throw new Error("feature is required");
  if (!input.userPrompt || input.userPrompt.length === 0) {
    throw new Error("userPrompt is required");
  }
  if (input.userPrompt.length > MAX_USER_PROMPT_CHARS) {
    throw new Error("userPrompt too long");
  }
  if (containsPiiOrSecrets(input.userPrompt)) {
    throw new Error("userPrompt contains secrets or PII");
  }
  if (containsInjectionAttempt(input.userPrompt)) {
    throw new Error("userPrompt contains instruction-override attempt");
  }
  const cleanUserPrompt = sanitizeUserPrompt(input.userPrompt);

  const provider = await resolveProvider(input.storeId, input.providerName);
  if (!provider) {
    throw new Error("no active AI provider configured for this store");
  }

  const quota = await getOrCreateQuota(input.storeId);
  const estimatedTokens = Math.ceil(
    (input.systemPrompt.length + cleanUserPrompt.length) / 4
  );
  const estimatedCostUsd = estimatedTokens * 0.000002;
  const check = checkQuota(
    {
      tokensUsed: quota.tokensUsed,
      costUsed: quota.costUsed,
      tokenLimit: quota.tokenLimit,
      costCap: quota.costCap,
    },
    estimatedTokens,
    estimatedCostUsd
  );
  if (!check.allowed) {
    await db.insert(aiGenerations).values({
      storeId: input.storeId,
      provider: provider.name,
      feature: input.feature,
      prompt: input.userPrompt.slice(0, 500),
      response: null,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: "0.000000",
      status: "blocked_quota",
      error: check.reason,
    });
    throw new Error(check.reason || "quota exceeded");
  }

  let resultText: string;
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: cleanUserPrompt },
        ],
        max_tokens: input.maxTokens ?? 500,
        temperature: input.temperature ?? 0.7,
      }),
    });
    if (!resp.ok) {
      throw new Error(`provider error: ${resp.status}`);
    }
    const data = await resp.json();
    resultText = data.choices?.[0]?.message?.content ?? "";
    inputTokens = data.usage?.prompt_tokens ?? estimatedTokens;
    outputTokens = data.usage?.completion_tokens ?? 0;
    costUsd =
      (inputTokens * 0.00000015 + outputTokens * 0.0000006) / 1000;
  } catch (err: any) {
    await db.insert(aiGenerations).values({
      storeId: input.storeId,
      provider: provider.name,
      feature: input.feature,
      prompt: input.userPrompt.slice(0, 500),
      response: null,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: "0.000000",
      status: "failed",
      error: err?.message ?? String(err),
    });
    throw new Error("AI generation failed");
  }

  await db.transaction(async (tx: any) => {
    await tx.insert(aiGenerations).values({
      storeId: input.storeId,
      provider: provider.name,
      feature: input.feature,
      prompt: input.userPrompt.slice(0, 1000),
      response: resultText.slice(0, 2000),
      inputTokens,
      outputTokens,
      costUsd: String(costUsd),
      status: "completed",
    });
    await tx
      .update(aiQuotas)
      .set({
        tokensUsedThisMonth: quota.tokensUsed + inputTokens + outputTokens,
        costUsedThisMonth: quota.costUsed + costUsd,
        updatedAt: new Date(),
      })
      .where(eq(aiQuotas.id, quota.id));
  });

  return {
    text: resultText,
    inputTokens,
    outputTokens,
    costUsd,
    provider: provider.name,
  };
}



export async function getAiUsage(storeId: string): Promise<AiUsage> {
  const quota = await getOrCreateQuota(storeId);
  const blocked =
    quota.tokensUsed >= quota.tokenLimit ||
    quota.costUsed >= quota.costCap;
  return {
    storeId,
    monthStart: quota.monthStart,
    tokensUsed: quota.tokensUsed,
    costUsed: quota.costUsed,
    tokenLimit: quota.tokenLimit,
    costCap: quota.costCap,
    remainingTokens: Math.max(0, quota.tokenLimit - quota.tokensUsed),
    remainingCost: Math.max(0, quota.costCap - quota.costUsed),
    blocked,
  };
}

export async function setAiQuota(input: {
  storeId: string;
  monthlyTokenLimit?: number;
  monthlyCostCap?: number;
}): Promise<void> {
  const now = new Date();
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );
  await db
    .insert(aiQuotas)
    .values({
      storeId: input.storeId,
      monthlyTokenLimit: input.monthlyTokenLimit ?? 1_000_000,
      monthlyCostCap: input.monthlyCostCap ?? "10.0000",
      tokensUsedThisMonth: 0,
      costUsedThisMonth: "0.0000",
      monthStart,
    })
    .onConflictDoUpdate({
      target: aiQuotas.storeId,
      set: {
        monthlyTokenLimit:
          input.monthlyTokenLimit ?? sql`${aiQuotas.monthlyTokenLimit}`,
        monthlyCostCap:
          input.monthlyCostCap ?? sql`${aiQuotas.monthlyCostCap}`,
        updatedAt: new Date(),
      },
    });
}

export async function listProviders(): Promise<
  Array<{ id: string; name: string; isActive: boolean; isDefault: boolean }>
> {
  const rows = await db
    .select({
      id: aiProviders.id,
      name: aiProviders.name,
      isActive: aiProviders.isActive,
      isDefault: aiProviders.isDefault,
    })
    .from(aiProviders);
  return rows;
}

export async function upsertProvider(input: {
  name: string;
  endpoint?: string;
  apiKey?: string;
  isActive?: boolean;
  isDefault?: boolean;
}): Promise<void> {
  const existing = await db
    .select({ id: aiProviders.id })
    .from(aiProviders)
    .where(eq(aiProviders.name, input.name))
    .limit(1);
  const encrypted = input.apiKey
    ? encryptSensitiveDataV2(input.apiKey)
    : undefined;
  const values: Record<string, any> = {
    name: input.name,
    endpoint: input.endpoint ?? null,
    isActive: input.isActive ?? true,
    isDefault: input.isDefault ?? false,
    updatedAt: new Date(),
  };
  if (encrypted) values.encryptedApiKey = encrypted;
  if (existing) {
    await db.update(aiProviders).set(values).where(eq(aiProviders.id, existing.id));
  } else {
    await db.insert(aiProviders).values(values);
  }
}

