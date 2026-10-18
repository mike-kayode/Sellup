"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      try {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          router.push("/login");
          return;
        }

        // Check the app user's role (stored in user_metadata or fetched from API).
        // For a robust check, fetch /api/auth/me which returns the role.
        const res = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.user?.role === "admin" || data.user?.role === "superadmin") {
            setIsAdmin(true);
            setIsLoading(false);
            return;
          }
        }

        // Fallback: allow if user_metadata role is admin
        const role = session.user.user_metadata?.role as string | undefined;
        if (role === "admin" || role === "superadmin") {
          setIsAdmin(true);
          setIsLoading(false);
          return;
        }

        router.push("/");
      } catch {
        router.push("/");
      }
    }
    checkAdmin();
  }, [router]);

  if (isLoading || !isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Navigation */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-8">
              <a href="/admin" className="text-2xl font-bold text-green-600">
                Sell Up Admin
              </a>
              <div className="flex gap-6">
                <a href="/admin" className="text-gray-600 hover:text-gray-900">
                  Dashboard
                </a>
                <a href="/admin/users" className="text-gray-600 hover:text-gray-900">
                  Users
                </a>
                <a href="/admin/stores" className="text-gray-600 hover:text-gray-900">
                  Stores
                </a>
                <a href="/admin/analytics" className="text-gray-600 hover:text-gray-900">
                  Analytics
                </a>
              </div>
            </div>
            <button
              onClick={async () => {
                try {
                  const supabase = getSupabaseClient();
                  await supabase.auth.signOut();
                } catch {
                  // ignore
                }
                router.push("/");
              }}
              className="text-gray-600 hover:text-gray-900"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
