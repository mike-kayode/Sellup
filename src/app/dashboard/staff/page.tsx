'use client';

import { useState, useEffect } from 'react';
import { Trash2, Edit2, Plus } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: 'manager' | 'staff' | 'viewer';
  permissions: string[];
  isActive: boolean;
  createdAt: string;
}

interface OwnedStore {
  id: string;
  storeName: string;
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [stores, setStores] = useState<OwnedStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'staff',
    permissions: [] as string[],
  });

  async function getToken(): Promise<string | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }

  const fetchStaff = async (storeId: string) => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch('/api/staff/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId }),
      });
      if (res.ok) {
        const data = await res.json();
        setStaff((data.staff || []).map((s: any) => ({
          ...s,
          createdAt: s.createdAt || new Date().toISOString(),
        })));
      }
    } catch (error) {
      console.error('Failed to fetch staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStores = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch('/api/stores/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setStores(data.stores || []);
        if (data.stores && data.stores.length > 0) {
          setSelectedStoreId(data.stores[0].id);
          fetchStaff(data.stores[0].id);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (err) {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function execute() {
      await loadStores();
    }
    execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId);
    setStaff([]);
    setLoading(true);
    fetchStaff(storeId);
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!selectedStoreId) {
        alert('Please select a store first');
        return;
      }
      const token = await getToken();
      if (!token) return;

      const res = await fetch('/api/staff/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storeId: selectedStoreId,
          name: formData.name,
          email: formData.email,
          role: formData.role,
          permissions: formData.permissions,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to add staff member');
        return;
      }

      const data = await res.json();
      setStaff([...staff, data.staff]);
      setFormData({ name: '', email: '', role: 'staff', permissions: [] });
      setShowForm(false);
    } catch (error) {
      console.error('Error adding staff:', error);
      alert('Failed to add staff member');
    }
  };

  const handleDeleteStaff = (staffId: string) => {
    if (window.confirm('Are you sure you want to remove this staff member?')) {
      setStaff(staff.filter((s) => s.id !== staffId));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  const roleDescriptions = {
    manager: 'Full access to store management, staff, and settings',
    staff: 'Can manage orders, products, and customers but not staff or settings',
    viewer: 'Read-only access to view orders and analytics',
  };

  const permissionOptions = [
    { id: 'manage_products', label: 'Manage Products' },
    { id: 'manage_orders', label: 'Manage Orders' },
    { id: 'manage_customers', label: 'Manage Customers' },
    { id: 'manage_staff', label: 'Manage Staff' },
    { id: 'view_analytics', label: 'View Analytics' },
    { id: 'manage_settings', label: 'Manage Settings' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Staff Members</h1>
          <p className="text-gray-600 mt-2">Manage team members and their permissions (Business plan)</p>
        </div>

        {/* Store selector */}
        {stores.length > 1 && (
          <select
            value={selectedStoreId}
            onChange={(e) => handleStoreChange(e.target.value)}
            className="input max-w-sm"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.storeName}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2"
        >
          <Plus size={20} /> Add Staff
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Add Staff Member</h2>
          <form onSubmit={handleAddStaff} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter staff name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="staff@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Role</label>
              <div className="space-y-2">
                {['manager', 'staff', 'viewer'].map((role) => (
                  <label key={role} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="role"
                      value={role}
                      checked={formData.role === role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-4 h-4 text-green-600 mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-900 capitalize">{role}</div>
                      <p className="text-sm text-gray-600">
                        {roleDescriptions[role as keyof typeof roleDescriptions]}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Permissions</label>
              <div className="grid md:grid-cols-2 gap-2">
                {permissionOptions.map((perm) => (
                  <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.permissions.includes(perm.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            permissions: [...formData.permissions, perm.id],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            permissions: formData.permissions.filter((p) => p !== perm.id),
                          });
                        }
                      }}
                      className="w-4 h-4 text-green-600"
                    />
                    <span className="text-sm text-gray-700">{perm.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition"
              >
                Add Staff Member
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormData({ name: '', email: '', role: 'staff', permissions: [] });
                }}
                className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-2 rounded-lg font-medium transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {staff.length === 0 ? (
        <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-600">No staff members yet. Add your first team member to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Email</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Role</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {staff.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{member.name}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{member.email}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 capitalize">
                      {member.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {member.isActive ? (
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
                    <button className="text-gray-600 hover:text-blue-600 p-1" title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteStaff(member.id)}
                      className="text-gray-600 hover:text-red-600 p-1"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-900 text-sm">
          <strong>Note:</strong> Staff management is available on Business and Pro plans. Each staff member can be assigned specific permissions to control what they can access and modify in your store.
        </p>
      </div>
    </div>
  );
}