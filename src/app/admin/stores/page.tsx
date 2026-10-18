"use client";

import { useState, useEffect } from "react";
import { Search, Eye, Trash2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { storeHref } from "@/lib/urls";

interface Store {
  id: string;
  name: string;
  owner: string;
  slug: string;
  plan: string;
  orders: number;
  revenue: number;
  createdAt: string;
  status: "active" | "inactive";
  isPublished: boolean;
}

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStores() {
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

        const res = await fetch("/api/admin/stores", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setStores(data.stores || []);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load stores");
        }
      } catch (err) {
        setError("Failed to load stores");
      } finally {
        setLoading(false);
      }
    }
    loadStores();
  }, []);

  const filteredStores = stores.filter((store) => {
    const matchesSearch =
      store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      store.owner.toLowerCase().includes(searchTerm.toLowerCase()) ||
      store.slug.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = selectedPlan === "all" || store.plan === selectedPlan;
    return matchesSearch && matchesPlan;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
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
        <h1 className="text-3xl font-bold text-gray-900">Stores Management</h1>
        <p className="text-gray-600 mt-2">
          Monitor and manage all stores on the platform
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by store name, owner, or slug..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <select
          value={selectedPlan}
          onChange={(e) => setSelectedPlan(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="all">All Plans</option>
          <option value="freemium">Freemium</option>
          <option value="starter">Starter</option>
          <option value="business">Business</option>
          <option value="pro">Pro</option>
        </select>
      </div>

      {/* Stores Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                Store
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                Owner
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                Plan
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                Orders
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                Revenue
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                Status
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredStores.map((store) => (
              <tr key={store.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900">{store.name}</p>
                    <p className="text-sm text-gray-600">/{store.slug}</p>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-700">{store.owner}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {store.plan.charAt(0).toUpperCase() + store.plan.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-700">{store.orders}</td>
                <td className="px-6 py-4 font-medium text-gray-900">
                  ₦{(store.revenue || 0).toLocaleString()}
                </td>
                <td className="px-6 py-4">
                  {store.status === "active" ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 flex gap-2">
                  <a
                    href={storeHref(store.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-blue-600 p-1"
                    title="View Store"
                  >
                    <Eye className="w-4 h-4" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredStores.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-12 text-center">
          <p className="text-gray-600">
            No stores found matching your criteria
          </p>
        </div>
      )}
    </div>
  );
}
