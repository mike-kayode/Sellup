"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface MerchantNotification {
  id: string;
  title: string;
  message: string;
  critical: boolean;
  updatedAt: string;
}

export function OrderNotificationPrompt() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const lastChecked = useRef(new Date().toISOString());
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (permission === "unsupported" || permission === "denied") return;

    let cancelled = false;
    async function poll() {
      try {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token || cancelled) return;

        const response = await fetch(`/api/notifications?since=${encodeURIComponent(lastChecked.current)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!response.ok || cancelled) return;
        const data = await response.json() as { notifications?: MerchantNotification[] };
        const notifications = data.notifications || [];
        lastChecked.current = new Date().toISOString();

        if (permission !== "granted") return;
        for (const notification of notifications) {
          if (seen.current.has(notification.id)) continue;
          seen.current.add(notification.id);
          new Notification(notification.title, {
            body: notification.message,
            tag: notification.id,
            requireInteraction: notification.critical,
          });
        }
      } catch {
        // Notification delivery is best effort; dashboard data remains available.
      }
    }

    void poll();
    const interval = window.setInterval(() => void poll(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [permission]);

  async function enableNotifications() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  if (permission === "unsupported" || permission === "granted" || permission === "denied") return null;

  return (
    <button
      type="button"
      onClick={enableNotifications}
      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      title="Enable browser notifications for new orders and critical updates"
    >
      {permission === "default" ? <Bell size={18} /> : <BellOff size={18} />}
      Enable notifications
    </button>
  );
}
