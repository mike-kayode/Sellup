"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  BriefcaseBusiness,
  DollarSign,
  Globe,
  RefreshCw,
  ShoppingCart,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

type CurrencyAmount = { currency: string | null; amount: string };
type DailyMetric = { date: string; orders: number; gmv: string };
type AlertJob = { id: string; name: string; createdAt: string };
type AlertWebhook = { id: string; event: string; createdAt: string };
type AlertDomain = { id: string; domain: string; expiresAt: string | null };

interface OverviewData {
  range: number;
  currency: string;
  stats: {
    merchants: number;
    activeStores: number;
    gmv: string;
    orders: number;
    mrrByCurrency: CurrencyAmount[];
    newSignups: number;
    failedPayments: number;
  };
  daily: DailyMetric[];
  alerts: {
    failedJobs: AlertJob[];
    failingWebhooks: AlertWebhook[];
    expiringDomains: AlertDomain[];
  };
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function TrendChart({
  title,
  points,
  color,
  formatValue,
}: {
  title: string;
  points: { date: string; value: number }[];
  color: string;
  formatValue: (value: number) => string;
}) {
  const max = Math.max(1, ...points.map((point) => point.value));
  const coordinates = points
    .map((point, index) => {
      const x = points.length < 2 ? 400 : (index / (points.length - 1)) * 780 + 10;
      const y = 160 - (point.value / max) * 140;
      return `${x},${y}`;
    })
    .join(" ");
  const hasValues = points.some((point) => point.value > 0);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {hasValues && (
          <span className="text-sm text-gray-500">
            Peak {formatValue(max)}
          </span>
        )}
      </div>
      {hasValues ? (
        <>
          <svg
            viewBox="0 0 800 180"
            className="h-48 w-full"
            role="img"
            aria-label={`${title} trend`}
            preserveAspectRatio="none"
          >
            <line x1="10" y1="160" x2="790" y2="160" stroke="#e2e8f0" />
            <polyline
              points={coordinates}
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{points[0]?.date}</span>
            <span>{points[points.length - 1]?.date}</span>
          </div>
        </>
      ) : (
        <div className="flex h-48 items-center justify-center rounded-lg bg-slate-50 text-sm text-gray-500">
          No activity in this period yet.
        </div>
      )}
    </section>
  );
}

function AlertSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          {count}
        </span>
      </div>
      {count ? (
        <ul className="space-y-3">{children}</ul>
      ) : (
        <p className="text-sm text-gray-500">No alerts.</p>
      )}
    </section>
  );
}

