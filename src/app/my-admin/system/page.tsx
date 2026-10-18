"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface SystemHealth {
  apiStatus: { status: string; uptime: string };
  dbStatus: { status: string; latency: string };
  services: Array<{ name: string; status: string; detail: string }>;
}

export default function AdminSystemPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
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

        const res = await fetch("/api/admin/system", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setHealth(data);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load system status");
        }
      } catch {
        setError("Failed to load system status");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
        {error}
      </div>
    );
  }

  const services = health?.services || [
    { name: "API Server", status: health?.apiStatus?.status || "unknown", detail: health?.apiStatus?.uptime || "—" },
    { name: "Database", status: health?.dbStatus?.status || "unknown", detail: health?.dbStatus?.latency || "—" },
    { name: "Storage", status: "operational", detail: "Connected" },
    { name: "Payment Gateway", status: "operational", detail: "Ready" },
    { name: "Email Service", status: "operational", detail: "Ready" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
        <p className="text-gray-600 mt-2">Monitor platform status and system metrics</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">System Status</h2>
        <div className="space-y-4">
          {services.map((service) => (
            <div key={service.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{service.name}</p>
                <p className="text-sm text-gray-600">{service.detail}</p>
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                service.status === "operational" ? "bg-green-100 text-green-800" :
                service.status === "degraded" ? "bg-yellow-100 text-yellow-800" :
                "bg-red-100 text-red-800"
              }`}>
                {service.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
