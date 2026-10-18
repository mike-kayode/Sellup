/**
 * Storefront v1 DB helpers: feature flag, draft/published configs,
 * revision history (last 10) and 24h preview tokens.
 */
import { randomBytes } from "crypto";
import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  featureFlags,
  storeConfigs,
  storeConfigRevisions,
  storePreviewTokens,
} from "@/db/schema";
import { STOREFRONT_TEMPLATE_ID, type StoreConfig } from "./config";

export const STOREFRONT_V1_FLAG_KEY = "storefront_v1";
export const PREVIEW_TOKEN_TTL_HOURS = 24;

/**
 * Feature flag for the rollout (spec section 12).
 *
 * Default ON so pilot merchants can be migrated immediately; inserting a
 * `storefront_v1` row with is_enabled = false turns the template off
 * everywhere, falling back to the legacy basic/showcase templates.
 * Result cached for 60s to avoid a query per storefront render.
 */
let flagCache: { value: boolean; at: number } | null = null;

export async function isStorefrontV1Enabled(): Promise<boolean> {
  const now = Date.now();
  if (flagCache && now - flagCache.at < 60_000) return flagCache.value;
  try {
    const rows = await db
      .select({ isEnabled: featureFlags.isEnabled })
      .from(featureFlags)
      .where(eq(featureFlags.key, STOREFRONT_V1_FLAG_KEY))
      .limit(1);
    const value = rows.length === 0 ? true : rows[0].isEnabled !== false;
    flagCache = { value, at: now };
    return value;
  } catch {
    // Fail closed: on DB trouble keep the legacy template path.
    return false;
  }
}

/** Test/dev helper: drop the cached flag value. */
export function resetStorefrontFlagCache(): void {
  flagCache = null;
}

/* --------------------------------- configs -------------------------------- */

export async function getStoreConfig(
  storeId: string,
  scope: "draft" | "published"
): Promise<StoreConfig | null> {
  const rows = await db
    .select({ config: storeConfigs.config })
    .from(storeConfigs)
    .where(and(eq(storeConfigs.storeId, storeId), eq(storeConfigs.scope, scope)))
    .limit(1);
  if (rows.length === 0) return null;
  return (rows[0].config as StoreConfig) ?? null;
}

export async function getPublishedConfig(
  storeId: string
): Promise<StoreConfig | null> {
  return getStoreConfig(storeId, "published");
}

export async function getDraftConfig(storeId: string): Promise<StoreConfig | null> {
  return getStoreConfig(storeId, "draft");
}

export async function saveDraftConfig(
  storeId: string,
  config: StoreConfig
): Promise<void> {
  const rows = await db
    .select({ id: storeConfigs.id })
    .from(storeConfigs)
    .where(and(eq(storeConfigs.storeId, storeId), eq(storeConfigs.scope, "draft")))
    .limit(1);

  if (rows.length > 0) {
    await db
      .update(storeConfigs)
      .set({ config, templateId: STOREFRONT_TEMPLATE_ID, updatedAt: new Date() })
      .where(eq(storeConfigs.id, rows[0].id));
    return;
  }

  await db.insert(storeConfigs).values({
    storeId,
    scope: "draft",
    templateId: STOREFRONT_TEMPLATE_ID,
    config,
  });
}

/**
 * Copy the draft to the published scope and keep the last 10 revisions for
 * one-tap rollback. Returns the newly published config, or null when the
 * merchant has no draft yet.
 */
export async function publishDraftConfig(
  storeId: string
): Promise<StoreConfig | null> {
  const draft = await getDraftConfig(storeId);
  if (!draft) return null;

  const now = new Date();

  // Published row: insert or update.
  const existing = await db
    .select({ id: storeConfigs.id })
    .from(storeConfigs)
    .where(and(eq(storeConfigs.storeId, storeId), eq(storeConfigs.scope, "published")))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(storeConfigs)
      .set({ config: draft, publishedAt: now, updatedAt: now })
      .where(eq(storeConfigs.id, existing[0].id));
  } else {
    await db.insert(storeConfigs).values({
      storeId,
      scope: "published",
      templateId: STOREFRONT_TEMPLATE_ID,
      config: draft,
      publishedAt: now,
    });
  }

  // Revision history (trim to the last 10).
  const latest = await db
    .select({ version: storeConfigRevisions.version })
    .from(storeConfigRevisions)
    .where(eq(storeConfigRevisions.storeId, storeId))
    .orderBy(desc(storeConfigRevisions.version))
    .limit(1);
  const nextVersion = (latest[0]?.version ?? 0) + 1;

  await db.insert(storeConfigRevisions).values({
    storeId,
    templateId: STOREFRONT_TEMPLATE_ID,
    config: draft,
    version: nextVersion,
  });

  await db
    .delete(storeConfigRevisions)
    .where(
      and(
        eq(storeConfigRevisions.storeId, storeId),
        lt(storeConfigRevisions.version, nextVersion - 9)
      )
    );

  return draft;
}

/* ----------------------------- preview tokens ----------------------------- */

export async function createPreviewToken(storeId: string): Promise<string> {
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(
    Date.now() + PREVIEW_TOKEN_TTL_HOURS * 60 * 60 * 1000
  );
  await db.insert(storePreviewTokens).values({ storeId, token, expiresAt });

  // Opportunistic cleanup of this store's expired tokens.
  await db
    .delete(storePreviewTokens)
    .where(
      and(
        eq(storePreviewTokens.storeId, storeId),
        lt(storePreviewTokens.expiresAt, new Date())
      )
    );

  return token;
}

export async function getStoreIdByPreviewToken(
  token: string
): Promise<string | null> {
  if (!token || token.length > 64) return null;
  const rows = await db
    .select({ storeId: storePreviewTokens.storeId, expiresAt: storePreviewTokens.expiresAt })
    .from(storePreviewTokens)
    .where(eq(storePreviewTokens.token, token))
    .limit(1);
  if (rows.length === 0) return null;
  if (rows[0].expiresAt.getTime() < Date.now()) return null;
  return rows[0].storeId;
}