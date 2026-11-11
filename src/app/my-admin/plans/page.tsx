"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Tag } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  yearlyPrice: string | null;
  currency: string;
  interval: string;
  productLimit: number;
  staffLimit: number;
  storageLimit: string;
  features: string[];
  isActive: boolean;
  isRecommended: boolean;
  sortOrder: number;
  createdAt: string;
}

interface PlanForm {
  name: string;
  slug: string;
  description: string;
  price: string;
  yearlyPrice: string;
  currency: string;
  interval: "month" | "year";
  productLimit: string;
  staffLimit: string;
  storageLimit: string;
  features: string;
  isActive: boolean;
  isRecommended: boolean;
  sortOrder: string;
}

const emptyForm: PlanForm = {
  name: "",
  slug: "",
  description: "",
  price: "0.00",
  yearlyPrice: "",
  currency: "NGN",
  interval: "month",
  productLimit: "-1",
  staffLimit: "-1",
  storageLimit: "10GB",
  features: "",
  isActive: true,
  isRecommended: false,
  sortOrder: "0",
};

function toForm(plan?: Plan): PlanForm {
  if (!plan) return { ...emptyForm };
  return {
    name: plan.name,
    slug: plan.slug,
    description: plan.description || "",
    price: plan.price,
    yearlyPrice: plan.yearlyPrice || "",
    currency: plan.currency || "NGN",
    interval: plan.interval === "year" ? "year" : "month",
    productLimit: String(plan.productLimit),
    staffLimit: String(plan.staffLimit),
    storageLimit: plan.storageLimit,
    features: Array.isArray(plan.features) ? plan.features.join("\n") : "",
    isActive: plan.isActive,
    isRecommended: plan.isRecommended,
    sortOrder: String(plan.sortOrder),
  };
}

