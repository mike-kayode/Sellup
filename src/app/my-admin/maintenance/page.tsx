"use client";

import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function AdminMaintenancePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState({
    enabled: false,
    message: "We are currently performing maintenance. Please check back soon.",
    scheduledStart: "",
    scheduledEnd: "",
    allowAdminAccess: true,
  });

  useEffect(() => {
    async function load() {
      try {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setLoading(false);
          return;
        }

        const res = await fetch("/api/admin/maintenance", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load settings");
        if (data.settings) {
          const localDate = (value: string) => {
            if (!value) return "";
            const date = new Date(value);
            if (!Number.isFinite(date.getTime())) return "";
            const offset = date.getTimezoneOffset();
            return new Date(date.getTime() - offset * 60_000)
              .toISOString()
              .slice(0, 16);
          };
          setSettings((prev) => ({
            ...prev,
            ...data.settings,
            scheduledStart: localDate(data.settings.scheduledStart || ""),
            scheduledEnd: localDate(data.settings.scheduledEnd || ""),
          }));
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load maintenance settings"
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) throw new Error("Not authenticated");

      const res = await fetch("/api/admin/maintenance", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...settings,
          scheduledStart: settings.scheduledStart
            ? new Date(settings.scheduledStart).toISOString()
            : "",
          scheduledEnd: settings.scheduledEnd
            ? new Date(settings.scheduledEnd).toISOString()
            : "",
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to save settings");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save maintenance settings"
      );
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Maintenance Mode</h1>
        <p className="text-gray-600 mt-2">Control platform availability</p>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              className="rounded border-gray-300 text-[#25D366] focus:ring-[#25D366]"
            />
            <span className="text-sm font-medium text-gray-900">Enable maintenance mode</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Maintenance Message</label>
          <textarea
            rows={4}
            value={settings.message}
            onChange={(e) => setSettings({ ...settings, message: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Start</label>
            <input
              type="datetime-local"
              value={settings.scheduledStart}
              onChange={(e) => setSettings({ ...settings, scheduledStart: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled End</label>
            <input
              type="datetime-local"
              value={settings.scheduledEnd}
              onChange={(e) => setSettings({ ...settings, scheduledEnd: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.allowAdminAccess}
            onChange={(e) => setSettings({ ...settings, allowAdminAccess: e.target.checked })}
            disabled
            className="rounded border-gray-300 text-[#25D366] focus:ring-[#25D366]"
          />
          <span className="text-sm text-gray-700">Admin access is always allowed during maintenance</span>
        </label>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#1da851] transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
