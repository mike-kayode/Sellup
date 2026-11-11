"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Key } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
  isActive: boolean;
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

export default function AdminApiPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [createdSecret, setCreatedSecret] = useState("");
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminFetch(`/api/admin/api?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to load API keys");
      setKeys(result.keys || []);
      setTotal(result.total || 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function createKey(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await adminFetch("/api/admin/api", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to create API key");
      setCreatedSecret(result.key.secret);
      setName("");
      setPage(1);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to create API key");
    } finally {
      setSubmitting(false);
    }
  }

  async function revokeKey(key: ApiKey) {
    if (!key.isActive || submitting || !window.confirm(`Revoke API key "${key.name}"? This cannot be undone.`)) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await adminFetch("/api/admin/api", {
        method: "PATCH",
        body: JSON.stringify({ action: "revoke", id: key.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to revoke API key");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to revoke API key");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">API Management</h1>
        <p className="mt-2 text-gray-600">Create and revoke platform API keys. Secrets are shown only once.</p>
      </header>

      {error && (
        <div role="alert" className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="underline">Retry</button>
        </div>
      )}
      {createdSecret && (
        <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="font-semibold text-amber-950">Copy this API key now. It cannot be retrieved again.</p>
          <code className="mt-2 block break-all rounded bg-white p-3">{createdSecret}</code>
          <button type="button" onClick={() => setCreatedSecret("")} className="mt-2 text-sm underline">I have saved it</button>
        </div>
      )}

      <form onSubmit={createKey} className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
        <label className="min-w-60 flex-1 text-sm font-medium text-gray-700">
          Key name
          <input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <button disabled={submitting} className="rounded bg-[#25D366] px-4 py-2 font-medium text-white disabled:opacity-50">
          Generate key
        </button>
      </form>

      <div className="flex items-center gap-3">
        <label htmlFor="api-key-search" className="sr-only">Search API keys</label>
        <input id="api-key-search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search by name" className="rounded border bg-white px-3 py-2" />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="animate-pulse p-8 text-gray-500">Loading API keys…</div>
        ) : keys.length === 0 ? (
          <div className="p-12 text-center text-gray-600">
            <Key className="mx-auto mb-4 h-10 w-10 text-gray-400" />
            No API keys found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-700"><tr>
                <th className="px-5 py-3">Name</th><th className="px-5 py-3">Prefix</th><th className="px-5 py-3">Last used</th><th className="px-5 py-3">Expires</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Action</th>
              </tr></thead>
              <tbody className="divide-y">
                {keys.map((key) => (
                  <tr key={key.id}>
                    <td className="px-5 py-3 font-medium">{key.name}</td>
                    <td className="px-5 py-3 font-mono">{key.prefix}…</td>
                    <td className="px-5 py-3">{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never"}</td>
                    <td className="px-5 py-3">{key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : "Never"}</td>
                    <td className="px-5 py-3">{key.isActive ? "Active" : "Revoked"}</td>
                    <td className="px-5 py-3">
                      {key.isActive && <button type="button" disabled={submitting} onClick={() => void revokeKey(key)} className="text-red-700 underline disabled:opacity-50">Revoke</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t p-3 text-sm">
          <span>{total} key(s)</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded border px-3 py-1 disabled:opacity-50">Previous</button>
            <button type="button" disabled={page * limit >= total || loading} onClick={() => setPage((value) => value + 1)} className="rounded border px-3 py-1 disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