async function getToken() {
  const { data: { session } } = await getSupabaseClient().auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  return session.access_token;
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [editing, setEditing] = useState<Plan | null | undefined>(undefined);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const token = await getToken();
        const params = new URLSearchParams({ search, page: String(page), limit: "50" });
        const response = await fetch(`/api/admin/plans?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load plans");
        setPlans(data.plans || []);
        setTotal(data.total || 0);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load plans");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [page, retryKey, search]);

  function openEditor(plan?: Plan) {
    setForm(toForm(plan));
    setEditing(plan || null);
    setError("");
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    const body = {
      name: form.name,
      slug: form.slug,
      description: form.description || null,
      price: form.price,
      yearlyPrice: form.yearlyPrice || null,
      currency: form.currency,
      interval: form.interval,
      productLimit: Number(form.productLimit),
      staffLimit: Number(form.staffLimit),
      storageLimit: form.storageLimit,
      features: form.features.split("\n").map((feature) => feature.trim()).filter(Boolean),
      isActive: form.isActive,
      isRecommended: form.isRecommended,
      sortOrder: Number(form.sortOrder),
    };
    try {
      const token = await getToken();
      const response = await fetch(editing ? `/api/admin/plans/${editing.id}` : "/api/admin/plans", {
        method: editing ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save plan");
      setEditing(undefined);
      setNotice(editing ? "Plan updated." : "Plan created.");
      setRetryKey((key) => key + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save plan");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(plan: Plan) {
    if (!window.confirm(`Deactivate "${plan.name}"? Existing subscriptions will not be changed.`)) return;
    setError("");
    setNotice("");
    try {
      const token = await getToken();
      const response = await fetch(`/api/admin/plans/${plan.id}?confirm=deactivate`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to deactivate plan");
      setNotice("Plan deactivated.");
      setRetryKey((key) => key + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Failed to deactivate plan");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Plans</h1>
          <p className="mt-2 text-gray-600">Manage subscription plans, pricing, limits, and features.</p>
        </div>
        <button type="button" onClick={() => openEditor()} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">
          <Plus size={18} /> Add plan
        </button>
      </header>

      <input
        type="search"
        aria-label="Search plans"
        value={search}
        onChange={(event) => { setSearch(event.target.value); setPage(1); }}
        placeholder="Search plans"
        className="w-full rounded-lg border px-3 py-2"
      />
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error} <button type="button" className="ml-2 underline" onClick={() => setRetryKey((key) => key + 1)}>Retry</button></div>}
      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">{notice}</div>}
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-56 animate-pulse rounded-xl bg-gray-100" />)}</div>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border bg-gray-50 p-12 text-center text-gray-600"><Tag className="mx-auto mb-3" />No plans found.</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900">{plan.name}</h2>
                {plan.isRecommended && <span className="rounded-full bg-green-600 px-2 py-1 text-xs text-white">Recommended</span>}
              </div>
              <p className="mb-2 text-3xl font-bold text-gray-900">{plan.currency} {Number(plan.price).toLocaleString()}<span className="text-sm font-normal text-gray-600">/{plan.interval}</span></p>
              <p className="mb-4 min-h-10 text-sm text-gray-600">{plan.description || "No description"}</p>
              <div className="mb-4 space-y-1 text-sm text-gray-600">
                <p>Products: {plan.productLimit === -1 ? "Unlimited" : plan.productLimit}</p>
                <p>Staff: {plan.staffLimit === -1 ? "Unlimited" : plan.staffLimit}</p>
                <p>Storage: {plan.storageLimit}</p>
              </div>
              <div className="flex items-center justify-between border-t pt-4">
                <span className={`rounded-full px-3 py-1 text-sm ${plan.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>{plan.isActive ? "Active" : "Inactive"}</span>
                <div className="flex gap-3">
                  <button type="button" onClick={() => openEditor(plan)} className="text-sm text-green-700 underline">Edit</button>
                  {plan.isActive && <button type="button" onClick={() => void deactivate(plan)} className="text-sm text-red-700 underline">Deactivate</button>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{total} plans · page {page} of {Math.max(1, Math.ceil(total / 50))}</span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded border px-3 py-2 disabled:opacity-50">Previous</button>
          <button type="button" disabled={page * 50 >= total} onClick={() => setPage((value) => value + 1)} className="rounded border px-3 py-2 disabled:opacity-50">Next</button>
        </div>
      </div>

      {editing !== undefined && (
        <div role="dialog" aria-modal="true" aria-labelledby="plan-form-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={savePlan} className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl bg-white p-6">
            <h2 id="plan-form-title" className="text-xl font-semibold">{editing ? "Edit plan" : "Create plan"}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">Name<input required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
              <label className="text-sm">Slug<input required maxLength={100} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
              <label className="text-sm">Price<input required inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
              <label className="text-sm">Yearly price (optional)<input inputMode="decimal" value={form.yearlyPrice} onChange={(e) => setForm({ ...form, yearlyPrice: e.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
              <label className="text-sm">Currency<input required maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} className="mt-1 w-full rounded border px-3 py-2" /></label>
              <label className="text-sm">Interval<select value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value as "month" | "year" })} className="mt-1 w-full rounded border px-3 py-2"><option value="month">Monthly</option><option value="year">Yearly</option></select></label>
              <label className="text-sm">Product limit (-1 unlimited)<input type="number" min={-1} value={form.productLimit} onChange={(e) => setForm({ ...form, productLimit: e.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
              <label className="text-sm">Staff limit (-1 unlimited)<input type="number" min={-1} value={form.staffLimit} onChange={(e) => setForm({ ...form, staffLimit: e.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
              <label className="text-sm">Storage limit<input required maxLength={50} value={form.storageLimit} onChange={(e) => setForm({ ...form, storageLimit: e.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
              <label className="text-sm">Sort order<input type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
            </div>
            <label className="block text-sm">Description<textarea maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
            <label className="block text-sm">Features (one per line)<textarea value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
            <div className="flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />Active</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.isRecommended} onChange={(e) => setForm({ ...form, isRecommended: e.target.checked })} />Recommended</label>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" disabled={saving} onClick={() => setEditing(undefined)} className="rounded border px-4 py-2">Cancel</button>
              <button type="submit" disabled={saving} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{saving ? "Saving…" : "Save plan"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
