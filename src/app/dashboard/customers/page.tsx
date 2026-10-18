"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  deliveryAddress: string | null;
  city: string | null;
  state: string | null;
  totalSpent: string;
  totalOrders: number;
  lastOrderDate: string | null;
}

interface Store {
  id: string;
  storeName: string;
}

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [loading, setLoading] = useState(true);

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

  async function loadCustomers() {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/customers/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId: selectedStoreId }),
      });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
      }
    } catch (err) {
      console.error("Error loading customers:", err);
    }
  }

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
        await loadCustomers();
      }
    }
    execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId]);

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Customers</h1>
          <p className="text-gray-600">
            Manage and track your customer information
          </p>
        </div>
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Users className="text-gray-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            No Stores Yet
          </h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Create a store to start building your customer list.
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
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Customers</h1>
        <p className="text-gray-600">
          Manage and track your customer information
        </p>
      </div>

      {/* Store selector */}
      {stores.length > 1 && (
        <div className="mb-6">
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

      {customers.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Users className="text-gray-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Customers</h2>
          <p className="text-gray-600 max-w-md mx-auto">
            Customer information will appear here as they place orders through
            your store.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase">
                    Name
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase">
                    Location
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase">
                    Orders
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase">
                    Total Spent
                  </th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{customer.name}</p>
                      {customer.email && (
                        <p className="text-sm text-gray-600">{customer.email}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-700">{customer.phone}</td>
                    <td className="px-6 py-4 text-gray-700">
                      {[customer.city, customer.state]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {customer.totalOrders}
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      ₦{parseFloat(customer.totalSpent || "0").toLocaleString()}
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