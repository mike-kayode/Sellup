"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Subscription {
  id: string;
  plan: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  gateway: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
  storeName: string;
  storeSlug: string;
}

interface PlanOption {
  slug: string;
  name: string;
}

interface Draft {
  plan: string;
  status: string;
  cancelAtPeriodEnd: boolean;
}

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busyId, setBusyId] = useState("");
  const [runningDunning, setRunningDunning] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const { data: { session } } = await getSupabaseClient().auth.getSession();
        if (!session?.access_token) throw new Error("Not authenticated");
        const params = new URLSearchParams({
          search,
          status,
          plan,
          page: String(page),
          limit: "20",
        });
        const response = await fetch(`/api/admin/subscriptions?${params}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load subscriptions");
        setSubscriptions(data.subscriptions || []);
        setPlans(data.availablePlans || []);
        setTotal(data.total || 0);
        setDrafts(Object.fromEntries((data.subscriptions || []).map((sub: Subscription) => [
          sub.id,
          { plan: sub.plan, status: sub.status, cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd) },
        ])));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load subscriptions");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [page, plan, retryKey, search, status]);

  function setDraft(id: string, value: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...value } }));
  }

  async function saveSubscription(subscription: Subscription) {
    if (busyId) return;
    const draft = drafts[subscription.id];
    if (!draft) return;
    const changed = draft.plan !== subscription.plan ||
      draft.status !== subscription.status ||
      draft.cancelAtPeriodEnd !== subscription.cancelAtPeriodEnd;
    if (!changed) return;
    if (!window.confirm(`Apply subscription changes for ${subscription.storeName}?`)) return;
    const reason = window.prompt("Enter the reason for this subscription change");
    if (!reason?.trim()) return;

    setBusyId(subscription.id);
    setError("");
    setNotice("");
    try {
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch("/api/admin/subscriptions", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: subscription.id,
          plan: draft.plan,
          status: draft.status,
          cancelAtPeriodEnd: draft.cancelAtPeriodEnd,
          reason: reason.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update subscription");
      setNotice("Subscription updated.");
      setRetryKey((key) => key + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update subscription");
    } finally {
      setBusyId("");
    }
  }

  async function runDunning() {
    if (runningDunning || !window.confirm("Process up to 25 expired subscriptions and send any due hosted renewal payment links?")) return;
    setRunningDunning(true);
    setError("");
    setNotice("");
    try {
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch("/api/admin/subscriptions/dunning", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Dunning batch failed");
      setNotice(
        `Marked ${data.processed} subscriptions past due. Created ${data.retries?.paymentLinksCreated ?? 0} renewal links; sent ${data.retries?.emailsSent ?? 0} emails.`
      );
      setRetryKey((key) => key + 1);
    } catch (dunningError) {
      setError(dunningError instanceof Error ? dunningError.message : "Dunning batch failed");
    } finally {
      setRunningDunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Subscriptions</h1>
          <p className="mt-2 max-w-2xl text-gray-600">
            Search, review, and manage store subscriptions. Past-due renewals use hosted Paystack or Flutterwave checkout links with reminders immediately, then after 1, 3, and 7 days; no saved card is charged automatically.
          </p>
        </div>
        <button type="button" disabled={runningDunning} onClick={() => void runDunning()} className="rounded-lg border px-4 py-2 disabled:opacity-50">
          {runningDunning ? "Processing…" : "Run dunning batch"}
        </button>
      </header>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error} <button type="button" className="ml-2 underline" onClick={() => setRetryKey((key) => key + 1)}>Retry</button></div>}
      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">{notice}</div>}
      <div className="grid gap-3 sm:grid-cols-3">
        <input aria-label="Search merchant subscriptions" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search merchant" className="rounded-lg border px-3 py-2" />
        <select aria-label="Filter subscription status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-lg border px-3 py-2">
          <option value="all">All statuses</option>
          {["active", "trialing", "past_due", "cancelled", "incomplete"].map((value) => <option key={value} value={value}>{value.replace("_", " ")}</option>)}
        </select>
        <select aria-label="Filter subscription plan" value={plan} onChange={(event) => { setPlan(event.target.value); setPage(1); }} className="rounded-lg border px-3 py-2">
          <option value="all">All plans</option>
          {plans.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
        </select>
      </div>
      {loading ? <div className="h-64 animate-pulse rounded-xl bg-gray-100" /> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[1100px]">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm">Store</th>
                <th className="px-4 py-3 text-left text-sm">Plan</th>
                <th className="px-4 py-3 text-left text-sm">Status</th>
                <th className="px-4 py-3 text-left text-sm">Gateway</th>
                <th className="px-4 py-3 text-left text-sm">Period end</th>
                <th className="px-4 py-3 text-left text-sm">Created</th>
                <th className="px-4 py-3 text-left text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {subscriptions.map((sub) => {
                const draft = drafts[sub.id] || { plan: sub.plan, status: sub.status, cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd) };
                return (
                  <tr key={sub.id}>
                    <td className="px-4 py-4"><p className="font-medium">{sub.storeName}</p><p className="text-sm text-gray-500">/{sub.storeSlug}</p></td>
                    <td className="px-4 py-4"><select aria-label={`Plan for ${sub.storeName}`} value={draft.plan} onChange={(event) => setDraft(sub.id, { plan: event.target.value })} className="rounded border px-2 py-1">{plans.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></td>
                    <td className="px-4 py-4"><select aria-label={`Status for ${sub.storeName}`} value={draft.status} onChange={(event) => setDraft(sub.id, { status: event.target.value })} className="rounded border px-2 py-1">{["active", "trialing", "past_due", "cancelled", "incomplete"].map((value) => <option key={value} value={value}>{value.replace("_", " ")}</option>)}</select></td>
                    <td className="px-4 py-4 capitalize">{sub.gateway || "—"}</td>
                    <td className="px-4 py-4 text-sm">{sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-4 text-sm">{new Date(sub.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-4">
                      <label className="mb-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={draft.cancelAtPeriodEnd} onChange={(event) => setDraft(sub.id, { cancelAtPeriodEnd: event.target.checked })} />Cancel at period end</label>
                      <button type="button" disabled={Boolean(busyId)} onClick={() => void saveSubscription(sub)} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50">{busyId === sub.id ? "Saving…" : "Save"}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {subscriptions.length === 0 && <div className="p-12 text-center text-gray-600"><CreditCard className="mx-auto mb-3" />No subscriptions found.</div>}
        </div>
      )}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{total} subscriptions · page {page} of {Math.max(1, Math.ceil(total / 20))}</span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded border px-3 py-2 disabled:opacity-50">Previous</button>
          <button type="button" disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)} className="rounded border px-3 py-2 disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>
  );
}
