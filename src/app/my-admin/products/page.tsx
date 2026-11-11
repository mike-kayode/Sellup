"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Eye } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: string;
  stock: number;
  isActive: boolean;
  isFlagged: boolean;
  flagReason: string | null;
  storeName: string;
  categoryName: string | null;
  createdAt: string;
}

export default function AdminProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

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

        const params = new URLSearchParams({ search, status, limit: "20", page: String(page) });
        const res = await fetch(`/api/admin/products?${params}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setProducts(data.products || []);
          setTotal(data.total || 0);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load products");
        }
      } catch {
        setError("Failed to load products");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [search, status, page, retryKey]);

  async function moderate(product: Product, action: "flag" | "unflag" | "suspend" | "unsuspend") {
    if (busyId) return;
    const destructive = action === "suspend" || action === "unflag";
    if (destructive && !window.confirm(`${action === "unflag" ? "Clear the moderation flag for" : "Unpublish"} ${product.name}?`)) return;
    const reason = window.prompt(`Reason for ${action} on "${product.name}"`);
    if (!reason?.trim()) return;

    setBusyId(product.id);
    setNotice("");
    setError("");
    try {
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch("/api/admin/moderation", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productIds: [product.id], action, reason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Moderation action failed");
      setNotice(`Product ${action} successful.`);
      setRetryKey((key) => key + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Moderation action failed");
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
        <h1 className="text-3xl font-bold text-gray-900">Platform Products</h1>
        <p className="text-gray-600 mt-2">Monitor products across all stores</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          </div>
          <select
            aria-label="Filter products by status"
            value={status}
            onChange={(event) => { setStatus(event.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="all">All products</option>
            <option value="active">Published</option>
            <option value="inactive">Unpublished</option>
            <option value="flagged">Flagged</option>
          </select>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error} <button type="button" className="ml-2 underline" onClick={() => setRetryKey((key) => key + 1)}>Retry</button></div>}
      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">{notice}</div>}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Product</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Store</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Category</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Price</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Stock</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Moderation</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-600">/{product.slug}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{product.storeName}</td>
                  <td className="px-6 py-4 text-gray-700">{product.categoryName || "—"}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">₦{parseFloat(product.price).toLocaleString()}</td>
                  <td className="px-6 py-4 text-gray-700">{product.stock}</td>
                  <td className="px-6 py-4">
                    {product.isActive ? (
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
                    <span className={`rounded-full px-3 py-1 text-sm ${product.isFlagged ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-700"}`}>
                      {product.isFlagged ? "Flagged" : "Clear"}
                    </span>
                    {product.flagReason && <p className="mt-1 max-w-xs text-xs text-gray-500">{product.flagReason}</p>}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => router.push(`/my-admin/products/${product.id}`)}
                      className="text-gray-600 hover:text-blue-600 p-1"
                      title="View Details"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={() => void moderate(product, product.isActive ? "suspend" : "unsuspend")}
                      className="ml-2 rounded border px-2 py-1 text-xs disabled:opacity-50"
                    >
                      {busyId === product.id ? "Saving…" : product.isActive ? "Unpublish" : "Restore"}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={() => void moderate(product, product.isFlagged ? "unflag" : "flag")}
                      className="ml-2 rounded border px-2 py-1 text-xs disabled:opacity-50"
                    >
                      {product.isFlagged ? "Clear flag" : "Flag"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">{total} products · page {page} of {Math.max(1, Math.ceil(total / 20))}</p>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded border px-3 py-2 disabled:opacity-50">Previous</button>
            <button type="button" disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)} className="rounded border px-3 py-2 disabled:opacity-50">Next</button>
          </div>
        </div>
        {products.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <p className="text-gray-600">No products found</p>
          </div>
        )}
      </div>
    </div>
  );
}
