"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileBarChart } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Store {
  id: string;
  storeName: string;
}

interface Order {
  id: string;
  orderNumber: string;
  total: string;
  status: string | null;
  paymentStatus: string | null;
  items: unknown;
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  price: string;
  stock: number;
  isActive: boolean;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  totalOrders: number;
  totalSpent: string;
  createdAt: string;
}

type ReportType = "sales" | "orders" | "products" | "customers" | "inventory";
type DateRange = "today" | "7days" | "30days" | "thisMonth" | "custom";

interface DailySales {
  date: string;
  orders: Order[];
  revenue: number;
  orderCount: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function makeCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function currency(value: number): string {
  return `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

export default function ReportsPage() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [loadingStores, setLoadingStores] = useState(true);
  const [loadingSales, setLoadingSales] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("sales");
  const [dateRange, setDateRange] = useState<DateRange>("30days");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");

  const getToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    return session?.access_token || null;
  }, []);

  useEffect(() => {
    let active = true;
    async function loadStores() {
      try {
        const token = await getToken();
        if (!token) {
          router.push("/login");
          return;
        }
        const response = await fetch("/api/stores/list", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load stores");
        if (!active) return;
        const list: Store[] = data.stores || [];
        setStores(list);
        if (list.length > 0) setSelectedStoreId(list[0].id);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load stores");
        }
      } finally {
        if (active) setLoadingStores(false);
      }
    }
    void loadStores();
    return () => { active = false; };
  }, [router, getToken]);

  const dateBounds = useMemo(() => {
    const now = new Date();
    let start: Date;
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dateRange === "custom") {
      start = new Date(`${customStart}T00:00:00`);
      const customEndDate = new Date(`${customEnd}T00:00:00`);
      if (
        !customStart ||
        !customEnd ||
        !Number.isFinite(start.getTime()) ||
        !Number.isFinite(customEndDate.getTime()) ||
        start > customEndDate
      ) return null;
      end.setTime(customEndDate.getTime());
    } else if (dateRange === "today") {
      start = new Date(end);
    } else if (dateRange === "thisMonth") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      const days = dateRange === "7days" ? 7 : 30;
      start = new Date(end);
      start.setDate(start.getDate() - days + 1);
    }
    const dayCount = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    if (dayCount > 366) return null;
    return { start, end, dayCount };
  }, [dateRange, customStart, customEnd]);

  useEffect(() => {
    let active = true;
    async function loadSales() {
      if (!selectedStoreId) return;
      setLoadingSales(true);
      setError("");
      try {
        const token = await getToken();
        if (!token) {
          router.push("/login");
          return;
        }
        const response = await fetch("/api/orders/list", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ storeId: selectedStoreId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load sales");
        if (active) setOrders(data.orders || []);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load sales data");
        }
      } finally {
        if (active) setLoadingSales(false);
      }
    }
    void loadSales();
    return () => { active = false; };
  }, [selectedStoreId, router, getToken]);

  const dailySales = useMemo<DailySales[]>(() => {
    if (!dateBounds) return [];
    const grouped = new Map<string, Order[]>();
    for (const order of orders) {
      const key = localDateKey(new Date(order.createdAt));
      if (key < localDateKey(dateBounds.start) || key > localDateKey(dateBounds.end)) continue;
      grouped.set(key, [...(grouped.get(key) || []), order]);
    }

    return Array.from({ length: dateBounds.dayCount }, (_, index) => {
      const day = new Date(dateBounds.start);
      day.setDate(day.getDate() + index);
      const date = localDateKey(day);
      const dayOrders = (grouped.get(date) || []).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const totals = dayOrders.map((order) => Number(order.total) || 0);
      return {
        date,
        orders: dayOrders,
        revenue: totals.reduce((sum, total) => sum + total, 0),
        orderCount: dayOrders.length,
        open: totals[0] ?? 0,
        high: totals.length ? Math.max(...totals) : 0,
        low: totals.length ? Math.min(...totals) : 0,
        close: totals.at(-1) ?? 0,
      };
    });
  }, [orders, dateBounds]);

  const revenueTotal = dailySales.reduce((sum, day) => sum + day.revenue, 0);
  const orderTotal = dailySales.reduce((sum, day) => sum + day.orderCount, 0);
  const revenueMax = Math.max(1, ...dailySales.map((day) => day.revenue));
  const countMax = Math.max(1, ...dailySales.map((day) => day.orderCount));

  async function authedList(path: string, token: string, body: object) {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to generate report");
    return data;
  }

  async function handleExport() {
    setGenerating(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) {
        router.push("/login");
        return;
      }
      let filename = `${reportType}-report.csv`;
      let csv = "";
      if (reportType === "products" || reportType === "inventory") {
        const data = await authedList("/api/products/list", token, { storeId: selectedStoreId });
        const products: Product[] = data.products || [];
        csv = reportType === "inventory"
          ? makeCsv(["Product", "SKU", "Stock", "Unit price", "Active"], products.map((p) => [p.name, p.sku, p.stock, p.price, p.isActive]))
          : makeCsv(["Product", "SKU", "Price", "Stock", "Active"], products.map((p) => [p.name, p.sku, p.price, p.stock, p.isActive]));
      } else if (reportType === "customers") {
        let allCustomers: Customer[] = [];
        let offset = 0;
        let total = 0;
        do {
          const data = await authedList("/api/customers/list", token, {
            storeId: selectedStoreId,
            limit: 100,
            offset,
          });
          allCustomers = allCustomers.concat(data.customers || []);
          total = data.total || 0;
          offset += data.limit || 100;
        } while (offset < total);
        csv = makeCsv(
          ["Name", "Phone", "Email", "Orders", "Total spent", "Customer since"],
          allCustomers.map((customer) => [
            customer.name,
            customer.phone,
            customer.email,
            customer.totalOrders,
            customer.totalSpent,
            customer.createdAt,
          ])
        );
      } else {
        const selectedOrders = dailySales.flatMap((day) => day.orders);
        filename = `${reportType}-report-${dateRange}.csv`;
        csv = makeCsv(
          ["Order number", "Date", "Status", "Payment status", "Total"],
          selectedOrders.map((order) => [
            order.orderNumber,
            order.createdAt,
            order.status,
            order.paymentStatus,
            order.total,
          ])
        );
      }

      const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  }

  if (loadingStores) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600">Generate and export business reports</p>
        </div>
        <div className="card p-12 text-center">
          <FileBarChart className="mx-auto mb-4 text-gray-400" size={32} />
          <h2 className="mb-2 text-2xl font-bold text-gray-900">Create a Store First</h2>
          <p className="mx-auto mb-8 max-w-md text-gray-600">You need a store to generate reports.</p>
          <button onClick={() => router.push("/dashboard/stores")} className="btn-primary">
            Create Store
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-600">Review actual sales activity and export your business data.</p>
      </div>

      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card mb-8 grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900">Store</label>
          <select value={selectedStoreId} onChange={(e) => setSelectedStoreId(e.target.value)} className="input">
            {stores.map((store) => <option key={store.id} value={store.id}>{store.storeName}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900">Report Type</label>
          <select value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)} className="input">
            <option value="sales">Sales Report</option>
            <option value="orders">Order Report</option>
            <option value="products">Product Report</option>
            <option value="customers">Customer Report</option>
            <option value="inventory">Inventory Report</option>
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900">Date Range</label>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRange)} className="input">
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="thisMonth">This Month</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={handleExport} disabled={generating || loadingSales || !dateBounds} className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-50">
            <Download size={18} />
            {generating ? "Generating…" : "Generate Report"}
          </button>
        </div>
        {dateRange === "custom" && (
          <>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">From</label>
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="input" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">To</label>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="input" />
            </div>
          </>
        )}
        {!dateBounds && <p className="text-sm text-red-600 sm:col-span-2">Choose a valid date range of 366 days or less.</p>}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="text-sm text-gray-600">Sales in selected range</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{loadingSales ? "Loading…" : currency(revenueTotal)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-600">Orders in selected range</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{loadingSales ? "Loading…" : orderTotal.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid gap-6">
        <section className="card p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="font-bold text-gray-900">Daily sales histogram</h2>
            <p className="text-sm text-gray-500">Revenue is calculated from recorded orders for each day.</p>
          </div>
          {dailySales.length === 0 || !orderTotal ? (
            <div className="grid h-56 place-items-center text-sm text-gray-500">
              {loadingSales ? "Loading sales…" : "No sales in this date range."}
            </div>
          ) : (
            <svg viewBox="0 0 900 250" className="h-56 w-full" role="img" aria-label="Daily sales histogram">
              {dailySales.map((day, index) => {
                const step = 900 / dailySales.length;
                const height = (day.revenue / revenueMax) * 205;
                return (
                  <g key={day.date}>
                    <rect
                      x={index * step + step * 0.14}
                      y={220 - height}
                      width={Math.max(1, step * 0.72)}
                      height={height}
                      rx="2"
                      fill="#25D366"
                    >
                      <title>{day.date}: {currency(day.revenue)}</title>
                    </rect>
                    {(index === 0 || index === dailySales.length - 1 || index % Math.ceil(dailySales.length / 6) === 0) && (
                      <text x={index * step + step / 2} y="242" textAnchor="middle" fontSize="11" fill="#64748b">
                        {day.date.slice(5)}
                      </text>
                    )}
                  </g>
                );
              })}
              <line x1="0" y1="220.5" x2="900" y2="220.5" stroke="#e2e8f0" />
            </svg>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="font-bold text-gray-900">Daily sales candlesticks</h2>
            <p className="text-sm text-gray-500">Open, high, low and close reflect individual order totals for each day.</p>
          </div>
          {dailySales.every((day) => day.orderCount === 0) ? (
            <div className="grid h-56 place-items-center text-sm text-gray-500">
              {loadingSales ? "Loading sales…" : "No sales in this date range."}
            </div>
          ) : (
            <svg viewBox="0 0 900 250" className="h-56 w-full" role="img" aria-label="Daily sales candlestick chart">
              {dailySales.map((day, index) => {
                if (!day.orderCount) return null;
                const step = 900 / dailySales.length;
                const candleWidth = Math.max(2, Math.min(12, step * 0.56));
                const max = Math.max(1, ...dailySales.map((item) => item.high));
                const y = (value: number) => 215 - (value / max) * 200;
                const top = Math.min(y(day.open), y(day.close));
                const bodyHeight = Math.max(2, Math.abs(y(day.open) - y(day.close)));
                const color = day.close >= day.open ? "#16a34a" : "#dc2626";
                return (
                  <g key={day.date} stroke={color} fill={color}>
                    <line x1={index * step + step / 2} x2={index * step + step / 2} y1={y(day.high)} y2={y(day.low)} strokeWidth="2">
                      <title>{day.date}: open {currency(day.open)}, high {currency(day.high)}, low {currency(day.low)}, close {currency(day.close)}</title>
                    </line>
                    <rect x={index * step + (step - candleWidth) / 2} y={top} width={candleWidth} height={bodyHeight} />
                  </g>
                );
              })}
              <line x1="0" y1="215.5" x2="900" y2="215.5" stroke="#e2e8f0" />
            </svg>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="font-bold text-gray-900">Orders per day</h2>
            <p className="text-sm text-gray-500">Count of recorded orders, calculated from the selected store&apos;s order history.</p>
          </div>
          {dailySales.length === 0 || !orderTotal ? (
            <div className="grid h-56 place-items-center text-sm text-gray-500">
              {loadingSales ? "Loading orders…" : "No orders in this date range."}
            </div>
          ) : (
            <svg viewBox="0 0 900 250" className="h-56 w-full" role="img" aria-label="Orders per day bar chart">
              {dailySales.map((day, index) => {
                const step = 900 / dailySales.length;
                const height = (day.orderCount / countMax) * 205;
                return (
                  <g key={day.date}>
                    <rect
                      x={index * step + step * 0.14}
                      y={220 - height}
                      width={Math.max(1, step * 0.72)}
                      height={height}
                      rx="2"
                      fill="#3b82f6"
                    >
                      <title>{day.date}: {day.orderCount} orders</title>
                    </rect>
                    {(index === 0 || index === dailySales.length - 1 || index % Math.ceil(dailySales.length / 6) === 0) && (
                      <text x={index * step + step / 2} y="242" textAnchor="middle" fontSize="11" fill="#64748b">
                        {day.date.slice(5)}
                      </text>
                    )}
                  </g>
                );
              })}
              <line x1="0" y1="220.5" x2="900" y2="220.5" stroke="#e2e8f0" />
            </svg>
          )}
        </section>
      </div>
    </div>
  );
}
