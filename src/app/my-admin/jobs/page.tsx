"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Job {
  id: string;
  name: string;
  status: string;
  lastRun: string;
  nextRun: string;
  duration: string;
}

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
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

        const res = await fetch("/api/admin/jobs", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setJobs(data.jobs || []);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load jobs");
        }
      } catch {
        setError("Failed to load jobs");
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
          <h1 className="text-3xl font-bold text-gray-900">Background Jobs</h1>
          <p className="text-gray-600 mt-2">Monitor scheduled jobs and queues</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Job</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Last Run</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Next Run</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{job.name}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      job.status === "completed" ? "bg-green-100 text-green-800" :
                      job.status === "failed" ? "bg-red-100 text-red-800" :
                      job.status === "running" ? "bg-blue-100 text-blue-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {job.lastRun ? new Date(job.lastRun).toLocaleString() : "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {job.nextRun ? new Date(job.nextRun).toLocaleString() : "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{job.duration || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {jobs.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <p className="text-gray-600">No background jobs configured yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
