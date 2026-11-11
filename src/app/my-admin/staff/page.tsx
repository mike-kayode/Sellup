"use client";

import { FormEvent, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Staff {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface StaffRole {
  id: string;
  name: string;
}

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [savingId, setSavingId] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviting, setInviting] = useState(false);

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

        const params = new URLSearchParams({ search, role: roleFilter, page: String(page), limit: "50" });
        const res = await fetch(`/api/admin/staff?${params}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setStaff(data.staff || []);
          setRoles(data.roles || []);
          setTotal(data.total || 0);
          if (!inviteRole && data.roles?.length) setInviteRole(data.roles[0].id);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load staff");
        }
      } catch {
        setError("Failed to load staff");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [inviteRole, page, retryKey, roleFilter, search]);

  async function updateStaff(member: Staff, update: { role?: string; isActive?: boolean; revokeSessions?: boolean }) {
    if (savingId) return;
    if (update.role && update.role !== member.role && !window.confirm(`Change ${member.fullName}'s role to ${update.role}?`)) return;
    if (update.isActive === false && !window.confirm(`Deactivate ${member.fullName}?`)) return;
    if (update.revokeSessions && !window.confirm(`Force ${member.fullName} to sign out of all sessions?`)) return;
    setSavingId(member.id);
    setError("");
    setNotice("");
    try {
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch("/api/admin/staff", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.id, ...update }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update staff member");
      setNotice("Staff member updated.");
      setRetryKey((key) => key + 1);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update staff member");
    } finally {
      setSavingId("");
    }
  }

  async function inviteStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inviting) return;
    setInviting(true);
    setError("");
    setNotice("");
    try {
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, fullName: inviteName, role: inviteRole }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to invite staff member");
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      setNotice("Invitation sent.");
      setRetryKey((key) => key + 1);
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Failed to invite staff member");
    } finally {
      setInviting(false);
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Staff</h1>
        <p className="text-gray-600 mt-2">Manage internal Sell Up team members</p>
        </div>
        <button type="button" onClick={() => setInviteOpen((open) => !open)} className="rounded-lg bg-slate-900 px-4 py-2 text-white">Invite staff</button>
      </div>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error} <button type="button" className="ml-2 underline" onClick={() => setRetryKey((key) => key + 1)}>Retry</button></div>}
      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">{notice}</div>}
      {inviteOpen && <form onSubmit={inviteStaff} className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-4">
        <label className="text-sm">Full name<input required maxLength={255} value={inviteName} onChange={(event) => setInviteName(event.target.value)} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <label className="text-sm">Email<input required type="email" maxLength={255} value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className="mt-1 w-full rounded border px-3 py-2" /></label>
        <label className="text-sm">Role<select required value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} className="mt-1 w-full rounded border px-3 py-2">{roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <button type="submit" disabled={inviting || !inviteRole} className="self-end rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50">{inviting ? "Inviting…" : "Send invite"}</button>
      </form>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <input aria-label="Search staff" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search name or email" className="flex-1 rounded-lg border px-3 py-2" />
        <select aria-label="Filter by role" value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }} className="rounded-lg border px-3 py-2"><option value="all">All roles</option>{roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      </div>
      {loading ? <div className="h-56 animate-pulse rounded-xl bg-gray-100" /> : <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Email</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Role</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Verified</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Last login</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Joined</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {staff.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{member.fullName}</td>
                  <td className="px-6 py-4 text-gray-700">{member.email}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 capitalize">
                      {member.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {member.isVerified ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        ✓ Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleString() : "Never"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(member.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <select aria-label={`Role for ${member.fullName}`} value={member.role} disabled={Boolean(savingId)} onChange={(event) => void updateStaff(member, { role: event.target.value })} className="rounded border px-2 py-1 text-sm">{roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                      <button type="button" disabled={Boolean(savingId)} onClick={() => void updateStaff(member, { isActive: !member.isActive })} className="rounded border px-2 py-1 text-sm disabled:opacity-50">{member.isActive ? "Deactivate" : "Activate"}</button>
                      <button type="button" disabled={Boolean(savingId)} onClick={() => void updateStaff(member, { revokeSessions: true })} className="rounded border px-2 py-1 text-sm disabled:opacity-50">Force sign-out</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {staff.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No staff members found</p>
          </div>
        )}
      </div>}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{total} staff members · page {page} of {Math.max(1, Math.ceil(total / 50))}</span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded border px-3 py-2 disabled:opacity-50">Previous</button>
          <button type="button" disabled={page * 50 >= total} onClick={() => setPage((value) => value + 1)} className="rounded border px-3 py-2 disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>
  );
}