export default function AdminDashboardPage() {
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadOverview() {
      setLoading(true);
      setError("");
      try {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error("Not authenticated");
        }

        const response = await fetch(`/api/admin/overview?range=${range}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Failed to load dashboard data");
        }
        if (active) setData(result);
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load dashboard data"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadOverview();
    return () => {
      active = false;
    };
  }, [range, retryKey]);

  if (loading) {
    return (
      <div className="space-y-6" aria-label="Loading dashboard">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 7 }, (_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white"
            />
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-64 animate-pulse rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700"
        role="alert"
      >
        <p>{error || "Dashboard data is unavailable."}</p>
        <button
          type="button"
          onClick={() => setRetryKey((key) => key + 1)}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 font-medium hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <RefreshCw size={16} />
          Retry
        </button>
      </div>
    );
  }

  const metrics = [
    {
      label: "Merchants",
      value: data.stats.merchants.toLocaleString(),
      icon: Users,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Active Stores",
      value: data.stats.activeStores.toLocaleString(),
      icon: Store,
      color: "bg-green-50 text-green-600",
    },
    {
      label: `GMV (${data.currency})`,
      value: formatMoney(data.stats.gmv, data.currency),
      icon: DollarSign,
      color: "bg-orange-50 text-orange-600",
    },
    {
      label: "Orders",
      value: data.stats.orders.toLocaleString(),
      icon: ShoppingCart,
      color: "bg-purple-50 text-purple-600",
    },
    {
      label: "Monthly Recurring Revenue",
      value: data.stats.mrrByCurrency.length
        ? data.stats.mrrByCurrency
            .map((entry) =>
              formatMoney(entry.amount, entry.currency || data.currency)
            )
            .join(" · ")
        : formatMoney("0", data.currency),
      icon: TrendingUp,
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      label: `New Sign-ups (${range} days)`,
      value: data.stats.newSignups.toLocaleString(),
      icon: BriefcaseBusiness,
      color: "bg-cyan-50 text-cyan-700",
    },
    {
      label: `Failed Payments (${range} days)`,
      value: data.stats.failedPayments.toLocaleString(),
      icon: AlertCircle,
      color: "bg-red-50 text-red-600",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="mt-2 text-gray-600">Platform metrics and operational alerts</p>
        </div>
        <div className="flex items-center gap-2" aria-label="Dashboard date range">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={range === days}
              onClick={() => setRange(days as 7 | 30 | 90)}
              className={`rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500 ${
                range === days
                  ? "bg-[#25D366] text-white"
                  : "border border-slate-200 bg-white text-gray-700 hover:bg-slate-50"
              }`}
            >
              {days} days
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article
              key={metric.label}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-600">{metric.label}</p>
                  <p className="mt-2 break-words text-2xl font-bold text-gray-900">
                    {metric.value}
                  </p>
                </div>
                <span className={`rounded-lg p-3 ${metric.color}`}>
                  <Icon size={22} aria-hidden="true" />
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <TrendChart
          title="Daily Orders"
          points={data.daily.map((point) => ({
            date: point.date,
            value: point.orders,
          }))}
          color="#7c3aed"
          formatValue={(value) => value.toLocaleString()}
        />
        <TrendChart
          title={`Daily GMV (${data.currency})`}
          points={data.daily.map((point) => ({
            date: point.date,
            value: Number(point.gmv),
          }))}
          color="#16a34a"
          formatValue={(value) => formatMoney(String(value), data.currency)}
        />
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity size={20} className="text-gray-500" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-gray-900">Alerts</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <AlertSection title="Failed Jobs" count={data.alerts.failedJobs.length}>
            {data.alerts.failedJobs.map((job) => (
              <li key={job.id} className="text-sm">
                <p className="font-medium text-gray-900">{job.name}</p>
                <p className="text-gray-500">
                  Failed · {new Date(job.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </AlertSection>
          <AlertSection
            title="Failing Webhooks"
            count={data.alerts.failingWebhooks.length}
          >
            {data.alerts.failingWebhooks.map((webhook) => (
              <li key={webhook.id} className="text-sm">
                <p className="font-medium text-gray-900">{webhook.event}</p>
                <p className="text-gray-500">
                  Failed · {new Date(webhook.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </AlertSection>
          <AlertSection
            title="Domains Expiring Soon"
            count={data.alerts.expiringDomains.length}
          >
            {data.alerts.expiringDomains.map((domain) => (
              <li key={domain.id} className="flex items-start gap-2 text-sm">
                <Globe size={16} className="mt-0.5 text-gray-400" aria-hidden="true" />
                <div>
                  <p className="font-medium text-gray-900">{domain.domain}</p>
                  <p className="text-gray-500">
                    Expires{" "}
                    {domain.expiresAt
                      ? new Date(domain.expiresAt).toLocaleDateString()
                      : "soon"}
                  </p>
                </div>
              </li>
            ))}
          </AlertSection>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/my-admin/businesses", label: "Businesses" },
            { href: "/my-admin/users", label: "Users" },
            { href: "/my-admin/orders", label: "Orders" },
            { href: "/my-admin/payments", label: "Payments" },
          ].map((action) => (
            <a
              key={action.href}
              href={action.href}
              className="rounded-lg border border-slate-200 p-4 text-left transition hover:border-[#25D366] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <p className="font-medium text-gray-900">{action.label}</p>
              <p className="mt-1 text-sm text-gray-600">
                Manage {action.label.toLowerCase()}
              </p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
