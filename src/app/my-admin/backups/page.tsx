"use client";

import { useEffect, useState } from "react";
import { HardDrive, Download, Clock } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Backup {
  id: string;
  name: string;
  size: string;
  status: string;
  createdAt: string;
}

export default function AdminBackupsPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
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

        const res = await fetch("/api/admin/backups", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setBackups(data.backups || []);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load backups");
        }
      } catch {
        setError("Failed to load backups");
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Backups</h1>
          <p className="text-gray-600 mt-2">Database backup history and management</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#1da851] transition-colors">
          <Download size={18} />
          Create Backup
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Size</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {backups.map((backup) => (
                <tr key={backup.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <HardDrive size={16} className="text-gray-400" />
                      <span className="font-medium text-gray-900">{backup.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{backup.size}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      backup.status === "completed" ? "bg-green-100 text-green-800" :
                      backup.status === "failed" ? "bg-red-100 text-red-800" :
                      "bg-yellow-100 text-yellow-800"
                    }`}>
                      {backup.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Clock size={14} className="text-gray-400" />
                      {new Date(backup.createdAt).toLocaleString()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {backups.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <HardDrive className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No backups found</p>
          </div>
        )}
      </div>
    </div>
  );
}
