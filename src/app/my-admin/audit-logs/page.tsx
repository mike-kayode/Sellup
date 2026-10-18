"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface AuditLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  previousValue: any;
  newValue: any;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  actorName: string;
  actorRole: string;
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
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

        const res = await fetch("/api/admin/audit-logs", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load audit logs");
        }
      } catch {
        setError("Failed to load audit logs");
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-gray-600 mt-2">Track all sensitive platform activities</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Action</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Resource</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Actor</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">IP Address</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-gray-400" />
                      <span className="font-medium text-gray-900 capitalize">{log.action.replace(/_/g, " ")}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-700 capitalize">{log.resourceType}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-gray-900">{log.actorName}</p>
                      <p className="text-sm text-gray-600 capitalize">{log.actorRole}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-700">{log.ipAddress || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {logs.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <p className="text-gray-600">No audit logs found</p>
          </div>
        )}
      </div>
    </div>
  );
}
