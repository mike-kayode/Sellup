"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface MerchantAnnouncement {
  id: string;
  title: string;
  message: string;
  type: string;
}

export function MerchantAnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<MerchantAnnouncement[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Please sign in again to load announcements.");
      const response = await fetch("/api/merchant/announcements", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to load announcements.");
      setAnnouncements(result.announcements || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load announcements.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadAnnouncements);
  }, [loadAnnouncements]);

  async function dismiss(id: string) {
    if (dismissing) return;
    setDismissing(id);
    try {
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Please sign in again to dismiss this announcement.");
      const response = await fetch("/api/merchant/announcements", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to dismiss announcement.");
      setAnnouncements((current) => current.filter((announcement) => announcement.id !== id));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to dismiss announcement.");
    } finally {
      setDismissing(null);
    }
  }

  if (loading && announcements.length === 0) return null;

  return (
    <section aria-label="Platform announcements" className="space-y-3">
      {error && (
        <div role="alert" className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>{error}</span>
          <button type="button" onClick={() => void loadAnnouncements()} className="ml-4 underline">
            Retry
          </button>
        </div>
      )}
      {announcements.map((announcement) => (
        <article
          key={announcement.id}
          className={`flex items-start justify-between gap-4 rounded-lg border px-4 py-3 ${
            announcement.type === "warning" || announcement.type === "maintenance"
              ? "border-amber-300 bg-amber-50 text-amber-950"
              : "border-blue-200 bg-blue-50 text-blue-950"
          }`}
        >
          <div className="min-w-0">
            <h2 className="font-semibold">{announcement.title}</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm">{announcement.message}</p>
          </div>
          <button
            type="button"
            aria-label={`Dismiss ${announcement.title}`}
            disabled={dismissing !== null}
            onClick={() => void dismiss(announcement.id)}
            className="rounded p-1 hover:bg-black/5 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </article>
      ))}
    </section>
  );
}
