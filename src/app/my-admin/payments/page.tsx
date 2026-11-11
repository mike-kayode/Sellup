"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Payment {
  id: string;
  amount: string;
  currency: string | null;
  gateway: string;
  reference: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  storeName: string;
  userName: string;
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [gateway, setGateway] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadPayments = useCallback(async (signal?: AbortSignal) => {
    try {
      const {
        data: { session },
      } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const params = new URLSearchParams({
        search,
        status,
        gateway,
        sort,
        page: String(page),
        limit: "20",
      });
      const response = await fetch(`/api/admin/payments?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to load payments");
      if (signal?.aborted) return;
      setPayments(result.payments || []);
      setTotal(result.total || 0);
      setPages(result.pages || 0);
      setError("");
    } catch (loadError) {
      if (!signal?.aborted) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load payments");
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [gateway, page, search, sort, status]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadPayments(controller.signal));
    return () => controller.abort();
  }, [loadPayments, retryKey]);

  function updateFilter(update: () => void) {
    setLoading(true);
    setPage(1);
    update();
  }

  async function runAction(payment: Payment, action: "refund" | "reconcile") {
    if (busyId) return;
    let body: Record<string, string> | undefined;
    if (action === "refund") {
      if (
        !window.confirm(
          `Request a full refund of ${payment.currency || "NGN"} ${payment.amount} for ${payment.reference}?`
        )
      ) return;
      const reason = window.prompt("Reason for this refund:");
      if (!reason?.trim()) return;
      const confirmation = window.prompt('Type REFUND to confirm the full refund request:');
      if (confirmation !== "REFUND") return;
      body = { reason, confirmation };
    } else if (!window.confirm(`Verify ${payment.reference} with ${payment.gateway}?`)) {
      return;
    }

    setBusyId(payment.id);
    setError("");
    setActionMessage("");
    try {
      const {
        data: { session },
      } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch(
        `/api/admin/payments/${payment.id}/${action}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result.error || `${action === "refund" ? "Refund" : "Reconciliation"} failed`
        );
      }
      setActionMessage(
        action === "refund"
          ? result.status === "refunded"
            ? "Refund completed."
            : "Refund request accepted and is pending provider completion."
          : `Payment reconciled to ${result.status}.`
      );
      setLoading(true);
      setRetryKey((key) => key + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Payment action failed");
    } finally {
      setBusyId(null);
    }
  }

  async function exportCsv() {
    setExporting(true);
    setError("");
    try {
      const {
        data: { session },
      } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const params = new URLSearchParams({
        search,
        status,
        gateway,
        sort,
        format: "csv",
      });
      const response = await fetch(`/api/admin/payments?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Payment export failed");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "sellup-payments.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Payment export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
          <p className="mt-2 text-gray-600">Monitor and reconcile gateway transactions</p>
        </div>
        <button type="button" disabled={exporting} onClick={() => void exportCsv()} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm disabled:opacity-50">
          <Download size={16} aria-hidden="true" />
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </header>

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
        <label className="relative">
          <span className="sr-only">Search payment references or account</span>
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" aria-hidden="true" />
          <input type="search" value={search} onChange={(event) => updateFilter(() => setSearch(event.target.value))} placeholder="Reference, store, email" className="w-full rounded-lg border px-3 py-2 pl-10" />
        </label>
        <label>
          <span className="sr-only">Payment status</span>
          <select value={status} onChange={(event) => updateFilter(() => setStatus(event.target.value))} className="w-full rounded-lg border px-3 py-2">
            {["all", "pending", "success", "failed", "refund_pending", "refunded"].map((item) => <option key={item} value={item}>{item === "all" ? "All statuses" : item.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Payment gateway</span>
          <select value={gateway} onChange={(event) => updateFilter(() => setGateway(event.target.value))} className="w-full rounded-lg border px-3 py-2">
            <option value="all">All gateways</option>
            <option value="paystack">Paystack</option>
            <option value="flutterwave">Flutterwave</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Payment sorting</span>
          <select value={sort} onChange={(event) => updateFilter(() => setSort(event.target.value))} className="w-full rounded-lg border px-3 py-2">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amount">Highest amount</option>
          </select>
        </label>
      </section>

      {actionMessage && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">{actionMessage}</div>}
      {error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">
          <p>{error}</p>
          <button type="button" onClick={() => { setLoading(true); setRetryKey((key) => key + 1); }} className="mt-3 rounded border border-red-300 px-3 py-1.5">Retry</button>
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-3 text-sm text-gray-600" aria-live="polite">
            {loading ? "Loading payments…" : `${total} payment${total === 1 ? "" : "s"}`}
          </div>
          {loading ? (
            <div className="space-y-3 p-5" aria-label="Loading payments">{[0, 1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded bg-slate-100" />)}</div>
          ) : payments.length === 0 ? (
            <div className="p-12 text-center text-gray-600"><CreditCard className="mx-auto mb-2 h-8 w-8 text-gray-400" />No payments match these filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead className="bg-gray-50 text-left text-sm text-gray-700">
                  <tr>
                    <th className="px-4 py-3 font-medium">Reference</th><th className="px-4 py-3 font-medium">Merchant</th><th className="px-4 py-3 font-medium">Account</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-4 py-3 font-medium">Gateway</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 font-mono text-sm">{payment.reference}</td>
                      <td className="px-4 py-4">{payment.storeName}</td>
                      <td className="px-4 py-4">{payment.userName}</td>
                      <td className="px-4 py-4 font-medium">{payment.currency || "NGN"} {payment.amount}</td>
                      <td className="px-4 py-4 capitalize">{payment.gateway}</td>
                      <td className="px-4 py-4 capitalize">{payment.status.replaceAll("_", " ")}</td>
                      <td className="px-4 py-4 text-sm">{new Date(payment.paidAt || payment.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          {(payment.status === "pending" || payment.status === "failed") && (payment.gateway === "paystack" || payment.gateway === "flutterwave") && (
                            <button type="button" title="Reconcile with gateway" aria-label={`Reconcile ${payment.reference}`} disabled={busyId === payment.id} onClick={() => void runAction(payment, "reconcile")} className="rounded border p-2 text-blue-700 disabled:opacity-50"><RefreshCw size={16} /></button>
                          )}
                          {(payment.status === "success" || payment.status === "paid") && (payment.gateway === "paystack" || payment.gateway === "flutterwave") && (
                            <button type="button" title="Request full refund" aria-label={`Refund ${payment.reference}`} disabled={busyId === payment.id} onClick={() => void runAction(payment, "refund")} className="rounded border p-2 text-amber-700 disabled:opacity-50"><RotateCcw size={16} /></button>
                          )}
                          {busyId === payment.id && <span className="self-center text-xs text-gray-500">Working…</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
            <span className="text-sm text-gray-600">Page {pages ? page : 0} of {pages}</span>
            <div className="flex gap-2">
              <button type="button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((value) => value - 1); }} className="rounded border p-2 disabled:opacity-40"><ChevronLeft size={18} /></button>
              <button type="button" aria-label="Next page" disabled={page >= pages || loading} onClick={() => { setLoading(true); setPage((value) => value + 1); }} className="rounded border p-2 disabled:opacity-40"><ChevronRight size={18} /></button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
