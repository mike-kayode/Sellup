"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface AuditLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  previousValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: string;
  actorName: string;
  actorId: string | null;
  actorRole: string | null;
  storeId: string | null;
}

interface Filters {
  action: string;
  resourceType: string;
  actorId: string;
  from: string;
  to: string;
}

async function authenticatedFetch(path: string) {
  const { data: { session } } = await getSupabaseClient().auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  return fetch(path, { headers: { Authorization: `Bearer ${session.access_token}` } });
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filters, setFilters] = useState<Filters>({ action: "", resourceType: "", actorId: "", from: "", to: "" });
  const [applied, setApplied] = useState<Filters>(filters);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const limit = 20;

  const query = useCallback((format = "") => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    for (const [key, value] of Object.entries(applied)) {
      if (value) params.set(key, value);
    }
    if (format) params.set("format", format);
    return params.toString();
  }, [applied, page]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authenticatedFetch(`/api/admin/audit-logs?${query()}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to load audit logs");
      setLogs(result.logs || []);
      setTotal(result.total || 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function exportCsv() {
    if (exporting) return;
    setExporting(true);
    setError("");
    try {
      const response = await authenticatedFetch(`/api/admin/audit-logs?${query("csv")}`);
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to export audit logs");
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "admin-audit-logs.csv";
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to export audit logs");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1><p className="mt-2 text-gray-600">Immutable activity history for platform changes.</p></div>
        <button type="button" disabled={exporting} onClick={() => void exportCsv()} className="rounded border bg-white px-4 py-2 disabled:opacity-50">{exporting ? "Exporting…" : "Export CSV"}</button>
      </header>
      {error && <div role="alert" className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"><span>{error}</span><button type="button" onClick={() => void load()} className="underline">Retry</button></div>}

      <form onSubmit={(event) => { event.preventDefault(); setPage(1); setApplied({ ...filters }); }} className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3">
        <label className="text-sm">Action<input value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <label className="text-sm">Resource type<input value={filters.resourceType} onChange={(event) => setFilters({ ...filters, resourceType: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <label className="text-sm">Actor UUID<input value={filters.actorId} onChange={(event) => setFilters({ ...filters, actorId: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <label className="text-sm">From<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value ? `${event.target.value}T00:00:00.000Z` : "" })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <label className="text-sm">To<input type="date" value={filters.to.slice(0, 10)} onChange={(event) => setFilters({ ...filters, to: event.target.value ? `${event.target.value}T23:59:59.999Z` : "" })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <button className="self-end rounded bg-[#25D366] px-4 py-2 text-white">Apply filters</button>
      </form>

      <div className="overflow-hidden rounded-xl border bg-white">
        {loading ? <div className="animate-pulse p-8 text-gray-500">Loading audit logs…</div> : logs.length === 0 ? <div className="p-12 text-center text-gray-600">No audit logs match these filters.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50"><tr><th className="px-5 py-3">Action</th><th className="px-5 py-3">Resource</th><th className="px-5 py-3">Actor</th><th className="px-5 py-3">Store</th><th className="px-5 py-3">IP</th><th className="px-5 py-3">Date / Values</th></tr></thead>
              <tbody className="divide-y">{logs.map((log) => (
                <tr key={log.id} className="align-top">
                  <td className="px-5 py-3"><span className="flex items-center gap-2"><FileText size={15} />{log.action}</span></td>
                  <td className="px-5 py-3">{log.resourceType}<div className="font-mono text-xs text-gray-500">{log.resourceId || "—"}</div></td>
                  <td className="px-5 py-3">{log.actorName}<div className="text-xs text-gray-500">{log.actorRole || "system"}</div></td>
                  <td className="px-5 py-3 font-mono text-xs">{log.storeId || "—"}</td>
                  <td className="px-5 py-3 font-mono">{log.ipAddress || "—"}</td>
                  <td className="px-5 py-3">{new Date(log.createdAt).toLocaleString()}
                    {Boolean(log.previousValue || log.newValue) && <details className="mt-1"><summary className="cursor-pointer text-blue-700">Before / after</summary><pre className="mt-2 max-h-48 max-w-xl overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs">{JSON.stringify({ before: log.previousValue, after: log.newValue }, null, 2)}</pre></details>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t p-3 text-sm">
          <span>{total} record(s) · page {page}</span>
          <div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded border px-3 py-1 disabled:opacity-50">Previous</button><button type="button" disabled={page * limit >= total || loading} onClick={() => setPage((value) => value + 1)} className="rounded border px-3 py-1 disabled:opacity-50">Next</button></div>
        </div>
      </div>
    </div>
  );
}
