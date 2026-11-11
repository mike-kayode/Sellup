"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Promotion {
  id: string;
  code: string;
  description: string | null;
  discountType: "percentage" | "fixed";
  discountValue: string;
  maxUsage: number | null;
  currentUsage: number | null;
  perCustomerLimit: number | null;
  minOrderAmount: string | null;
  maxDiscount: string | null;
  targetPlan: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
}

interface Redemption {
  id: string;
  code: string;
  storeName: string | null;
  discountAmount: string;
  status: string;
  reservedAt: string;
  redeemedAt: string | null;
}

interface PromotionForm {
  id?: string;
  code: string;
  description: string;
  discountType: "percentage" | "fixed";
  discountValue: string;
  maxUsage: string;
  perCustomerLimit: string;
  minOrderAmount: string;
  maxDiscount: string;
  targetPlan: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
}

const emptyForm: PromotionForm = {
  code: "",
  description: "",
  discountType: "percentage",
  discountValue: "",
  maxUsage: "",
  perCustomerLimit: "1",
  minOrderAmount: "",
  maxDiscount: "",
  targetPlan: "",
  startsAt: "",
  expiresAt: "",
  isActive: true,
};

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

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [redemptionTotal, setRedemptionTotal] = useState(0);
  const [form, setForm] = useState<PromotionForm | null>(null);
  const [saving, setSaving] = useState(false);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminFetch(`/api/admin/promotions?page=${page}&limit=${limit}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to load promotions");
      setPromotions(result.promotions || []);
      setRedemptions(result.redemptions || []);
      setTotal(result.total || 0);
      setRedemptionTotal(result.redemptionTotal || 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load promotions");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  function formFromPromotion(promotion: Promotion): PromotionForm {
    return {
      id: promotion.id,
      code: promotion.code,
      description: promotion.description || "",
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      maxUsage: promotion.maxUsage?.toString() || "",
      perCustomerLimit: (promotion.perCustomerLimit || 1).toString(),
      minOrderAmount: promotion.minOrderAmount || "",
      maxDiscount: promotion.maxDiscount || "",
      targetPlan: promotion.targetPlan || "",
      startsAt: promotion.startsAt ? new Date(promotion.startsAt).toISOString().slice(0, 16) : "",
      expiresAt: promotion.expiresAt ? new Date(promotion.expiresAt).toISOString().slice(0, 16) : "",
      isActive: promotion.isActive,
    };
  }

  async function savePromotion(event: FormEvent) {
    event.preventDefault();
    if (!form || saving) return;
    setSaving(true);
    setError("");
    const body = {
      code: form.code,
      description: form.description || null,
      discountType: form.discountType,
      discountValue: form.discountValue,
      maxUsage: form.maxUsage ? Number(form.maxUsage) : null,
      perCustomerLimit: Number(form.perCustomerLimit),
      minOrderAmount: form.minOrderAmount || null,
      maxDiscount: form.maxDiscount || null,
      targetPlan: form.targetPlan || null,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      isActive: form.isActive,
    };
    try {
      const response = await adminFetch(form.id ? `/api/admin/promotions/${form.id}` : "/api/admin/promotions", {
        method: form.id ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to save promotion");
      setForm(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save promotion");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(promotion: Promotion) {
    if (saving || (promotion.isActive && !window.confirm(`Deactivate ${promotion.code}?`))) return;
    setSaving(true);
    setError("");
    try {
      const response = await adminFetch(`/api/admin/promotions/${promotion.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !promotion.isActive }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to update promotion");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to update promotion");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div><h1 className="text-3xl font-bold text-gray-900">Promotions</h1><p className="mt-2 text-gray-600">Subscription codes with plan targeting, usage limits, and expiry.</p></div>
        <button type="button" onClick={() => setForm({ ...emptyForm })} className="rounded bg-[#25D366] px-4 py-2 text-white">New promotion</button>
      </header>
      {error && <div role="alert" className="flex justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"><span>{error}</span><button type="button" onClick={() => void load()} className="underline">Retry</button></div>}

      {form && (
        <form onSubmit={savePromotion} className="grid gap-3 rounded-xl border bg-white p-5 md:grid-cols-2">
          <h2 className="font-semibold md:col-span-2">{form.id ? "Edit promotion" : "Create promotion"}</h2>
          <label className="text-sm">Code<input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
          <label className="text-sm">Description<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
          <label className="text-sm">Discount type<select value={form.discountType} onChange={(event) => setForm({ ...form, discountType: event.target.value as PromotionForm["discountType"] })} className="mt-1 w-full rounded border px-3 py-2"><option value="percentage">Percentage</option><option value="fixed">Fixed amount (NGN)</option></select></label>
          <label className="text-sm">Discount value<input required type="number" min="0.01" step="0.01" max={form.discountType === "percentage" ? "100" : undefined} value={form.discountValue} onChange={(event) => setForm({ ...form, discountValue: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
          <label className="text-sm">Max total usage<input type="number" min="1" value={form.maxUsage} onChange={(event) => setForm({ ...form, maxUsage: event.target.value })} placeholder="Unlimited" className="mt-1 w-full rounded border px-3 py-2" /></label>
          <label className="text-sm">Per-store limit<input required type="number" min="1" value={form.perCustomerLimit} onChange={(event) => setForm({ ...form, perCustomerLimit: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
          <label className="text-sm">Minimum plan price (NGN)<input type="number" min="0" step="0.01" value={form.minOrderAmount} onChange={(event) => setForm({ ...form, minOrderAmount: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
          <label className="text-sm">Maximum discount (NGN)<input type="number" min="0" step="0.01" value={form.maxDiscount} onChange={(event) => setForm({ ...form, maxDiscount: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
          <label className="text-sm">Target plan slug<input value={form.targetPlan} onChange={(event) => setForm({ ...form, targetPlan: event.target.value })} placeholder="Any plan" className="mt-1 w-full rounded border px-3 py-2" /></label>
          <label className="text-sm">Starts at<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
          <label className="text-sm">Expires at<input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
          <div className="flex gap-2 md:col-span-2"><button disabled={saving} className="rounded bg-[#25D366] px-4 py-2 text-white disabled:opacity-50">Save</button><button type="button" onClick={() => setForm(null)} className="rounded border px-4 py-2">Cancel</button></div>
        </form>
      )}

      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="border-b px-5 py-4 font-semibold">Codes ({total})</div>
        {loading ? <div className="animate-pulse p-8 text-gray-500">Loading promotions…</div> : promotions.length === 0 ? <div className="p-10 text-center text-gray-600">No promotions configured.</div> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="bg-gray-50"><tr><th className="px-5 py-3">Code</th><th className="px-5 py-3">Discount</th><th className="px-5 py-3">Usage</th><th className="px-5 py-3">Plan</th><th className="px-5 py-3">Expires</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Actions</th></tr></thead>
            <tbody className="divide-y">{promotions.map((promo) => <tr key={promo.id}>
              <td className="px-5 py-3 font-mono font-semibold">{promo.code}</td>
              <td className="px-5 py-3">{promo.discountType === "percentage" ? `${promo.discountValue}%` : `₦${Number(promo.discountValue).toLocaleString()}`}</td>
              <td className="px-5 py-3">{promo.currentUsage || 0}{promo.maxUsage ? ` / ${promo.maxUsage}` : " / ∞"}</td>
              <td className="px-5 py-3">{promo.targetPlan || "All"}</td>
              <td className="px-5 py-3">{promo.expiresAt ? new Date(promo.expiresAt).toLocaleDateString() : "—"}</td>
              <td className="px-5 py-3">{promo.isActive ? "Active" : "Inactive"}</td>
              <td className="px-5 py-3"><button type="button" disabled={saving} onClick={() => setForm(formFromPromotion(promo))} className="mr-3 underline">Edit</button><button type="button" disabled={saving} onClick={() => void toggleActive(promo)} className="underline">{promo.isActive ? "Deactivate" : "Activate"}</button></td>
            </tr>)}</tbody>
          </table></div>
        )}
        <div className="flex items-center justify-between border-t p-3 text-sm"><span>Page {page}</span><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded border px-3 py-1 disabled:opacity-50">Previous</button><button type="button" disabled={page * limit >= total || loading} onClick={() => setPage((value) => value + 1)} className="rounded border px-3 py-1 disabled:opacity-50">Next</button></div></div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="border-b px-5 py-4 font-semibold">Recent redemptions ({redemptionTotal})</div>
        {redemptions.length === 0 ? <div className="p-8 text-center text-gray-600">No redemption attempts recorded.</div> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="bg-gray-50"><tr><th className="px-5 py-3">Code</th><th className="px-5 py-3">Store</th><th className="px-5 py-3">Discount</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">When</th></tr></thead>
            <tbody className="divide-y">{redemptions.map((redemption) => <tr key={redemption.id}><td className="px-5 py-3 font-mono">{redemption.code}</td><td className="px-5 py-3">{redemption.storeName || redemption.id}</td><td className="px-5 py-3">₦{Number(redemption.discountAmount).toLocaleString()}</td><td className="px-5 py-3">{redemption.status}</td><td className="px-5 py-3">{new Date(redemption.redeemedAt || redemption.reservedAt).toLocaleString()}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
