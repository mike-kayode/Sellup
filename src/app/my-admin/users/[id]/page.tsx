"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Account {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface AccountDetail {
  user: Account;
  canManageRole: boolean;
  staffMembership: { role: string; isActive: boolean } | null;
  stores: Array<{
    id: string;
    storeName: string;
    storeSlug: string;
    isPublished: boolean | null;
    plan: string | null;
    createdAt: string;
  }>;
  orders: Array<{
    id: string;
    storeId: string;
    orderNumber: string;
    total: string;
    status: string | null;
    paymentStatus: string | null;
    createdAt: string;
  }>;
  payments: Array<{
    id: string;
    amount: string;
    status: string | null;
    createdAt: string;
  }>;
  stats: { stores: number; orders: number; paymentsTotal: string };
}

const roleOptions = [
  ["user", "User"],
  ["merchant", "Merchant"],
  ["superadmin", "Superadmin"],
  ["admin", "Admin"],
  ["platform_admin", "Platform admin"],
  ["support_agent", "Support agent"],
  ["finance_manager", "Finance manager"],
  ["content_manager", "Content manager"],
  ["moderator", "Moderator"],
  ["developer", "Developer"],
  ["analyst", "Analyst"],
];

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const userId = params.id;
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [role, setRole] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  const loadDetail = useCallback(async () => {
    const {
      data: { session },
    } = await getSupabaseClient().auth.getSession();
    if (!session?.access_token) throw new Error("Not authenticated");
    const response = await fetch(`/api/admin/users/${userId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Failed to load account");
    return result as AccountDetail;
  }, [userId]);

  useEffect(() => {
    let active = true;
    void loadDetail()
      .then((result) => {
        if (active) {
          setDetail(result);
          setRole(result.user.role);
          setError("");
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error ? loadError.message : "Failed to load account"
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadDetail, retryKey]);

  async function mutate(
    method: "PATCH" | "POST",
    body: Record<string, unknown>,
    successMessage: string,
    confirmMessage?: string
  ) {
    if (saving || (confirmMessage && !window.confirm(confirmMessage))) return;
    setSaving(true);
    setActionError("");
    setSuccess("");
    try {
      const {
        data: { session },
      } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch(`/api/admin/users/${userId}`, {
        method,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Account update failed");
      const fresh = await loadDetail();
      setDetail(fresh);
      setRole(fresh.user.role);
      setSuccess(successMessage);
    } catch (mutationError) {
      setActionError(
        mutationError instanceof Error
          ? mutationError.message
          : "Account update failed"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-6" aria-label="Loading user">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-100" />
        <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        <p>{error || "User not found"}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setRetryKey((key) => key + 1);
          }}
          className="mt-3 rounded border border-red-300 px-3 py-1.5 hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }

  const account = detail.user;
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back to users"
          className="rounded-lg p-2 hover:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{account.fullName}</h1>
          <p className="mt-1 text-gray-600">{account.email}</p>
        </div>
      </div>

      {actionError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {actionError}
        </div>
      )}
      {success && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
          {success}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Stores", detail.stats.stores],
          ["Orders", detail.stats.orders],
          ["Recorded payments", detail.stats.paymentsTotal],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-gray-600">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
          </div>
        ))}
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Account controls</h2>
          <p className="text-sm text-gray-600">
            Changes are recorded in the platform audit log.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="account-role" className="block text-sm font-medium text-gray-700">
              Platform role
            </label>
            <div className="flex gap-2">
              <select
                id="account-role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                disabled={!detail.canManageRole || saving}
                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100"
              >
                {roleOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={!detail.canManageRole || saving || role === account.role}
                onClick={() =>
                  void mutate(
                    "PATCH",
                    { action: "set_role", role },
                    "Role updated",
                    `Change ${account.fullName}'s role to ${role.replaceAll("_", " ")}?`
                  )
                }
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Save
              </button>
            </div>
            {!detail.canManageRole && (
              <p className="text-xs text-gray-500">Only a superadmin can change roles.</p>
            )}
          </div>
          <div className="space-y-2">
            <p className="block text-sm font-medium text-gray-700">Account status</p>
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void mutate(
                  "PATCH",
                  { action: "set_active", isActive: !account.isActive },
                  account.isActive ? "Account deactivated" : "Account activated",
                  `${account.isActive ? "Deactivate" : "Activate"} this account?`
                )
              }
              className={`rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                account.isActive
                  ? "border-red-300 text-red-700 hover:bg-red-50"
                  : "border-green-300 text-green-700 hover:bg-green-50"
              }`}
            >
              {saving ? "Saving…" : account.isActive ? "Deactivate account" : "Activate account"}
            </button>
          </div>
          <div className="space-y-2">
            <p className="block text-sm font-medium text-gray-700">Sessions</p>
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void mutate(
                  "PATCH",
                  { action: "force_sign_out" },
                  "Existing sessions revoked",
                  "Sign this account out from all active sessions? They will need to sign in again."
                )
              }
              className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
            >
              Force sign-out
            </button>
          </div>
          {!account.isEmailVerified && (
            <div className="space-y-2">
              <p className="block text-sm font-medium text-gray-700">Email verification</p>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void mutate(
                    "POST",
                    { action: "resend_verification" },
                    "Verification email sent"
                  )
                }
                className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-50 disabled:opacity-50"
              >
                Resend verification email
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Stores</h2>
        {detail.stores.length === 0 ? (
          <p className="text-gray-600">No stores for this account.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {detail.stores.map((store) => (
              <li key={store.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium text-gray-900">{store.storeName}</p>
                  <p className="text-sm text-gray-600">/{store.storeSlug} · {store.plan || "No plan"}</p>
                </div>
                <span className="text-sm text-gray-600">
                  {store.isPublished ? "Published" : "Draft"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent orders</h2>
        {detail.orders.length === 0 ? (
          <p className="text-gray-600">No orders for this account.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Payment</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-3 py-3">{order.orderNumber}</td>
                    <td className="px-3 py-3">{order.status || "—"}</td>
                    <td className="px-3 py-3">{order.paymentStatus || "—"}</td>
                    <td className="px-3 py-3">{order.total}</td>
                    <td className="px-3 py-3">{new Date(order.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Account information</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div><dt className="text-sm text-gray-500">Phone</dt><dd>{account.phone || "—"}</dd></div>
          <div><dt className="text-sm text-gray-500">Email verified</dt><dd>{account.isEmailVerified ? "Yes" : "No"}</dd></div>
          <div><dt className="text-sm text-gray-500">Joined</dt><dd>{new Date(account.createdAt).toLocaleString()}</dd></div>
          <div><dt className="text-sm text-gray-500">Last updated</dt><dd>{new Date(account.updatedAt).toLocaleString()}</dd></div>
        </dl>
      </section>
    </div>
  );
}
