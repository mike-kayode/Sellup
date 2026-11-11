"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, Eye, Search } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Order {
  id: string;
  orderNumber: string;
  storeName: string;
  storeSlug: string;
  customerName: string;
  customerPhone: string;
  total: string;
  status: string | null;
  paymentStatus: string | null;
  createdAt: string;
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [exporting, setExporting] = useState(false);

  const loadOrders = useCallback(async (signal?: AbortSignal) => {
    try {
      const {
        data: { session },
      } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const params = new URLSearchParams({
        search,
        status,
        paymentStatus,
        sort,
        page: String(page),
        limit: "20",
      });
      const response = await fetch(`/api/admin/orders?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to load orders");
      if (signal?.aborted) return;
      setOrders(result.orders || []);
      setTotal(result.total || 0);
      setPages(result.pages || 0);
      setError("");
    } catch (loadError) {
      if (!signal?.aborted) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load orders");
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, paymentStatus, search, sort, status]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadOrders(controller.signal));
    return () => controller.abort();
  }, [loadOrders, retryKey]);

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
        paymentStatus,
        sort,
        format: "csv",
      });
      const response = await fetch(`/api/admin/orders?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Export failed");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "sellup-orders.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  function updateFilter(update: () => void) {
    setLoading(true);
    setPage(1);
    update();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Platform Orders</h1>
          <p className="mt-2 text-gray-600">Monitor orders across all merchants</p>
        </div>
        <button
          type="button"
          disabled={exporting}
          onClick={() => void exportCsv()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          <Download size={16} aria-hidden="true" />
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </header>

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
        <label className="relative">
          <span className="sr-only">Search orders, buyers, or merchants</span>
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            placeholder="Order, buyer, merchant"
            onChange={(event) => updateFilter(() => setSearch(event.target.value))}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3"
          />
        </label>
        <label>
          <span className="sr-only">Order status</span>
          <select
            value={status}
            onChange={(event) => updateFilter(() => setStatus(event.target.value))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            {["all", "pending", "confirmed", "processing", "preparing", "ready", "completed", "cancelled"].map((item) => (
              <option key={item} value={item}>{item === "all" ? "All order statuses" : item}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Payment status</span>
          <select
            value={paymentStatus}
            onChange={(event) => updateFilter(() => setPaymentStatus(event.target.value))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            {["all", "pending", "paid", "failed", "refunded"].map((item) => (
              <option key={item} value={item}>{item === "all" ? "All payment statuses" : item}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Order sorting</span>
          <select
            value={sort}
            onChange={(event) => updateFilter(() => setSort(event.target.value))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amount">Highest amount</option>
          </select>
        </label>
      </section>

      {error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">
          <p>{error}</p>
          <button type="button" onClick={() => { setLoading(true); setRetryKey((key) => key + 1); }} className="mt-3 rounded border border-red-300 px-3 py-1.5">Retry</button>
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-3 text-sm text-gray-600" aria-live="polite">
            {loading ? "Loading orders…" : `${total} order${total === 1 ? "" : "s"}`}
          </div>
          {loading ? (
            <div className="space-y-3 p-5" aria-label="Loading orders">
              {[0, 1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded bg-slate-100" />)}
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center text-gray-600">No orders match these filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-50 text-left text-sm text-gray-700">
                  <tr>
                    <th className="px-5 py-3 font-medium">Order</th>
                    <th className="px-5 py-3 font-medium">Merchant</th>
                    <th className="px-5 py-3 font-medium">Buyer</th>
                    <th className="px-5 py-3 font-medium">Total</th>
                    <th className="px-5 py-3 font-medium">Order status</th>
                    <th className="px-5 py-3 font-medium">Payment</th>
                    <th className="px-5 py-3 font-medium">Created</th>
                    <th className="px-5 py-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 font-mono text-sm">#{order.orderNumber}</td>
                      <td className="px-5 py-4">{order.storeName}<p className="text-xs text-gray-500">/{order.storeSlug}</p></td>
                      <td className="px-5 py-4">{order.customerName}<p className="text-xs text-gray-500">{order.customerPhone}</p></td>
                      <td className="px-5 py-4 font-medium">{order.total}</td>
                      <td className="px-5 py-4 capitalize">{order.status || "—"}</td>
                      <td className="px-5 py-4 capitalize">{order.paymentStatus || "—"}</td>
                      <td className="px-5 py-4 text-sm">{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-4">
                        <button type="button" aria-label={`View order ${order.orderNumber}`} onClick={() => router.push(`/my-admin/orders/${order.id}`)} className="rounded p-2 hover:bg-gray-100">
                          <Eye size={16} aria-hidden="true" />
                        </button>
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
