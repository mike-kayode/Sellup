"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface AdminWebhook {
  id: string;
  url: string;
  events: string[];
  status: string;
  storeId: string | null;
  lastDelivery: string | null;
  retryCount: number | null;
  failureCount: number | null;
  createdAt: string;
}

interface Delivery {
  id: string;
  webhookId: string;
  event: string;
  url: string;
  status: string;
  attempt: number;
  maxAttempts: number;
  lastHttpCode: number | null;
  lastError: string | null;
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

export default function AdminWebhooksPage() {
  const [webhooks, setWebhooks] = useState<AdminWebhook[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState("order.created");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [deliveryTotal, setDeliveryTotal] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [createdSecret, setCreatedSecret] = useState("");
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminFetch(`/api/admin/webhooks?page=${page}&limit=${limit}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to load webhooks");
      setWebhooks(result.webhooks || []);
      setDeliveries(result.deliveries || []);
      setTotal(result.total || 0);
      setDeliveryTotal(result.deliveryTotal || 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load webhooks");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function createWebhook(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const parsedEvents = events.split(",").map((item) => item.trim()).filter(Boolean);
      const response = await adminFetch("/api/admin/webhooks", {
        method: "POST",
        body: JSON.stringify({ url, events: parsedEvents }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to add webhook");
      setCreatedSecret(result.webhook.secret);
      setUrl("");
      setPage(1);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to add webhook");
    } finally {
      setSubmitting(false);
    }
  }

  async function action(payload: { action: "disable"; id: string } | { action: "redeliver"; deliveryId: string }) {
    if (submitting) return;
    if (payload.action === "disable" && !window.confirm("Disable this webhook endpoint?")) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await adminFetch("/api/admin/webhooks", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Webhook action failed");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Webhook action failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Webhooks</h1>
        <p className="mt-2 text-gray-600">Manage platform endpoints and review delivery attempts.</p>
      </header>

      {error && (
        <div role="alert" className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <span>{error}</span><button type="button" onClick={() => void load()} className="underline">Retry</button>
        </div>
      )}
      {createdSecret && (
        <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="font-semibold">Save this webhook signing secret now; it will not be shown again.</p>
          <code className="mt-2 block break-all rounded bg-white p-3">{createdSecret}</code>
          <button type="button" onClick={() => setCreatedSecret("")} className="mt-2 text-sm underline">I have saved it</button>
        </div>
      )}
      <form onSubmit={createWebhook} className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-[2fr_2fr_auto]">
        <label className="text-sm font-medium text-gray-700">
          HTTPS endpoint URL
          <input required type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/webhooks" className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <label className="text-sm font-medium text-gray-700">
          Events (comma-separated)
          <input required value={events} onChange={(event) => setEvents(event.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <button disabled={submitting} className="self-end rounded bg-[#25D366] px-4 py-2 font-medium text-white disabled:opacity-50">Add endpoint</button>
      </form>

      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Endpoints <span className="text-sm font-normal text-gray-500">({total})</span></h2>
        </div>
        {loading ? <div className="animate-pulse p-8 text-gray-500">Loading endpoints…</div> : webhooks.length === 0 ? (
          <div className="p-10 text-center text-gray-600">No webhook endpoints configured.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50"><tr><th className="px-5 py-3">URL</th><th className="px-5 py-3">Events</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Last delivery</th><th className="px-5 py-3">Failures</th><th className="px-5 py-3">Action</th></tr></thead>
              <tbody className="divide-y">
                {webhooks.map((webhook) => (
                  <tr key={webhook.id}>
                    <td className="max-w-sm truncate px-5 py-3 font-mono">{webhook.url}</td>
                    <td className="px-5 py-3">{webhook.events.join(", ")}</td>
                    <td className="px-5 py-3">{webhook.status}</td>
                    <td className="px-5 py-3">{webhook.lastDelivery ? new Date(webhook.lastDelivery).toLocaleString() : "—"}</td>
                    <td className="px-5 py-3">{webhook.failureCount ?? 0}</td>
                    <td className="px-5 py-3">{webhook.status === "active" && <button type="button" disabled={submitting} onClick={() => void action({ action: "disable", id: webhook.id })} className="text-red-700 underline">Disable</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t p-3 text-sm">
          <span>Page {page} · {total} endpoint(s)</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded border px-3 py-1 disabled:opacity-50">Previous</button>
            <button type="button" disabled={page * limit >= total || loading} onClick={() => setPage((value) => value + 1)} className="rounded border px-3 py-1 disabled:opacity-50">Next</button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Recent deliveries <span className="text-sm font-normal text-gray-500">({deliveryTotal})</span></h2>
        </div>
        {loading ? <div className="animate-pulse p-8 text-gray-500">Loading deliveries…</div> : deliveries.length === 0 ? (
          <div className="p-10 text-center text-gray-600">No delivery attempts recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50"><tr><th className="px-5 py-3">Event</th><th className="px-5 py-3">Endpoint</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Attempt / HTTP</th><th className="px-5 py-3">Error</th><th className="px-5 py-3">Action</th></tr></thead>
              <tbody className="divide-y">
                {deliveries.map((delivery) => (
                  <tr key={delivery.id}>
                    <td className="px-5 py-3">{delivery.event}</td>
                    <td className="max-w-xs truncate px-5 py-3 font-mono">{delivery.url}</td>
                    <td className="px-5 py-3">{delivery.status}</td>
                    <td className="px-5 py-3">{delivery.attempt}/{delivery.maxAttempts} · {delivery.lastHttpCode ?? "—"}</td>
                    <td className="max-w-sm truncate px-5 py-3 text-red-700">{delivery.lastError || "—"}</td>
                    <td className="px-5 py-3">{delivery.status === "failed" && <button type="button" disabled={submitting} onClick={() => void action({ action: "redeliver", deliveryId: delivery.id })} className="text-blue-700 underline">Redeliver</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
