"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Integration {
  id: string;
  name: string;
  type: string;
  status: string;
  description: string;
  hasSecret: boolean;
  isEnabled: boolean;
  createdAt: string;
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

export default function AdminIntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", type: "", description: "", secret: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminFetch("/api/admin/integrations?limit=100");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to load integrations");
      setIntegrations(result.integrations || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function createIntegration(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await adminFetch("/api/admin/integrations", {
        method: "POST",
        body: JSON.stringify({ ...form, secret: form.secret || undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to create integration");
      setForm({ name: "", type: "", description: "", secret: "" });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to create integration");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleIntegration(integration: Integration) {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await adminFetch("/api/admin/integrations", {
        method: "PATCH",
        body: JSON.stringify({ id: integration.id, isEnabled: !integration.isEnabled }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to update integration");
      setIntegrations((current) => current.map((item) => item.id === integration.id ? {
        ...item,
        ...result.integration,
      } : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to update integration");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
        <p className="mt-2 text-gray-600">Platform credentials are encrypted before storage. Enablement does not test external connectivity.</p>
      </header>
      {error && <div role="alert" className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"><span>{error}</span><button type="button" onClick={() => void load()} className="underline">Retry</button></div>}

      <form onSubmit={createIntegration} className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-2">
        <label className="text-sm">Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <label className="text-sm">Type<input required value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} placeholder="payments, email, storage…" className="mt-1 w-full rounded border px-3 py-2" /></label>
        <label className="text-sm">Description<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <label className="text-sm">Credential (optional; encrypted)<input type="password" autoComplete="new-password" value={form.secret} onChange={(event) => setForm({ ...form, secret: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <button disabled={submitting} className="rounded bg-[#25D366] px-4 py-2 text-white disabled:opacity-50 md:col-span-2">Add integration (starts disabled)</button>
      </form>

      <div className="overflow-hidden rounded-xl border bg-white">
        {loading ? <div className="animate-pulse p-8 text-gray-500">Loading integrations…</div> : integrations.length === 0 ? (
          <div className="p-12 text-center text-gray-600">No integrations configured.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50"><tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Credential</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Created</th><th className="px-5 py-3">Action</th></tr></thead>
              <tbody className="divide-y">
                {integrations.map((integration) => (
                  <tr key={integration.id}>
                    <td className="px-5 py-3 font-medium">{integration.name}<div className="text-xs text-gray-500">{integration.description}</div></td>
                    <td className="px-5 py-3">{integration.type}</td>
                    <td className="px-5 py-3">{integration.hasSecret ? "Configured" : "Not configured"}</td>
                    <td className="px-5 py-3">{integration.isEnabled ? "Enabled" : "Disabled"}</td>
                    <td className="px-5 py-3">{new Date(integration.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3"><button type="button" disabled={submitting} onClick={() => void toggleIntegration(integration)} className="underline disabled:opacity-50">{integration.isEnabled ? "Disable" : "Enable"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
