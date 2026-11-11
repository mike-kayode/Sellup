import { eq } from "drizzle-orm";
import { db } from "@/db";
import { featureFlags } from "@/db/schema";

export interface FeatureStoreContext {
  storeId: string;
  plan: string;
}

interface CachedFlag {
  isEnabled: boolean;
  enabledForPlans: string[];
  enabledForStores: string[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CachedFlag>();

export async function isFeatureEnabled(
  key: string,
  store: FeatureStoreContext | null = null,
  defaultValue = false,
): Promise<boolean> {
  try {
    let flag = cache.get(key);
    if (!flag || Date.now() - flag.fetchedAt >= CACHE_TTL_MS) {
      const [row] = await db.select({
        isEnabled: featureFlags.isEnabled,
        enabledForPlans: featureFlags.enabledForPlans,
        enabledForStores: featureFlags.enabledForStores,
      }).from(featureFlags).where(eq(featureFlags.key, key)).limit(1);
      if (!row) return defaultValue;

      flag = {
        isEnabled: row.isEnabled === true,
        enabledForPlans: Array.isArray(row.enabledForPlans)
          ? row.enabledForPlans.filter((value): value is string => typeof value === "string")
          : [],
        enabledForStores: Array.isArray(row.enabledForStores)
          ? row.enabledForStores.filter((value): value is string => typeof value === "string")
          : [],
        fetchedAt: Date.now(),
      };
      cache.set(key, flag);
    }

    if (!flag.isEnabled) return false;
    const hasPlanTargets = flag.enabledForPlans.length > 0;
    const hasStoreTargets = flag.enabledForStores.length > 0;
    if (!hasPlanTargets && !hasStoreTargets) return true;
    if (!store) return false;
    return (
      (hasPlanTargets && flag.enabledForPlans.includes(store.plan)) ||
      (hasStoreTargets && flag.enabledForStores.includes(store.storeId))
    );
  } catch (error) {
    console.error("Feature flag lookup failed; denying feature:", error);
    return false;
  }
}

export function clearFeatureFlagCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}
