"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Eye, Search } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type UserKind = "platform" | "buyers";

interface PlatformUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  isVerified: boolean;
  isActive: boolean;
  role: string;
  storeCount: number;
  createdAt: string;
}

interface Buyer {
  id: string;
  storeId: string;
  name: string;
  email: string | null;
  phone: string;
  totalSpent: string | null;
  totalOrders: number | null;
  isBlocked: boolean;
  createdAt: string;
  storeName: string;
  storeSlug: string;
}

interface ListResponse<T> {
  users: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

async function getAccessToken() {
  const {
    data: { session },
  } = await getSupabaseClient().auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  return session.access_token;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [kind, setKind] = useState<UserKind>("platform");
  const [users, setUsers] = useState<(PlatformUser | Buyer)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [busyBuyer, setBusyBuyer] = useState<string | null>(null);

  const loadUsers = useCallback(async (signal?: AbortSignal) => {
    try {
      const token = await getAccessToken();
      if (signal?.aborted) return;
      const params = new URLSearchParams({
        type: kind,
        search,
        role: kind === "platform" ? role : "all",
        status,
        sort,
        page: String(page),
        limit: "20",
      });
      const response = await fetch(`/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to load users");
      }
      if (signal?.aborted) return;
      const data = result as ListResponse<PlatformUser | Buyer>;
      setUsers(data.users);
      setTotal(data.total);
      setPages(data.pages);
      setError("");
    } catch (loadError) {
      if (!signal?.aborted) {
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load users"
        );
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [kind, page, role, search, sort, status]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadUsers(controller.signal));
    return () => controller.abort();
  }, [loadUsers, retryKey]);

  function changeKind(next: UserKind) {
    setLoading(true);
    setKind(next);
    setPage(1);
    setStatus("all");
    setRole("all");
    setActionError("");
  }

  async function toggleBuyerBlock(buyer: Buyer) {
    const action = buyer.isBlocked ? "unblock" : "block";
    if (
      action === "block" &&
      !window.confirm(`Block ${buyer.name} from signing in to ${buyer.storeName}?`)
    ) {
      return;
    }
    const reason = window.prompt(`Reason to ${action} this buyer:`);
    if (!reason?.trim()) return;

    setBusyBuyer(buyer.id);
    setActionError("");
    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/admin/buyers/${buyer.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ storeId: buyer.storeId, action, reason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Buyer update failed");
      await loadUsers();
    } catch (mutationError) {
      setActionError(
        mutationError instanceof Error
          ? mutationError.message
          : "Buyer update failed"
      );
    } finally {
      setBusyBuyer(null);
    }
  }

  const activeUsers = users as PlatformUser[];
  const buyers = users as Buyer[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Users</h1>
        <p className="mt-2 text-gray-600">
          Platform accounts and merchant buyers
        </p>
      </header>

      <div className="flex border-b border-slate-200" role="tablist" aria-label="User type">
        <button
          type="button"
          role="tab"
          aria-selected={kind === "platform"}
          onClick={() => changeKind("platform")}
          className={`px-4 py-3 text-sm font-medium border-b-2 ${
            kind === "platform"
              ? "border-green-600 text-green-700"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Platform accounts
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={kind === "buyers"}
          onClick={() => changeKind("buyers")}
          className={`px-4 py-3 text-sm font-medium border-b-2 ${
            kind === "buyers"
              ? "border-green-600 text-green-700"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Buyers
        </button>
      </div>

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_auto_auto_auto]">
        <label className="relative">
          <span className="sr-only">Search users</span>
          <Search
            aria-hidden="true"
            className="absolute left-3 top-3 h-5 w-5 text-gray-400"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setLoading(true);
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={
              kind === "buyers"
                ? "Search buyer, contact, or merchant"
                : "Search name or email"
            }
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200"
          />
        </label>
        {kind === "platform" && (
          <label>
            <span className="sr-only">Role</span>
            <select
              value={role}
              onChange={(event) => {
                setLoading(true);
                setRole(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="all">All roles</option>
              <option value="merchant">Merchant</option>
              <option value="user">User</option>
              <option value="superadmin">Superadmin</option>
              <option value="admin">Admin</option>
              <option value="platform_admin">Platform admin</option>
              <option value="support_agent">Support agent</option>
              <option value="finance_manager">Finance manager</option>
              <option value="content_manager">Content manager</option>
              <option value="moderator">Moderator</option>
              <option value="developer">Developer</option>
              <option value="analyst">Analyst</option>
            </select>
          </label>
        )}
        <label>
          <span className="sr-only">Status</span>
          <select
            value={status}
            onChange={(event) => {
              setLoading(true);
              setStatus(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="all">All statuses</option>
            {kind === "platform" ? (
              <>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </>
            ) : (
              <>
                <option value="unblocked">Unblocked</option>
                <option value="blocked">Blocked</option>
              </>
            )}
          </select>
        </label>
        <label>
          <span className="sr-only">Sort</span>
          <select
            value={sort}
            onChange={(event) => {
              setLoading(true);
              setSort(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
          </select>
        </label>
      </section>

      {actionError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {actionError}
        </div>
      )}
      {error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setRetryKey((key) => key + 1);
            }}
            className="mt-3 rounded border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <p className="text-sm text-gray-600" aria-live="polite">
              {loading ? "Loading accounts…" : `${total} result${total === 1 ? "" : "s"}`}
            </p>
          </div>
          {loading ? (
            <div className="space-y-3 p-5" aria-label="Loading users">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-12 animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-gray-600">
              No {kind === "buyers" ? "buyers" : "platform accounts"} match these filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="bg-gray-50 text-left text-sm text-gray-700">
                  {kind === "platform" ? (
                    <tr>
                      <th className="px-5 py-3 font-medium">Account</th>
                      <th className="px-5 py-3 font-medium">Role</th>
                      <th className="px-5 py-3 font-medium">Stores</th>
                      <th className="px-5 py-3 font-medium">Verified</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Joined</th>
                      <th className="px-5 py-3 font-medium">Details</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="px-5 py-3 font-medium">Buyer</th>
                      <th className="px-5 py-3 font-medium">Merchant</th>
                      <th className="px-5 py-3 font-medium">Orders</th>
                      <th className="px-5 py-3 font-medium">Spent</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Joined</th>
                      <th className="px-5 py-3 font-medium">Action</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kind === "platform"
                    ? activeUsers.map((account) => (
                        <tr key={account.id} className="hover:bg-gray-50">
                          <td className="px-5 py-4">
                            <p className="font-medium text-gray-900">{account.fullName}</p>
                            <p className="text-sm text-gray-600">{account.email}</p>
                          </td>
                          <td className="px-5 py-4 capitalize">{account.role.replaceAll("_", " ")}</td>
                          <td className="px-5 py-4">{account.storeCount}</td>
                          <td className="px-5 py-4">{account.isVerified ? "Verified" : "Pending"}</td>
                          <td className="px-5 py-4">
                            <span className={account.isActive ? "text-green-700" : "text-red-700"}>
                              {account.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-600">
                            {new Date(account.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-4">
                            <button
                              type="button"
                              aria-label={`View ${account.fullName}`}
                              onClick={() => router.push(`/my-admin/users/${account.id}`)}
                              className="rounded p-2 text-gray-600 hover:bg-gray-100 hover:text-blue-700"
                            >
                              <Eye size={16} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      ))
                    : buyers.map((buyer) => (
                        <tr key={`${buyer.storeId}:${buyer.id}`} className="hover:bg-gray-50">
                          <td className="px-5 py-4">
                            <p className="font-medium text-gray-900">{buyer.name}</p>
                            <p className="text-sm text-gray-600">{buyer.email || buyer.phone}</p>
                          </td>
                          <td className="px-5 py-4">
                            <p>{buyer.storeName}</p>
                            <p className="text-sm text-gray-600">/{buyer.storeSlug}</p>
                          </td>
                          <td className="px-5 py-4">{buyer.totalOrders ?? 0}</td>
                          <td className="px-5 py-4">
                            {buyer.totalSpent ?? "0"}
                          </td>
                          <td className="px-5 py-4">
                            <span className={buyer.isBlocked ? "text-red-700" : "text-green-700"}>
                              {buyer.isBlocked ? "Blocked" : "Unblocked"}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-600">
                            {new Date(buyer.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-4">
                            <button
                              type="button"
                              disabled={busyBuyer === buyer.id}
                              onClick={() => void toggleBuyerBlock(buyer)}
                              className={`rounded border px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                                buyer.isBlocked
                                  ? "border-green-300 text-green-700 hover:bg-green-50"
                                  : "border-red-300 text-red-700 hover:bg-red-50"
                              }`}
                            >
                              {busyBuyer === buyer.id
                                ? "Saving…"
                                : buyer.isBlocked
                                  ? "Unblock"
                                  : "Block"}
                            </button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
            <span className="text-sm text-gray-600">
              Page {pages === 0 ? 0 : page} of {pages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => {
                  setLoading(true);
                  setPage((value) => Math.max(1, value - 1));
                }}
                className="rounded border border-gray-300 p-2 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                disabled={page >= pages || loading}
                onClick={() => {
                  setLoading(true);
                  setPage((value) => Math.min(pages, value + 1));
                }}
                className="rounded border border-gray-300 p-2 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
