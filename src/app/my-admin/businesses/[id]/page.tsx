"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  CircleAlert,
  Globe,
  KeyRound,
  MessageSquareText,
  ShieldAlert,
  ShieldCheck,
  Store,
  Trash2,
  UserRound,
  Webhook,
} from "lucide-react";
import { getSupabaseClient, storeBrowserAdminImpersonation } from "@/lib/supabase/client";

type StatusAction = "suspend" | "restrict" | "restore" | "verify";

interface BusinessRecord {
  id: string;
  userId: string;
  storeName: string;
  storeSlug: string;
  plan: string | null;
  country: string | null;
  currency: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  isPublished: boolean | null;
  isSuspended: boolean | null;
  isRestricted: boolean | null;
  isVerified: boolean;
  statusReason: string | null;
  createdAt: string;
}

interface BusinessDetail {
  business: BusinessRecord;
  owner: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    role: string | null;
    isEmailVerified: boolean | null;
    createdAt: string;
  } | null;
  canImpersonate: boolean;
  stats: { orders: number; products: number; staff: number; revenue: string };
  subscription: { plan: string; status: string; currentPeriodEnd: string | null } | null;
  recentOrders: {
    id: string;
    orderNumber: string;
    total: string;
    status: string | null;
    paymentStatus: string | null;
    createdAt: string;
  }[];
  recentProducts: {
    id: string;
    name: string;
    price: string;
    isActive: boolean | null;
    createdAt: string;
  }[];
  domains: {
    id: string;
    domain: string;
    status: string;
    sslStatus: string | null;
    verificationStatus: string;
    dnsCheckedAt: string | null;
    expiresAt: string | null;
  }[];
  apiKeys: {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    isActive: boolean | null;
    lastUsedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
  }[];
  webhooks: {
    id: string;
    url: string;
    events: string[];
    status: string;
    lastDelivery: string | null;
    failureCount: number | null;
    createdAt: string;
  }[];
  aiUsage: {
    rangeDays: number;
    groups: {
      provider: string;
      feature: string;
      requests: number;
      inputTokens: number;
      outputTokens: number;
      costUsd: string;
    }[];
  };
  notes: {
    id: string;
    actorId: string | null;
    actorName: string | null;
    note: string;
    createdAt: string;
  }[];
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...init?.headers,
    },
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Request failed");
  }
  return result as T;
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "NGN",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function stateLabel(business: BusinessRecord) {
  if (business.isSuspended) return "Suspended";
  if (business.isRestricted) return "Restricted";
  return business.isPublished ? "Active" : "Inactive";
}

