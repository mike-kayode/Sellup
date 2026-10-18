"use client";

import { useEffect, useState } from "react";
import { Shield, Lock, Unlock, AlertTriangle } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface SecurityEvent {
  id: string;
  action: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  actorName: string;
}

export default function AdminSecurityPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
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

        const res = await fetch("/api/admin/security", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load security events");
        }
      } catch {
        setError("Failed to load security events");
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

  const stats = {
    failedLogins: events.filter((e) => e.action === "login_failed").length,
    lockedAccounts: events.filter((e) => e.action === "account_locked").length,
    suspiciousActivity: events.filter((e) => e.action === "suspicious_activity").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Security Center</h1>
        <p className="text-gray-600 mt-2">Monitor platform security and access events</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-50 text-red-600 rounded-lg">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Failed Logins</p>
              <p className="text-2xl font-bold text-gray-900">{stats.failedLogins}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-50 text-yellow-600 rounded-lg">
              <Lock size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Locked Accounts</p>
              <p className="text-2xl font-bold text-gray-900">{stats.lockedAccounts}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
              <Shield size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Suspicious Activity</p>
              <p className="text-2xl font-bold text-gray-900">{stats.suspiciousActivity}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Action</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Actor</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">IP Address</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium capitalize ${
                      event.action === "login_failed" ? "bg-red-100 text-red-800" :
                      event.action === "account_locked" ? "bg-yellow-100 text-yellow-800" :
                      event.action === "suspicious_activity" ? "bg-orange-100 text-orange-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {event.action.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{event.actorName}</td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-700">{event.ipAddress || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(event.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {events.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <p className="text-gray-600">No security events recorded</p>
          </div>
        )}
      </div>
    </div>
  );
}
