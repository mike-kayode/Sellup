"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Job {
  id: string;
  name: string;
  status: string;
  type: string;
  attempts: number | null;
  maxAttempts: number | null;
  error: string | null;
  lastRun: string;
  nextRun: string;
  duration: string;
}

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
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

        const params = new URLSearchParams({ status: statusFilter, page: String(page), limit: "50" });
        const res = await fetch(`/api/admin/jobs?${params}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setJobs(data.jobs || []);
          setTotal(data.total || 0);
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
  }, [page, retryKey, statusFilter]);

  async function act(job: Job, action: "retry" | "cancel") {
    if (busyId) return;
    if (!window.confirm(`${action === "retry" ? "Retry" : "Cancel"} "${job.name}"?`)) return;
    const reason = window.prompt(`Reason for ${action}`);
    if (!reason?.trim()) return;
    setBusyId(job.id);
    setError("");
    setNotice("");
    try {
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch("/api/admin/jobs", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, action, reason: reason.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Failed to ${action} job`);
      setNotice(`Job ${action} requested.`);
      setRetryKey((key) => key + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Failed to ${action} job`);
    } finally {
      setBusyId("");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
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
        <button type="button" onClick={() => setRetryKey((key) => key + 1)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error} <button type="button" className="ml-2 underline" onClick={() => setRetryKey((key) => key + 1)}>Retry</button></div>}
      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">{notice}</div>}
      <select aria-label="Filter jobs by status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="rounded-lg border px-3 py-2">
        <option value="all">All statuses</option>
        {["pending", "running", "failed", "completed", "cancelled"].map((item) => <option key={item} value={item}>{item}</option>)}
      </select>

      {loading ? <div className="h-64 animate-pulse rounded-xl bg-gray-100" /> : <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Job</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Last Run</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Next Run</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Duration</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Attempts</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
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
                  <td className="px-6 py-4 text-sm text-gray-700">{job.attempts ?? 0}/{job.maxAttempts ?? 3}</td>
                  <td className="px-6 py-4">
                    {job.error && <p className="mb-1 max-w-xs truncate text-xs text-red-700" title={job.error}>{job.error}</p>}
                    {job.status === "failed" && (job.attempts ?? 0) < (job.maxAttempts ?? 3) && <button type="button" disabled={Boolean(busyId)} onClick={() => void act(job, "retry")} className="mr-2 rounded border px-2 py-1 text-xs disabled:opacity-50">{busyId === job.id ? "Saving…" : "Retry"}</button>}
                    {job.status === "pending" && <button type="button" disabled={Boolean(busyId)} onClick={() => void act(job, "cancel")} className="rounded border px-2 py-1 text-xs text-red-700 disabled:opacity-50">Cancel</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{total} jobs · page {page} of {Math.max(1, Math.ceil(total / 50))}</span>
          <div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded border px-3 py-2 disabled:opacity-50">Previous</button><button type="button" disabled={page * 50 >= total} onClick={() => setPage((value) => value + 1)} className="rounded border px-3 py-2 disabled:opacity-50">Next</button></div>
        </div>
        {jobs.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <p className="text-gray-600">No background jobs configured yet</p>
          </div>
        )}
      </div>}
    </div>
  );
}
