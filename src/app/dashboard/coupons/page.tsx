"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Coupon {
  id: string;
  code: string;
  description?: string;
  discountType: string;
  discountValue: string;
  maxUsage?: number;
  currentUsage?: number;
  minOrderAmount?: string;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
}

interface Store {
  id: string;
  storeName: string;
}

export default function CouponsPage() {
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    code: "",
    description: "",
    discountType: "percentage",
    discountValue: "",
    maxUsage: "",
    minOrderAmount: "",
    expiresAt: "",
  });

  async function getToken(): Promise<string | null> {
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  async function loadStores() {
    try {
      const token = await getToken();
      if (!token) {
        router.push("/login");
        return;
      }
      const res = await fetch("/api/stores/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setStores(data.stores || []);
        if (data.stores && data.stores.length > 0) {
          setSelectedStoreId(data.stores[0].id);
        }
      }
    } catch (err) {
      console.error("Error loading stores:", err);
    } finally {
      setLoading(false);
    }
  }

  const fetchCoupons = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch("/api/coupons/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId: selectedStoreId }),
      });

      if (response.ok) {
        const data = await response.json();
        setCoupons(data.coupons || []);
      }
    } catch (error) {
      console.error("Failed to fetch coupons:", error);
    }
  };

  useEffect(() => {
    async function execute() {
      await loadStores();
    }
    execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function execute() {
      if (selectedStoreId) {
        await fetchCoupons();
      }
    }
    execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId]);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch("/api/coupons/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storeId: selectedStoreId,
          ...formData,
          code: formData.code.toUpperCase(),
          maxUsage: formData.maxUsage ? parseInt(formData.maxUsage) : undefined,
          minOrderAmount: formData.minOrderAmount || undefined,
          expiresAt: formData.expiresAt || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to create coupon");
        return;
      }

      setFormData({
        code: "",
        description: "",
        discountType: "percentage",
        discountValue: "",
        maxUsage: "",
        minOrderAmount: "",
        expiresAt: "",
      });
      setShowForm(false);
      fetchCoupons();
    } catch (error) {
      console.error("Error creating coupon:", error);
      setError("Error creating coupon");
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (!window.confirm("Are you sure you want to delete this coupon?"))
      return;

    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch("/api/coupons/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ couponId, storeId: selectedStoreId }),
      });

      if (response.ok) {
        fetchCoupons();
      } else {
        alert("Failed to delete coupon");
      }
    } catch (error) {
      console.error("Error deleting coupon:", error);
      alert("Error deleting coupon");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="h-40 bg-gray-100 animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Coupons</h1>
          <p className="text-gray-600 mt-2">
            Manage discount coupons for your store
          </p>
        </div>
        <div className="card p-12 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            No Stores Yet
          </h2>
          <p className="text-gray-600 mb-8">
            Create a store to start managing coupons.
          </p>
          <button
            onClick={() => router.push("/dashboard/stores")}
            className="btn-primary"
          >
            Create Store
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Coupons</h1>
          <p className="text-gray-600 mt-2">
            Manage discount coupons for your store
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary"
        >
          {showForm ? "Cancel" : "Create Coupon"}
        </button>
      </div>

      {/* Store selector */}
      {stores.length > 1 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Store:</label>
          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="input max-w-sm"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.storeName}
              </option>
            ))}
          </select>
        </div>
      )}

      {showForm && (
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">Create New Coupon</h2>
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">
              {error}
            </div>
          )}
          <form onSubmit={handleCreateCoupon} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Coupon Code
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  className="input"
                  placeholder="e.g., SAVE10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount Type
                </label>
                <select
                  value={formData.discountType}
                  onChange={(e) =>
                    setFormData({ ...formData, discountType: e.target.value })
                  }
                  className="input"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (₦)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount Value
                </label>
                <input
                  type="number"
                  required
                  value={formData.discountValue}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      discountValue: e.target.value,
                    })
                  }
                  className="input"
                  placeholder="Enter discount value"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Usage (Optional)
                </label>
                <input
                  type="number"
                  value={formData.maxUsage}
                  onChange={(e) =>
                    setFormData({ ...formData, maxUsage: e.target.value })
                  }
                  className="input"
                  placeholder="Unlimited if empty"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Order Amount (Optional)
                </label>
                <input
                  type="number"
                  value={formData.minOrderAmount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      minOrderAmount: e.target.value,
                    })
                  }
                  className="input"
                  placeholder="Enter minimum order amount"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expires At (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={formData.expiresAt}
                  onChange={(e) =>
                    setFormData({ ...formData, expiresAt: e.target.value })
                  }
                  className="input"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="input"
                placeholder="Coupon description"
                rows={2}
              />
            </div>
            <button
              type="submit"
              className="w-full btn-primary"
            >
              Create Coupon
            </button>
          </form>
        </div>
      )}

      {coupons.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-600">
            No coupons yet. Create your first coupon to offer discounts!
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                    Discount
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                    Usage
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
                {coupons.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="font-mono font-semibold text-gray-900">
                        {coupon.code}
                      </span>
                      {coupon.description && (
                        <p className="text-sm text-gray-600">
                          {coupon.description}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {coupon.discountType === "percentage"
                        ? `${coupon.discountValue}%`
                        : `₦${parseFloat(coupon.discountValue).toLocaleString()}`}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {coupon.maxUsage
                        ? `${coupon.currentUsage || 0}/${coupon.maxUsage}`
                        : "Unlimited"}
                    </td>
                    <td className="px-6 py-4">
                      {coupon.isActive ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge">Inactive</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDeleteCoupon(coupon.id)}
                        className="text-red-600 hover:text-red-800 font-medium text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}