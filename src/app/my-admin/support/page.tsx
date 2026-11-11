"use client";

import { FormEvent, useEffect, useState } from "react";
import { Ticket } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface SupportTicket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  storeName: string;
  userName: string;
  assignedTo: string | null;
  message?: string;
  sla?: {
    targetHours: number;
    dueAt: string;
    firstResponseAt: string | null;
    status: "met" | "breached" | "overdue" | "on_track";
  };
}

interface Assignee {
  id: string;
  fullName: string;
  email: string;
}

interface TicketMessage {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  actorName: string | null;
}

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [savingId, setSavingId] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setError("Not authenticated");
          setLoading(false);
          return;
        }

        const params = new URLSearchParams({
          search,
          status: statusFilter,
          priority: priorityFilter,
          page: String(page),
          limit: "20",
        });
        const res = await fetch(`/api/admin/support?${params}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setTickets(data.tickets || []);
          setAssignees(data.assignees || []);
          setTotal(data.total || 0);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load support tickets");
        }
      } catch {
        setError("Failed to load support tickets");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [page, priorityFilter, retryKey, search, statusFilter]);

  async function updateTicket(ticket: SupportTicket, changes: { status?: string; priority?: string; assignedTo?: string | null }) {
    if (savingId) return;
    const reason = window.prompt("Enter the reason for this ticket update");
    if (!reason?.trim()) return;
    setSavingId(ticket.id);
    setError("");
    setNotice("");
    try {
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch("/api/admin/support", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: ticket.id, ...changes, reason: reason.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update ticket");
      setNotice("Ticket updated.");
      setRetryKey((key) => key + 1);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update ticket");
    } finally {
      setSavingId("");
    }
  }

  async function openTicket(ticket: SupportTicket) {
    setSelectedTicket(ticket);
    setError("");
    try {
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch(`/api/admin/support?ticketId=${ticket.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load ticket thread");
      setSelectedTicket(data.ticket);
      setTicketMessages(data.messages || []);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Failed to load ticket thread");
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTicket || sendingReply) return;
    setSendingReply(true);
    setError("");
    try {
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch("/api/admin/support", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: selectedTicket.id, body: reply, isInternal }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to send reply");
      setTicketMessages((current) => [...current, {
        ...data.message,
        actorName: "You",
      }]);
      setReply("");
      setNotice(isInternal ? "Internal note added." : data.emailSent ? "Reply saved and email sent." : "Reply saved; email delivery failed.");
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Support Tickets</h1>
        <p className="text-gray-600 mt-2">Manage and respond to support requests</p>
      </div>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error} <button type="button" className="ml-2 underline" onClick={() => setRetryKey((key) => key + 1)}>Retry list</button></div>}
      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">{notice}</div>}
      <div className="grid gap-3 sm:grid-cols-3">
        <input aria-label="Search support tickets" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search subject" className="rounded-lg border px-3 py-2" />
        <select aria-label="Filter tickets by status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="rounded-lg border px-3 py-2"><option value="all">All statuses</option>{["open", "in_progress", "resolved", "closed"].map((item) => <option key={item} value={item}>{item.replace("_", " ")}</option>)}</select>
        <select aria-label="Filter tickets by priority" value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value); setPage(1); }} className="rounded-lg border px-3 py-2"><option value="all">All priorities</option>{["low", "normal", "high", "urgent"].map((item) => <option key={item} value={item}>{item}</option>)}</select>
      </div>

      {loading ? <div className="h-64 animate-pulse rounded-xl bg-gray-100" /> : <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Subject</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Store</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">User</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Priority</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Updated</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">First response SLA</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Assignee</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Thread</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{ticket.subject}</td>
                  <td className="px-6 py-4 text-gray-700">{ticket.storeName}</td>
                  <td className="px-6 py-4 text-gray-700">{ticket.userName}</td>
                  <td className="px-6 py-4">
                    <select aria-label={`Priority for ${ticket.subject}`} disabled={Boolean(savingId)} value={ticket.priority} onChange={(event) => void updateTicket(ticket, { priority: event.target.value })} className="rounded border px-2 py-1 text-sm">{["low", "normal", "high", "urgent"].map((item) => <option key={item} value={item}>{item}</option>)}</select>
                  </td>
                  <td className="px-6 py-4">
                    <select aria-label={`Status for ${ticket.subject}`} disabled={Boolean(savingId)} value={ticket.status} onChange={(event) => void updateTicket(ticket, { status: event.target.value })} className="rounded border px-2 py-1 text-sm">{["open", "in_progress", "resolved", "closed"].map((item) => <option key={item} value={item}>{item.replace("_", " ")}</option>)}</select>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(ticket.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                      ticket.sla?.status === "met" ? "bg-green-100 text-green-800" :
                      ticket.sla?.status === "on_track" ? "bg-blue-100 text-blue-800" :
                      "bg-red-100 text-red-800"
                    }`}>
                      {ticket.sla?.status?.replace("_", " ") || "Unknown"}
                    </span>
                    <div className="mt-1 text-xs text-gray-500">
                      {ticket.sla?.firstResponseAt
                        ? `Responded ${new Date(ticket.sla.firstResponseAt).toLocaleString()}`
                        : `Due ${ticket.sla ? new Date(ticket.sla.dueAt).toLocaleString() : "—"}`}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select aria-label={`Assignee for ${ticket.subject}`} disabled={Boolean(savingId)} value={ticket.assignedTo || ""} onChange={(event) => void updateTicket(ticket, { assignedTo: event.target.value || null })} className="max-w-40 rounded border px-2 py-1 text-sm"><option value="">Unassigned</option>{assignees.map((item) => <option key={item.id} value={item.id}>{item.fullName || item.email}</option>)}</select>
                  </td>
                  <td className="px-6 py-4"><button type="button" onClick={() => void openTicket(ticket)} className="text-sm text-green-700 underline">Open / reply</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tickets.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <p className="text-gray-600">No support tickets found</p>
          </div>
        )}
      </div>}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{total} tickets · page {page} of {Math.max(1, Math.ceil(total / 20))}</span>
        <div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded border px-3 py-2 disabled:opacity-50">Previous</button><button type="button" disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)} className="rounded border px-3 py-2 disabled:opacity-50">Next</button></div>
      </div>
      {selectedTicket && <div role="dialog" aria-modal="true" aria-labelledby="ticket-thread-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6">
          <div className="flex items-start justify-between gap-4"><div><h2 id="ticket-thread-title" className="text-xl font-semibold">{selectedTicket.subject}</h2><p className="mt-1 text-sm text-gray-500">{selectedTicket.storeName} · {selectedTicket.userName}</p></div><button type="button" onClick={() => setSelectedTicket(null)} className="rounded border px-3 py-1">Close</button></div>
          <div className="my-4 rounded-lg bg-gray-50 p-4"><p className="whitespace-pre-wrap">{selectedTicket.message || "Original message unavailable"}</p><p className="mt-2 text-xs text-gray-500">Original message</p></div>
          <div className="space-y-3">{ticketMessages.map((message) => <article key={message.id} className={`rounded-lg border p-4 ${message.isInternal ? "border-amber-300 bg-amber-50" : "bg-white"}`}><p className="whitespace-pre-wrap">{message.body}</p><p className="mt-2 text-xs text-gray-500">{message.actorName || "System"} · {new Date(message.createdAt).toLocaleString()} {message.isInternal ? "· Internal note" : ""}</p></article>)}</div>
          <form onSubmit={sendReply} className="mt-5 space-y-3"><label className="block text-sm">Reply or note<textarea required maxLength={10000} rows={4} value={reply} onChange={(event) => setReply(event.target.value)} className="mt-1 w-full rounded border px-3 py-2" /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isInternal} onChange={(event) => setIsInternal(event.target.checked)} />Internal note (not visible to merchant)</label><div className="flex justify-end"><button type="submit" disabled={sendingReply} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{sendingReply ? "Saving…" : isInternal ? "Add note" : "Send reply"}</button></div></form>
        </section>
      </div>}
    </div>
  );
}
