"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Package, Store, Tag, DollarSign } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface ProductDetail {
  product: any;
  store: any;
  category: any;
}

export default function AdminProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [detail, setDetail] = useState<ProductDetail | null>(null);
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

        const res = await fetch(`/api/admin/products/${params.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setDetail(data);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load product details");
        }
      } catch {
        setError("Failed to load product details");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

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

  if (!detail) return null;

  const product = detail.product;
  const images = product.images as string[] || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
          <p className="text-gray-600 mt-1">/{product.slug}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 text-green-600 rounded-lg">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Price</p>
              <p className="text-2xl font-bold text-gray-900">₦{Number(product.price).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Package size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Stock</p>
              <p className="text-2xl font-bold text-gray-900">{product.stock ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <Tag size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Category</p>
              <p className="text-2xl font-bold text-gray-900">{detail.category?.name || "—"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Images</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {images.map((img, idx) => (
              <div key={idx} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
            {images.length === 0 && (
              <div className="col-span-full aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                <p className="text-gray-600">No images</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Store</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Store size={16} className="text-gray-400" />
                <span className="text-sm text-gray-900">{detail.store?.storeName || "—"}</span>
              </div>
              <p className="text-sm text-gray-600">/{detail.store?.storeSlug}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Status</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Active</span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  product.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                }`}>
                  {product.isActive ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Featured</span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  product.isFeatured ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-800"
                }`}>
                  {product.isFeatured ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Compare Price</span>
                <span className="text-sm font-medium text-gray-900">
                  {product.comparePrice ? `₦${Number(product.comparePrice).toLocaleString()}` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">SKU</span>
                <span className="text-sm font-medium text-gray-900">{product.sku || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Created</span>
                <span className="text-sm font-medium text-gray-900">
                  {new Date(product.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {product.description && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Description</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{product.description}</p>
        </div>
      )}
    </div>
  );
}