export default function AdminBusinessDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const businessId = params.id;
  const [detail, setDetail] = useState<BusinessDetail | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [statusAction, setStatusAction] = useState<StatusAction | null>(null);
  const [reason, setReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const [toast, setToast] = useState("");

  const loadDetail = useCallback(async () => {
    return adminFetch<BusinessDetail>(`/api/admin/businesses/${businessId}`);
  }, [businessId]);

  useEffect(() => {
    let active = true;
    void loadDetail()
      .then((data) => {
        if (active) {
          setDetail(data);
          setLoadedId(businessId);
          setError("");
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setLoadedId(businessId);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load business details"
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [businessId, loadDetail, retryKey]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  }

  async function updateStatus() {
    if (!statusAction || !reason.trim() || saving) return;
    setSaving(true);
    setMutationError("");
    try {
      await adminFetch(`/api/admin/businesses/${businessId}`, {
        method: "PUT",
        body: JSON.stringify({ action: statusAction, reason: reason.trim() }),
      });
      setStatusAction(null);
      setReason("");
      setDetail(await loadDetail());
      showToast(`Business ${statusAction} action completed.`);
    } catch (saveError) {
      setMutationError(
        saveError instanceof Error ? saveError.message : "Business update failed"
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteBusiness() {
    if (!detail || typedName !== detail.business.storeName || saving) return;
    setSaving(true);
    setMutationError("");
    try {
      await adminFetch(`/api/admin/businesses/${businessId}`, {
        method: "DELETE",
        body: JSON.stringify({ confirmation: typedName }),
      });
      router.replace("/my-admin/businesses");
      router.refresh();
    } catch (deleteError) {
      setMutationError(
        deleteError instanceof Error ? deleteError.message : "Delete failed"
      );
      setSaving(false);
    }
  }

  async function addNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteText.trim() || noteSaving) return;
    setNoteSaving(true);
    setMutationError("");
    try {
      await adminFetch(`/api/admin/businesses/${businessId}/notes`, {
        method: "POST",
        body: JSON.stringify({ note: noteText.trim() }),
      });
      setNoteText("");
      setDetail(await loadDetail());
      showToast("Internal note added.");
    } catch (noteError) {
      setMutationError(
        noteError instanceof Error ? noteError.message : "Could not add note"
      );
    } finally {
      setNoteSaving(false);
    }
  }

  async function startImpersonation() {
    if (!detail || impersonating) return;
    setImpersonating(true);
    setMutationError("");
    try {
      const result = await adminFetch<{
        impersonation: {
          token: string;
          storeId: string;
          storeName: string;
          merchantUserId: string;
          merchantEmail: string;
          merchantFullName: string;
          expiresAt: string;
        };
      }>("/api/admin/impersonation", {
        method: "POST",
        body: JSON.stringify({
          storeId: detail.business.id,
          durationMinutes: 60,
        }),
      });
      const session = result.impersonation;
      storeBrowserAdminImpersonation({
        accessToken: session.token,
        storeId: session.storeId,
        storeName: session.storeName,
        merchantUserId: session.merchantUserId,
        merchantEmail: session.merchantEmail,
        merchantFullName: session.merchantFullName,
        expiresAt: session.expiresAt,
      });
      router.push("/dashboard");
    } catch (impersonationError) {
      setMutationError(
        impersonationError instanceof Error
          ? impersonationError.message
          : "Could not start impersonation"
      );
      setImpersonating(false);
    }
  }

  if (loading || loadedId !== businessId) {
    return (
      <div className="space-y-6" aria-label="Loading business details">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-xl bg-slate-200" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700" role="alert">
        <p>{error || "Business details are unavailable."}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError("");
            setRetryKey((key) => key + 1);
          }}
          className="mt-4 rounded-lg border border-red-300 px-3 py-2 font-medium hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          Retry
        </button>
      </div>
    );
  }

  const business = detail.business;
  const statusActions: StatusAction[] = [];
  if (business.isSuspended || business.isRestricted) {
    statusActions.push("restore");
  } else {
    statusActions.push("suspend", "restrict");
  }
  if (!business.isVerified) statusActions.push("verify");

  return (
    <div className="space-y-6">
      {toast && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-800" role="status">
          {toast}
        </div>
      )}
      {mutationError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700" role="alert">
          {mutationError}
        </div>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back to businesses"
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {business.storeName}
            </h1>
            <p className="mt-1 text-gray-600">/{business.storeSlug}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm capitalize text-slate-700">
                {stateLabel(business)}
              </span>
              {business.isVerified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-800">
                  <ShieldCheck size={14} /> Verified
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-800">
                  Unverified
                </span>
              )}
              {business.statusReason && (
                <span className="text-sm text-gray-600">
                  Reason: {business.statusReason}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {detail.canImpersonate && (
            <button
              type="button"
              onClick={startImpersonation}
              disabled={impersonating}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {impersonating ? "Starting..." : "Impersonate merchant"}
            </button>
          )}
          {statusActions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => {
                setMutationError("");
                setStatusAction(action);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold capitalize text-gray-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {action}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setMutationError("");
              setDeleteOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Orders", value: detail.stats.orders.toLocaleString() },
          { label: "Products", value: detail.stats.products.toLocaleString() },
          { label: "Staff", value: detail.stats.staff.toLocaleString() },
          {
            label: "Paid order value",
            value: formatMoney(detail.stats.revenue, business.currency),
          },
        ].map((stat) => (
          <article key={stat.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-gray-600">{stat.label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{stat.value}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <UserRound size={19} className="text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Merchant owner</h2>
          </div>
          {detail.owner ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-gray-500">Name</dt>
                <dd className="font-medium text-gray-900">{detail.owner.fullName}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Email</dt>
                <dd className="font-medium text-gray-900">{detail.owner.email}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Phone</dt>
                <dd className="font-medium text-gray-900">{detail.owner.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Account</dt>
                <dd className="font-medium capitalize text-gray-900">
                  {detail.owner.role || "—"} ·{" "}
                  {detail.owner.isEmailVerified ? "Email verified" : "Email unverified"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Joined</dt>
                <dd className="font-medium text-gray-900">
                  {new Date(detail.owner.createdAt).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-gray-500">Owner record not found.</p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <Store size={19} className="text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Business and plan</h2>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-gray-500">Plan</dt>
              <dd className="font-medium capitalize text-gray-900">
                {detail.subscription?.plan || business.plan || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Subscription status</dt>
              <dd className="font-medium capitalize text-gray-900">
                {detail.subscription?.status || "No subscription"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Country / currency</dt>
              <dd className="font-medium text-gray-900">
                {business.country || "—"} · {business.currency}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Location</dt>
              <dd className="font-medium text-gray-900">
                {[business.city, business.state].filter(Boolean).join(", ") || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Email / phone</dt>
              <dd className="font-medium text-gray-900">
                {[business.email, business.phone].filter(Boolean).join(" · ") || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Created</dt>
              <dd className="font-medium text-gray-900">
                {new Date(business.createdAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent orders</h2>
        {detail.recentOrders.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="border-b bg-slate-50">
                <tr>
                  {["Order", "Total", "Order status", "Payment", "Date"].map((item) => (
                    <th key={item} className="px-3 py-2 text-left text-sm font-medium text-gray-600">
                      {item}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {detail.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-3 py-3 text-sm font-medium text-gray-900">
                      {order.orderNumber}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {formatMoney(order.total, business.currency)}
                    </td>
                    <td className="px-3 py-3 text-sm capitalize text-gray-700">
                      {order.status || "—"}
                    </td>
                    <td className="px-3 py-3 text-sm capitalize text-gray-700">
                      {order.paymentStatus || "—"}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-5 text-center text-sm text-gray-500">No orders yet.</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent products</h2>
        {detail.recentProducts.length ? (
          <ul className="divide-y">
            {detail.recentProducts.map((product) => (
              <li key={product.id} className="flex flex-wrap justify-between gap-2 py-3">
                <span className="font-medium text-gray-900">{product.name}</span>
                <span className="text-sm text-gray-600">
                  {formatMoney(product.price, business.currency)} ·{" "}
                  {product.isActive ? "Active" : "Inactive"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-5 text-center text-sm text-gray-500">No products yet.</p>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <Globe size={19} className="text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Domains</h2>
          </div>
          {detail.domains.length ? (
            <ul className="divide-y">
              {detail.domains.map((domain) => (
                <li key={domain.id} className="flex flex-wrap justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{domain.domain}</p>
                    <p className="text-sm text-gray-500">
                      DNS checked{" "}
                      {domain.dnsCheckedAt
                        ? new Date(domain.dnsCheckedAt).toLocaleDateString()
                        : "not yet"}
                    </p>
                  </div>
                  <span className="text-sm capitalize text-gray-700">
                    {domain.status} · TLS {domain.sslStatus || "unknown"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-gray-500">No custom domains.</p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound size={19} className="text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">API keys</h2>
          </div>
          {detail.apiKeys.length ? (
            <ul className="divide-y">
              {detail.apiKeys.map((key) => (
                <li key={key.id} className="flex flex-wrap justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{key.name}</p>
                    <p className="font-mono text-sm text-gray-500">{key.prefix}••••••</p>
                  </div>
                  <span className="text-sm text-gray-600">
                    {key.isActive ? "Active" : "Revoked"} ·{" "}
                    {key.lastUsedAt
                      ? `Used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                      : "Never used"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-gray-500">No API keys.</p>
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <Webhook size={19} className="text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Webhooks</h2>
          </div>
          {detail.webhooks.length ? (
            <ul className="divide-y">
              {detail.webhooks.map((webhook) => (
                <li key={webhook.id} className="py-3">
                  <p className="break-all font-medium text-gray-900">{webhook.url}</p>
                  <p className="text-sm text-gray-500">
                    {webhook.status} · {webhook.failureCount || 0} failures
                    {webhook.lastDelivery &&
                      ` · Last delivery ${new Date(webhook.lastDelivery).toLocaleDateString()}`}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-gray-500">No webhook endpoints.</p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            AI usage · last {detail.aiUsage.rangeDays} days
          </h2>
          {detail.aiUsage.groups.length ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-slate-50">
                  <tr>
                    {["Provider / feature", "Requests", "Tokens", "Cost (USD)"].map((item) => (
                      <th key={item} className="px-2 py-2 text-left text-xs font-medium text-gray-600">
                        {item}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {detail.aiUsage.groups.map((usage) => (
                    <tr key={`${usage.provider}-${usage.feature}`}>
                      <td className="px-2 py-3 text-sm text-gray-900">
                        {usage.provider} / {usage.feature}
                      </td>
                      <td className="px-2 py-3 text-sm text-gray-700">{usage.requests}</td>
                      <td className="px-2 py-3 text-sm text-gray-700">
                        {(usage.inputTokens + usage.outputTokens).toLocaleString()}
                      </td>
                      <td className="px-2 py-3 text-sm text-gray-700">${usage.costUsd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-4 text-sm text-gray-500">No AI usage in this period.</p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <MessageSquareText size={19} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Internal notes</h2>
        </div>
        <form onSubmit={addNote} className="space-y-3">
          <label className="block">
            <span className="sr-only">Add an internal note</span>
            <textarea
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              maxLength={3000}
              rows={3}
              placeholder="Add a note visible only to platform admins"
              className="w-full rounded-lg border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </label>
          <button
            type="submit"
            disabled={noteSaving || !noteText.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {noteSaving ? "Adding note..." : "Add internal note"}
          </button>
        </form>
        {detail.notes.length ? (
          <ul className="mt-5 divide-y">
            {detail.notes.map((note) => (
              <li key={note.id} className="py-4">
                <p className="whitespace-pre-wrap break-words text-sm text-gray-900">
                  {note.note}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {note.actorName || "Former admin"} ·{" "}
                  {new Date(note.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-sm text-gray-500">No internal notes yet.</p>
        )}
      </section>

      {statusAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setStatusAction(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="business-action-title"
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center gap-3">
              {statusAction === "verify" ? (
                <CheckCircle className="text-blue-600" />
              ) : (
                <ShieldAlert className="text-amber-600" />
              )}
              <h2 id="business-action-title" className="text-xl font-semibold capitalize text-gray-900">
                {statusAction} {business.storeName}
              </h2>
            </div>
            <label className="block text-sm font-medium text-gray-700">
              Required reason
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setStatusAction(null)}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={updateStatus}
                disabled={saving || !reason.trim()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold capitalize text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : `Confirm ${statusAction}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-business-title"
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="mb-3 flex items-center gap-2 text-red-700">
              <CircleAlert size={22} />
              <h2 id="delete-business-title" className="text-xl font-semibold">
                Permanently delete business?
              </h2>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              This also deletes related store data. Type{" "}
              <strong>{business.storeName}</strong> to confirm.
            </p>
            <label className="block text-sm font-medium text-gray-700">
              Business name confirmation
              <input
                value={typedName}
                onChange={(event) => setTypedName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteOpen(false);
                  setTypedName("");
                }}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteBusiness}
                disabled={saving || typedName !== business.storeName}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              >
                {saving ? "Deleting..." : "Delete business"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
