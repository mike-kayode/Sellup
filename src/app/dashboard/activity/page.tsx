"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Package, ShoppingCart, UserPlus, Settings } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Activity {
  id: string;
  action: string;
  resourceType: string;
  createdAt: string;
}

export default function ActivityPage() {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadActivity() {
    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/admin/audit-logs", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setActivities(data.logs || []);
      }
    } catch (err) {
      console.error("Error loading activity:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    loadActivity();
  }, []);

  const getIcon = (resourceType: string) => {
    switch (resourceType) {
      case "product":
        return <Package size={16} className="text-blue-600" />;
      case "order":
        return <ShoppingCart size={16} className="text-green-600" />;
      case "staff":
        return <UserPlus size={16} className="text-purple-600" />;
      case "settings":
        return <Settings size={16} className="text-gray-600" />;
      default:
        return <ClipboardList size={16} className="text-gray-600" />;
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Activity Log</h1>
        <p className="text-gray-600">Track all activities across your stores</p>
      </div>

      {activities.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="text-gray-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Activity Yet</h2>
          <p className="text-gray-600 max-w-md mx-auto">Activities will appear here as you and your team use the platform.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y">
            {activities.map((activity) => (
              <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">{getIcon(activity.resourceType)}</div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium capitalize">{activity.action.replace(".", " ")}</span>
                      {" · "}
                      <span className="text-gray-600 capitalize">{activity.resourceType}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{new Date(activity.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
