"use client";

import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Domain {
  id: string;
  storeName: string;
  storeSlug: string;
  domain: string;
  status: string;
  sslStatus: string | null;
  verificationStatus: string | null;
  disabledReason: string | null;
  canRetryTls: boolean;
  createdAt: string;
}

export default function AdminDomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retryingDomainId, setRetryingDomainId] = useState("");
  const [retryKey, setRetryKey] = useState(0);

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

        const res = await fetch("/api/admin/domains", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setDomains(data.domains || []);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load domains");
        }
      } catch {
        setError("Failed to load domains");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [retryKey]);

  async function retryTls(domain: Domain) {
    if (retryingDomainId || !window.confirm(`Ask Cloudflare to retry TLS validation for ${domain.domain}?`)) return;
    setRetryingDomainId(domain.id);
    setError("");
    setNotice("");
    try {
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch("/api/admin/domains", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "retry_tls", domainId: domain.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to retry TLS validation");
      setNotice(`TLS validation retry requested for ${domain.domain}.`);
      setRetryKey((key) => key + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Failed to retry TLS validation");
    } finally {
      setRetryingDomainId("");
    }
  }

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
        <h1 className="text-3xl font-bold text-gray-900">Domains</h1>
        <p className="text-gray-600 mt-2">Manage store domains</p>
      </div>
      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">{notice}</div>}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Store</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Domain</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">TLS</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Reason</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Created</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {domains.map((domain) => (
                <tr key={domain.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{domain.storeName}</p>
                      <p className="text-sm text-gray-600">/{domain.storeSlug}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-700">{domain.domain}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      domain.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                    }`}>
                      {domain.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm capitalize">{domain.sslStatus || "unknown"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{domain.disabledReason || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(domain.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    {domain.canRetryTls && domain.sslStatus !== "active" && <button
                      type="button"
                      disabled={Boolean(retryingDomainId)}
                      onClick={() => void retryTls(domain)}
                      className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                    >{retryingDomainId === domain.id ? "Requesting…" : "Retry TLS"}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {domains.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No domains configured yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
