"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  enabledForPlans: string[];
  enabledForStores: string[];
}

async function adminFetch(path: string, init?: RequestInit) {
  const { data: { session } } = await getSupabaseClient().auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  return fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
}

export default function AdminFeaturesPage() {
  const [features, setFeatures] = useState<FeatureFlag[]>([]);
  const [targetDrafts, setTargetDrafts] = useState<Record<string, { plans: string; stores: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [newFeature, setNewFeature] = useState({ key: "", name: "", description: "", plans: "", stores: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminFetch("/api/admin/features?limit=100");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to load feature flags");
      const rows: FeatureFlag[] = result.features || [];
      setFeatures(rows);
      setTargetDrafts(Object.fromEntries(rows.map((feature) => [feature.id, {
        plans: feature.enabledForPlans.join(", "),
        stores: feature.enabledForStores.join(", "),
      }])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load feature flags");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function createFeature(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving("create");
    setError("");
    try {
      const response = await adminFetch("/api/admin/features", {
        method: "POST",
        body: JSON.stringify({
          key: newFeature.key,
          name: newFeature.name,
          description: newFeature.description || null,
          isEnabled: false,
          enabledForPlans: newFeature.plans.split(",").map((value) => value.trim()).filter(Boolean),
          enabledForStores: newFeature.stores.split(",").map((value) => value.trim()).filter(Boolean),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to create feature flag");
      setNewFeature({ key: "", name: "", description: "", plans: "", stores: "" });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to create feature flag");
    } finally {
      setSaving(null);
    }
  }

  async function updateFeature(id: string, values: Partial<FeatureFlag>) {
    if (saving) return;
    setSaving(id);
    setError("");
    try {
      const response = await adminFetch(`/api/admin/features/${id}`, {
        method: "PUT",
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to update feature flag");
      setFeatures((current) => current.map((feature) => feature.id === id ? result.feature : feature));
      setTargetDrafts((current) => ({
        ...current,
        [id]: {
          plans: result.feature.enabledForPlans.join(", "),
          stores: result.feature.enabledForStores.join(", "),
        },
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to update feature flag");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Feature Flags</h1>
        <p className="mt-2 text-gray-600">Control global access, plan targeting, and store targeting.</p>
      </header>
      {error && <div role="alert" className="flex justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"><span>{error}</span><button type="button" onClick={() => void load()} className="underline">Retry</button></div>}

      <form onSubmit={createFeature} className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-2">
        <label className="text-sm">Key<input required value={newFeature.key} onChange={(event) => setNewFeature({ ...newFeature, key: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <label className="text-sm">Name<input required value={newFeature.name} onChange={(event) => setNewFeature({ ...newFeature, name: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <label className="text-sm">Description<input value={newFeature.description} onChange={(event) => setNewFeature({ ...newFeature, description: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <label className="text-sm">Enabled plan slugs (comma-separated)<input value={newFeature.plans} onChange={(event) => setNewFeature({ ...newFeature, plans: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <label className="text-sm">Enabled store UUIDs (comma-separated)<input value={newFeature.stores} onChange={(event) => setNewFeature({ ...newFeature, stores: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <button disabled={saving !== null} className="self-end rounded bg-[#25D366] px-4 py-2 font-medium text-white disabled:opacity-50">Create disabled flag</button>
      </form>

      <div className="overflow-hidden rounded-xl border bg-white">
        {loading ? <div className="animate-pulse p-8 text-gray-500">Loading feature flags…</div> : features.length === 0 ? (
          <div className="p-12 text-center text-gray-600">No feature flags configured yet.</div>
        ) : (
          <div className="divide-y">
            {features.map((feature) => (
              <article key={feature.id} className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><h2 className="font-semibold">{feature.name}</h2><p className="font-mono text-sm text-gray-600">{feature.key}</p>{feature.description && <p className="mt-1 text-sm text-gray-600">{feature.description}</p>}</div>
                  <button type="button" role="switch" aria-checked={feature.isEnabled} aria-label={`${feature.isEnabled ? "Disable" : "Enable"} ${feature.name}`} disabled={saving !== null} onClick={() => void updateFeature(feature.id, { isEnabled: !feature.isEnabled })} className={`rounded px-4 py-2 font-medium text-white disabled:opacity-50 ${feature.isEnabled ? "bg-green-700" : "bg-gray-600"}`}>
                    {feature.isEnabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <label className="text-sm">Plans (comma-separated)
                    <input value={targetDrafts[feature.id]?.plans || ""} onChange={(event) => setTargetDrafts((current) => ({ ...current, [feature.id]: { ...current[feature.id], plans: event.target.value } }))} className="mt-1 w-full rounded border px-3 py-2" />
                  </label>
                  <label className="text-sm">Store UUIDs (comma-separated)
                    <input value={targetDrafts[feature.id]?.stores || ""} onChange={(event) => setTargetDrafts((current) => ({ ...current, [feature.id]: { ...current[feature.id], stores: event.target.value } }))} className="mt-1 w-full rounded border px-3 py-2" />
                  </label>
                  <button type="button" disabled={saving !== null} onClick={() => void updateFeature(feature.id, {
                    enabledForPlans: (targetDrafts[feature.id]?.plans || "").split(",").map((value) => value.trim()).filter(Boolean),
                    enabledForStores: (targetDrafts[feature.id]?.stores || "").split(",").map((value) => value.trim()).filter(Boolean),
                  })} className="self-end rounded border px-4 py-2 disabled:opacity-50">Save targeting</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
