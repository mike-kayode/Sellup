"use client";

import { FormEvent, useEffect, useState } from "react";
import { Bell, Plus } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  target: string;
  targetPlan: string | null;
  targetStoreId: string | null;
  isActive: boolean;
  sendEmail: boolean;
  sendWhatsApp: boolean;
  scheduledAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface AnnouncementDelivery {
  id: string;
  channel: string;
  recipient: string;
  status: string;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface Option {
  id?: string;
  slug?: string;
  name?: string;
  storeName?: string;
}

const initialForm = {
  title: "",
  message: "",
  type: "info",
  target: "all",
  targetPlan: "",
  targetStoreId: "",
  sendEmail: false,
  sendWhatsApp: false,
  scheduledAt: "",
  expiresAt: "",
};

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [plans, setPlans] = useState<Option[]>([]);
  const [stores, setStores] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deliveryAnnouncementId, setDeliveryAnnouncementId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<AnnouncementDelivery[]>([]);
  const [deliveryTotal, setDeliveryTotal] = useState(0);
  const [deliveryPage, setDeliveryPage] = useState(1);
  const [deliveryLoading, setDeliveryLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const { data: { session } } = await getSupabaseClient().auth.getSession();
        if (!session?.access_token) throw new Error("Not authenticated");
        const params = new URLSearchParams({ search, page: String(page), limit: "20" });
        const response = await fetch(`/api/admin/announcements?${params}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load announcements");
        setAnnouncements(data.announcements || []);
        setPlans(data.availablePlans || []);
        setStores(data.availableStores || []);
        setTotal(data.total || 0);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load announcements");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [page, retryKey, search]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          targetPlan: formData.target === "plan" ? formData.targetPlan : null,
          targetStoreId: formData.target === "store" ? formData.targetStoreId : null,
          scheduledAt: formData.scheduledAt ? new Date(formData.scheduledAt).toISOString() : null,
          expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
          isActive: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create announcement");
      setShowForm(false);
      setFormData(initialForm);
      setNotice("Announcement created.");
      setRetryKey((key) => key + 1);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create announcement");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(announcement: Announcement) {
    if (!window.confirm(`${announcement.isActive ? "Deactivate" : "Activate"} "${announcement.title}"?`)) return;
    setError("");
    setNotice("");
    try {
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch(`/api/admin/announcements/${announcement.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !announcement.isActive }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update announcement");
      setNotice(announcement.isActive ? "Announcement deactivated." : "Announcement activated.");
      setRetryKey((key) => key + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Failed to update announcement");
    }
  }

  async function loadDeliveryLog(announcementId: string, requestedPage = 1) {
    setDeliveryLoading(true);
    setError("");
    try {
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const params = new URLSearchParams({ page: String(requestedPage), limit: "20" });
      const response = await fetch(`/api/admin/announcements/${announcementId}/deliveries?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load delivery log");
      setDeliveryAnnouncementId(announcementId);
      setDeliveries(data.deliveries || []);
      setDeliveryTotal(data.total || 0);
      setDeliveryPage(requestedPage);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load delivery log");
    } finally {
      setDeliveryLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-bold text-gray-900">Announcements</h1><p className="mt-2 text-gray-600">Target all merchants, a plan, or a store; schedule and expire announcements.</p></div>
        <button type="button" onClick={() => setShowForm((open) => !open)} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-white"><Plus size={18} />New announcement</button>
      </header>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error} <button type="button" className="ml-2 underline" onClick={() => setRetryKey((key) => key + 1)}>Retry</button></div>}
      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">{notice}</div>}
      {showForm && <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-white p-6">
        <label className="block text-sm">Title<input required maxLength={255} value={formData.title} onChange={(event) => setFormData({ ...formData, title: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <label className="block text-sm">Message<textarea required maxLength={20000} rows={4} value={formData.message} onChange={(event) => setFormData({ ...formData, message: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Type<select value={formData.type} onChange={(event) => setFormData({ ...formData, type: event.target.value })} className="mt-1 w-full rounded border px-3 py-2">{["info", "update", "maintenance", "warning", "promotion", "notification"].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="text-sm">Target<select value={formData.target} onChange={(event) => setFormData({ ...formData, target: event.target.value })} className="mt-1 w-full rounded border px-3 py-2"><option value="all">All merchants</option><option value="plan">Plan</option><option value="store">One store</option></select></label>
          {formData.target === "plan" && <label className="text-sm">Plan<select required value={formData.targetPlan} onChange={(event) => setFormData({ ...formData, targetPlan: event.target.value })} className="mt-1 w-full rounded border px-3 py-2"><option value="">Select plan</option>{plans.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label>}
          {formData.target === "store" && <label className="text-sm">Store<select required value={formData.targetStoreId} onChange={(event) => setFormData({ ...formData, targetStoreId: event.target.value })} className="mt-1 w-full rounded border px-3 py-2"><option value="">Select store</option>{stores.map((item) => <option key={item.id} value={item.id}>{item.storeName}</option>)}</select></label>}
          <label className="text-sm">Schedule at (optional)<input type="datetime-local" value={formData.scheduledAt} onChange={(event) => setFormData({ ...formData, scheduledAt: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
          <label className="text-sm">Expire at (optional)<input type="datetime-local" value={formData.expiresAt} onChange={(event) => setFormData({ ...formData, expiresAt: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formData.sendEmail} onChange={(event) => setFormData({ ...formData, sendEmail: event.target.checked })} />Queue email delivery</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formData.sendWhatsApp} onChange={(event) => setFormData({ ...formData, sendWhatsApp: event.target.checked })} />Queue WhatsApp delivery</label>
        </div>
        <div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={() => setShowForm(false)} className="rounded border px-4 py-2">Cancel</button><button type="submit" disabled={saving} className="rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50">{saving ? "Saving…" : "Create announcement"}</button></div>
      </form>}
      <input type="search" aria-label="Search announcements" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search title" className="w-full rounded-lg border px-3 py-2" />
      {loading ? <div className="h-64 animate-pulse rounded-xl bg-gray-100" /> : <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[850px]">
          <thead className="border-b bg-gray-50"><tr>{["Title", "Target", "Type", "Schedule", "Expires", "Status", "Actions"].map((heading) => <th key={heading} className="px-4 py-3 text-left text-sm">{heading}</th>)}</tr></thead>
          <tbody className="divide-y">{announcements.map((item) => <tr key={item.id}>
            <td className="px-4 py-3"><div className="flex items-center gap-2"><Bell size={16} /><span className="font-medium">{item.title}</span></div></td>
            <td className="px-4 py-3 text-sm">{item.target === "plan" ? `Plan: ${item.targetPlan}` : item.target === "store" ? "One store" : "All merchants"}</td>
            <td className="px-4 py-3 text-sm capitalize">{item.type}</td>
            <td className="px-4 py-3 text-sm">{item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : "Immediately"}</td>
            <td className="px-4 py-3 text-sm">{item.expiresAt ? new Date(item.expiresAt).toLocaleString() : "Never"}</td>
            <td className="px-4 py-3 text-sm">{item.isActive ? "Active" : "Inactive"}</td>
            <td className="space-x-3 px-4 py-3">
              <button type="button" onClick={() => void toggleActive(item)} className="text-sm text-green-700 underline">{item.isActive ? "Deactivate" : "Activate"}</button>
              {(item.sendEmail || item.sendWhatsApp) && <button type="button" onClick={() => void loadDeliveryLog(item.id)} className="text-sm text-blue-700 underline">Delivery log</button>}
            </td>
          </tr>)}</tbody>
        </table>
        {announcements.length === 0 && <div className="p-12 text-center text-gray-600">No announcements found.</div>}
      </div>}
      {deliveryAnnouncementId && <section aria-label="Announcement delivery log" className="space-y-3 rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Delivery log</h2>
          <button type="button" onClick={() => setDeliveryAnnouncementId(null)} className="text-sm underline">Close</button>
        </div>
        {deliveryLoading ? <div className="h-20 animate-pulse rounded bg-gray-100" /> : deliveries.length === 0
          ? <p className="text-sm text-gray-600">No delivery attempts are recorded yet.</p>
          : <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b text-left">{["Channel", "Recipient", "Status", "Attempts", "Last error", "Sent"].map((heading) => <th key={heading} className="px-2 py-2">{heading}</th>)}</tr></thead>
            <tbody>{deliveries.map((delivery) => <tr key={delivery.id} className="border-b">
              <td className="px-2 py-2 capitalize">{delivery.channel}</td>
              <td className="px-2 py-2">{delivery.recipient}</td>
              <td className="px-2 py-2 capitalize">{delivery.status}</td>
              <td className="px-2 py-2">{delivery.attempts}</td>
              <td className="px-2 py-2">{delivery.lastError || "—"}</td>
              <td className="px-2 py-2">{delivery.sentAt ? new Date(delivery.sentAt).toLocaleString() : "—"}</td>
            </tr>)}</tbody>
          </table></div>}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{deliveryTotal} deliveries · page {deliveryPage} of {Math.max(1, Math.ceil(deliveryTotal / 20))}</span>
          <div className="flex gap-2">
            <button type="button" disabled={deliveryLoading || deliveryPage <= 1} onClick={() => void loadDeliveryLog(deliveryAnnouncementId, deliveryPage - 1)} className="rounded border px-3 py-1 disabled:opacity-50">Previous</button>
            <button type="button" disabled={deliveryLoading || deliveryPage * 20 >= deliveryTotal} onClick={() => void loadDeliveryLog(deliveryAnnouncementId, deliveryPage + 1)} className="rounded border px-3 py-1 disabled:opacity-50">Next</button>
          </div>
        </div>
      </section>}
      <div className="flex items-center justify-between text-sm text-gray-600"><span>{total} announcements · page {page} of {Math.max(1, Math.ceil(total / 20))}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded border px-3 py-2 disabled:opacity-50">Previous</button><button type="button" disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)} className="rounded border px-3 py-2 disabled:opacity-50">Next</button></div></div>
    </div>
  );
}
