"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileBarChart, Download } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Store {
  id: string;
  storeName: string;
}

export default function ReportsPage() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState("sales");
  const [dateRange, setDateRange] = useState("30days");

  async function loadStores() {
    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/stores/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const data = await res.json();
        setStores(data.stores || []);
      }
    } catch (err) {
      console.error("Error loading stores:", err);
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStores();
  }, []);

  function handleExport() {
    alert(`Exporting ${reportType} report for ${dateRange}...`);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="h-40 bg-gray-100 animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports</h1>
          <p className="text-gray-600">Generate and export business reports</p>
        </div>
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <FileBarChart className="text-gray-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Create a Store First</h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">You need a store to generate reports.</p>
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports</h1>
        <p className="text-gray-600">Generate and export business reports</p>
      </div>

      <div className="card p-6 max-w-2xl">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="input"
            >
              <option value="sales">Sales Report</option>
              <option value="orders">Order Report</option>
              <option value="products">Product Report</option>
              <option value="customers">Customer Report</option>
              <option value="inventory">Inventory Report</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="input"
            >
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          <button onClick={handleExport} className="btn-primary flex items-center gap-2">
            <Download size={20} />
            Generate Report
          </button>
        </div>
      </div>
    </div>
  );
}
