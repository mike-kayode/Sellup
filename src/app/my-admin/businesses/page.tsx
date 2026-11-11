"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, ExternalLink, Search } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { storeHref } from "@/lib/urls";

interface Business {
  id: string;
  name: string;
  slug: string;
  plan: string;
  country: string | null;
  currency: string;
  isPublished: boolean | null;
  isSuspended: boolean | null;
  isRestricted: boolean | null;
  isVerified: boolean;
  statusReason: string | null;
  owner: string;
  ownerEmail: string;
  orders: number;
  revenue: string;
  createdAt: string;
  state: "active" | "inactive" | "suspended" | "restricted";
}

interface BusinessListResponse {
  businesses: Business[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  planOptions: string[];
  countryOptions: string[];
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "NGN",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

const stateStyle: Record<Business["state"], string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-slate-100 text-slate-700",
  suspended: "bg-red-100 text-red-800",
  restricted: "bg-amber-100 text-amber-800",
};

export default function AdminBusinessesPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [planOptions, setPlanOptions] = useState<string[]>([]);
  const [countryOptions, setCountryOptions] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Not authenticated");

        const params = new URLSearchParams({
          search,
          plan: planFilter,
          country: countryFilter.trim(),
          status: statusFilter,
          sort,
          page: String(page),
          limit: "20",
        });
        const response = await fetch(`/api/admin/businesses?${params}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Failed to load businesses");
        }

        const data: BusinessListResponse = result;
        if (active) {
          setBusinesses(data.businesses);
          setPlanOptions(data.planOptions);
          setCountryOptions(data.countryOptions);
          setTotal(data.total);
          setPages(data.pages);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load businesses"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [
    search,
    planFilter,
    countryFilter,
    statusFilter,
    sort,
    page,
    retryKey,
  ]);

  function resetPage(update: () => void) {
    update();
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Businesses</h1>
        <p className="mt-2 text-gray-600">
          Search and manage merchant businesses
        </p>
      </header>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Search businesses and owners</span>
          <Search
            className="absolute left-3 top-3 h-5 w-5 text-gray-400"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search business, slug, owner, or email"
            value={search}
            onChange={(event) =>
              resetPage(() => setSearch(event.target.value))
            }
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </label>
        <label>
          <span className="sr-only">Filter by plan</span>
          <select
            value={planFilter}
            onChange={(event) =>
              resetPage(() => setPlanFilter(event.target.value))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All plans</option>
            {planOptions.map((plan) => (
              <option key={plan} value={plan}>
                {plan}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by country</span>
          <input
            list="business-countries"
            value={countryFilter}
            onChange={(event) =>
              resetPage(() => setCountryFilter(event.target.value))
            }
            placeholder="All countries"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <datalist id="business-countries">
            {countryOptions.map((country) => (
              <option key={country} value={country} />
            ))}
          </datalist>
        </label>
        <label>
          <span className="sr-only">Filter by status</span>
          <select
            value={statusFilter}
            onChange={(event) =>
              resetPage(() => setStatusFilter(event.target.value))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
            <option value="restricted">Restricted</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Sort businesses</span>
          <select
            value={sort}
            onChange={(event) => resetPage(() => setSort(event.target.value))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name A–Z</option>
          </select>
        </label>
      </div>

      {error && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"
          role="alert"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setRetryKey((key) => key + 1)}
            className="rounded-lg border border-red-300 px-3 py-2 font-medium hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Retry
          </button>
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="border-b bg-gray-50">
              <tr>
                {[
                  "Business",
                  "Owner",
                  "Plan / country",
                  "Orders",
                  "GMV",
                  "Status",
                  "Actions",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-5 py-3 text-left text-sm font-medium text-gray-700"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading
                ? Array.from({ length: 5 }, (_, index) => (
                    <tr key={index}>
                      {Array.from({ length: 7 }, (_, cell) => (
                        <td key={cell} className="px-5 py-5">
                          <div className="h-4 animate-pulse rounded bg-slate-200" />
                        </td>
                      ))}
                    </tr>
                  ))
                : businesses.map((business) => (
                    <tr key={business.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-900">
                          {business.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          /{business.slug}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-gray-900">{business.owner}</p>
                        <p className="text-sm text-gray-500">
                          {business.ownerEmail}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="capitalize text-gray-900">
                          {business.plan || "—"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {business.country || "Country not set"}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-gray-700">
                        {business.orders.toLocaleString()}
                      </td>
                      <td className="px-5 py-4 font-medium text-gray-900">
                        {formatMoney(business.revenue, business.currency)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${stateStyle[business.state]}`}
                          >
                            {business.state}
                          </span>
                          {business.isVerified && (
                            <span className="text-xs font-medium text-blue-700">
                              Verified
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              router.push(`/my-admin/businesses/${business.id}`)
                            }
                            aria-label={`View ${business.name}`}
                            className="rounded p-2 text-gray-600 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <Eye size={17} />
                          </button>
                          <a
                            href={storeHref(business.slug)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${business.name} storefront`}
                            className="rounded p-2 text-gray-600 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <ExternalLink size={17} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {!loading && businesses.length === 0 && !error && (
          <div className="p-12 text-center">
            <p className="font-medium text-gray-900">No businesses found</p>
            <p className="mt-1 text-sm text-gray-600">
              Try changing or clearing the filters.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
          <p className="text-sm text-gray-600">
            {total.toLocaleString()} businesses · Page {page} of{" "}
            {Math.max(1, pages)}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={loading || page <= 1}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pages, current + 1))}
              disabled={loading || page >= pages}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
