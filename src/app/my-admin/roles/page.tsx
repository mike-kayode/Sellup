"use client";

import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  createdAt: string;
  isSystem: boolean;
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
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

        const res = await fetch("/api/admin/roles", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setRoles(data.roles || []);
          setAvailablePermissions(data.availablePermissions || []);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load roles");
        }
      } catch {
        setError("Failed to load roles");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [retryKey]);

  function editPermissions(role: Role) {
    setSelectedRole(role.id);
    setDraftPermissions(role.permissions);
    setError("");
    setNotice("");
  }

  async function savePermissions() {
    if (!selectedRole || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch("/api/admin/roles", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: selectedRole, permissions: draftPermissions }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save role permissions");
      setSelectedRole("");
      setNotice("Role permissions updated.");
      setRetryKey((key) => key + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save role permissions");
    } finally {
      setSaving(false);
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
        <h1 className="text-3xl font-bold text-gray-900">Roles & Permissions</h1>
        <p className="text-gray-600 mt-2">Manage stored permissions for each platform role. Superadmin permissions are protected.</p>
      </div>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error} <button type="button" className="ml-2 underline" onClick={() => setRetryKey((key) => key + 1)}>Retry</button></div>}
      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">{notice}</div>}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Role</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Description</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Permissions</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {roles.map((role) => (
                <tr key={role.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Shield size={16} className="text-gray-400" />
                      <span className="font-medium text-gray-900 capitalize">{role.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{role.description}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.slice(0, 3).map((perm) => (
                        <span key={perm} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                          {perm}
                        </span>
                      ))}
                      {role.permissions.length > 3 && (
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                          +{role.permissions.length - 3} more
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={role.id === "superadmin"}
                      onClick={() => editPermissions(role)}
                      className="mt-2 text-sm text-green-700 underline disabled:text-gray-400"
                    >
                      {role.id === "superadmin" ? "Protected" : "Edit permissions"}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(role.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selectedRole && (
          <section aria-labelledby="permissions-editor-title" className="rounded-xl border bg-white p-6">
            <h2 id="permissions-editor-title" className="text-xl font-semibold">
              Edit {roles.find((role) => role.id === selectedRole)?.name} permissions
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {availablePermissions.map((permission) => (
                <label key={permission} className="flex items-center gap-2 rounded border p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={draftPermissions.includes(permission)}
                    onChange={(event) => setDraftPermissions((current) =>
                      event.target.checked
                        ? [...current, permission]
                        : current.filter((value) => value !== permission)
                    )}
                  />
                  {permission}
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" disabled={saving} onClick={() => setSelectedRole("")} className="rounded border px-4 py-2">Cancel</button>
              <button type="button" disabled={saving} onClick={() => void savePermissions()} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{saving ? "Saving…" : "Save permissions"}</button>
            </div>
          </section>
        )}
        {roles.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No roles configured yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
