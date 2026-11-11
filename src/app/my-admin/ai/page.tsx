"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Provider {
  id: string;
  name: string;
  endpoint: string | null;
  isActive: boolean;
  isDefault: boolean;
  hasApiKey: boolean;
}

interface Quota {
  id: string | null;
  storeId: string;
  storeName: string;
  monthlyTokenLimit: number | null;
  monthlyCostCap: string | null;
  tokensUsedThisMonth: number | null;
  costUsedThisMonth: string | null;
}

interface Usage {
  day: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: string;
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

export default function AdminAiPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [days, setDays] = useState(30);
  const [providerForm, setProviderForm] = useState({ name: "", endpoint: "", apiKey: "", isDefault: false });
  const [quotaDraft, setQuotaDraft] = useState<Record<string, { tokens: string; cost: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [providerResponse, quotaResponse, usageResponse] = await Promise.all([
        adminFetch("/api/admin/ai/providers"),
        adminFetch("/api/admin/ai/quotas?limit=100"),
        adminFetch(`/api/admin/ai/usage?days=${days}`),
      ]);
      const [providerData, quotaData, usageData] = await Promise.all([
        providerResponse.json(), quotaResponse.json(), usageResponse.json(),
      ]);
      if (!providerResponse.ok) throw new Error(providerData.error || "Failed to load providers");
      if (!quotaResponse.ok) throw new Error(quotaData.error || "Failed to load quotas");
      if (!usageResponse.ok) throw new Error(usageData.error || "Failed to load AI usage");
      setProviders(providerData.providers || []);
      const quotaRows: Quota[] = quotaData.quotas || [];
      setQuotas(quotaRows);
      setQuotaDraft(Object.fromEntries(quotaRows.map((quota) => [quota.storeId, {
        tokens: String(quota.monthlyTokenLimit ?? 1_000_000),
        cost: String(quota.monthlyCostCap ?? "10.0000"),
      }])));
      setUsage(usageData.usage || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load AI administration data");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function createProvider(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving("provider");
    setError("");
    try {
      const response = await adminFetch("/api/admin/ai/providers", {
        method: "POST",
        body: JSON.stringify({ ...providerForm, isActive: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to add AI provider");
      setProviderForm({ name: "", endpoint: "", apiKey: "", isDefault: false });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to add AI provider");
    } finally {
      setSaving(null);
    }
  }

  async function updateProvider(provider: Provider, changes: { isActive?: boolean; isDefault?: boolean }) {
    if (saving) return;
    setSaving(provider.id);
    setError("");
    try {
      const response = await adminFetch("/api/admin/ai/providers", {
        method: "PUT",
        body: JSON.stringify({
          id: provider.id,
          ...changes,
          ...(changes.isActive === false && provider.isDefault ? { isDefault: false } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to update AI provider");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to update AI provider");
    } finally {
      setSaving(null);
    }
  }

  async function testProvider(provider: Provider) {
    if (saving) return;
    setSaving(`test:${provider.id}`);
    setError("");
    setNotice("");
    try {
      const response = await adminFetch("/api/admin/ai/providers/test", {
        method: "POST",
        body: JSON.stringify({ providerId: provider.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Provider connection test failed");
      setNotice(`${result.provider} responded successfully in ${result.latencyMs} ms.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Provider connection test failed");
    } finally {
      setSaving(null);
    }
  }

  async function saveQuota(storeId: string) {
    if (saving) return;
    setSaving(storeId);
    setError("");
    try {
      const response = await adminFetch("/api/admin/ai/quotas", {
        method: "PATCH",
        body: JSON.stringify({
          storeId,
          monthlyTokenLimit: Number(quotaDraft[storeId]?.tokens),
          monthlyCostCap: quotaDraft[storeId]?.cost,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to save AI quota");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save AI quota");
    } finally {
      setSaving(null);
    }
  }

  const maxRequests = Math.max(1, ...usage.map((item) => item.requests));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">AI Providers & Usage</h1>
        <p className="mt-2 text-gray-600">Provider credentials are encrypted. Test makes a small, audited request to the configured OpenAI-compatible endpoint.</p>
      </header>
      {error && <div role="alert" className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"><span>{error}</span><button type="button" onClick={() => void load()} className="underline">Retry</button></div>}
      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">{notice}</div>}

      <form onSubmit={createProvider} className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-2">
        <h2 className="font-semibold md:col-span-2">Add provider</h2>
        <label className="text-sm">Provider name<input required value={providerForm.name} onChange={(event) => setProviderForm({ ...providerForm, name: event.target.value })} placeholder="openai" className="mt-1 w-full rounded border px-3 py-2" /></label>
        <label className="text-sm">Endpoint URL (optional)<input type="url" value={providerForm.endpoint} onChange={(event) => setProviderForm({ ...providerForm, endpoint: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <label className="text-sm">API key<input required type="password" autoComplete="new-password" value={providerForm.apiKey} onChange={(event) => setProviderForm({ ...providerForm, apiKey: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={providerForm.isDefault} onChange={(event) => setProviderForm({ ...providerForm, isDefault: event.target.checked })} />Make default provider</label>
        <button disabled={saving !== null} className="rounded bg-[#25D366] px-4 py-2 text-white disabled:opacity-50 md:col-span-2">Add and activate provider</button>
      </form>

      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="border-b px-5 py-4 font-semibold">Providers</div>
        {loading ? <div className="animate-pulse p-8 text-gray-500">Loading providers…</div> : providers.length === 0 ? <div className="p-8 text-gray-600">No AI providers configured.</div> : (
          <div className="divide-y">{providers.map((provider) => (
            <div key={provider.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div><p className="font-medium">{provider.name}{provider.isDefault && <span className="ml-2 rounded bg-green-100 px-2 py-1 text-xs text-green-800">Default</span>}</p><p className="text-sm text-gray-500">{provider.endpoint || "Provider default endpoint"} · {provider.hasApiKey ? "Key configured" : "No key"}</p></div>
              <div className="flex gap-2">
                <button type="button" disabled={saving !== null || !provider.isActive || !provider.hasApiKey} onClick={() => void testProvider(provider)} className="rounded border px-3 py-2 text-sm disabled:opacity-50">{saving === `test:${provider.id}` ? "Testing…" : "Test"}</button>
                {!provider.isDefault && provider.isActive && <button type="button" disabled={saving !== null} onClick={() => void updateProvider(provider, { isDefault: true })} className="rounded border px-3 py-2 text-sm">Make default</button>}
                <button type="button" disabled={saving !== null} onClick={() => void updateProvider(provider, { isActive: !provider.isActive })} className="rounded border px-3 py-2 text-sm disabled:opacity-50">{provider.isActive ? "Disable" : "Enable"}</button>
              </div>
            </div>
          ))}</div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold">Daily usage</h2>
          <label className="text-sm">Range <select value={days} onChange={(event) => setDays(Number(event.target.value))} className="ml-2 rounded border px-2 py-1"><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label>
        </div>
        {usage.length === 0 ? <div className="p-8 text-gray-600">No AI requests in this period.</div> : (
          <div className="space-y-3 p-5">{usage.map((item) => (
            <div key={item.day} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
              <span>{item.day}</span>
              <div className="h-3 rounded bg-gray-100"><div className="h-3 rounded bg-[#25D366]" style={{ width: `${Math.max(3, (item.requests / maxRequests) * 100)}%` }} /></div>
              <span className="text-right">{item.requests} requests · {Number(item.inputTokens) + Number(item.outputTokens)} tokens · ${Number(item.costUsd).toFixed(4)}</span>
            </div>
          ))}</div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="border-b px-5 py-4 font-semibold">Per-store quotas</div>
        {loading ? <div className="animate-pulse p-8 text-gray-500">Loading quotas…</div> : quotas.length === 0 ? <div className="p-8 text-gray-600">No stores found.</div> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="bg-gray-50"><tr><th className="px-4 py-3">Store</th><th className="px-4 py-3">Monthly token limit</th><th className="px-4 py-3">Monthly cost cap (USD)</th><th className="px-4 py-3">Used</th><th className="px-4 py-3">Action</th></tr></thead>
            <tbody className="divide-y">{quotas.map((quota) => (
              <tr key={quota.storeId}>
                <td className="px-4 py-3">{quota.storeName}</td>
                <td className="px-4 py-3"><input type="number" min="0" value={quotaDraft[quota.storeId]?.tokens || ""} onChange={(event) => setQuotaDraft((current) => ({ ...current, [quota.storeId]: { ...current[quota.storeId], tokens: event.target.value } }))} className="w-36 rounded border px-2 py-1" /></td>
                <td className="px-4 py-3"><input type="number" min="0" step="0.0001" value={quotaDraft[quota.storeId]?.cost || ""} onChange={(event) => setQuotaDraft((current) => ({ ...current, [quota.storeId]: { ...current[quota.storeId], cost: event.target.value } }))} className="w-36 rounded border px-2 py-1" /></td>
                <td className="px-4 py-3">{quota.tokensUsedThisMonth || 0} tokens · ${Number(quota.costUsedThisMonth || 0).toFixed(4)}</td>
                <td className="px-4 py-3"><button type="button" disabled={saving !== null} onClick={() => void saveQuota(quota.storeId)} className="underline disabled:opacity-50">Save</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
