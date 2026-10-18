"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Eye, ExternalLink } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { storeHref } from "@/lib/urls";

interface Business {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isPublished: boolean;
  owner: string;
  ownerEmail: string;
  orders: number;
  revenue: number;
  createdAt: string;
  status: "active" | "inactive";
}

export default function AdminBusinessesPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

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

        const params = new URLSearchParams({
          search,
          plan: planFilter,
          status: statusFilter,
          page: String(page),
          limit: "20",
        });

        const res = await fetch(`/api/admin/businesses?${params}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setBusinesses(data.stores || []);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load businesses");
        }
      } catch {
        setError("Failed to load businesses");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [search, planFilter, statusFilter, page]);

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
        <h1 className="text-3xl font-bold text-gray-900">Businesses</h1>
        <p className="text-gray-600 mt-2">Manage all registered businesses and stores</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, owner, or slug..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => {
            setPlanFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="all">All Plans</option>
          <option value="freemium">Freemium</option>
          <option value="starter">Starter</option>
          <option value="business">Business</option>
          <option value="pro">Pro</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Business</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Owner</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Plan</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Orders</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Revenue</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {businesses.map((business) => (
                <tr key={business.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{business.name}</p>
                      <p className="text-sm text-gray-600">/{business.slug}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-gray-900">{business.owner}</p>
                      <p className="text-sm text-gray-600">{business.ownerEmail}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 capitalize">
                      {business.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{business.orders}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">₦{(business.revenue || 0).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    {business.status === "active" ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/my-admin/businesses/${business.id}`)}
                        className="text-gray-600 hover:text-blue-600 p-1 inline-flex items-center gap-1"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      <a
                        href={storeHref(business.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-600 hover:text-blue-600 p-1 inline-flex items-center gap-1"
                        title="View Store"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {businesses.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <p className="text-gray-600">No businesses found matching your criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}
