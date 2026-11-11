"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  Users,
  ShoppingCart,
  Package,
  CreditCard,
  Tags,
  LifeBuoy,
  FileText,
  Globe,
  Settings,
  Shield,
  LogOut,
  Menu,
  X,
  BarChart3,
  Ticket,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

const menuGroups = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/my-admin", icon: LayoutDashboard },
    ],
  },
  {
    title: "Business Management",
    items: [
      { label: "Businesses", href: "/my-admin/businesses", icon: Store },
      { label: "Users", href: "/my-admin/users", icon: Users },
      { label: "Orders", href: "/my-admin/orders", icon: ShoppingCart },
      { label: "Products", href: "/my-admin/products", icon: Package },
    ],
  },
  {
    title: "Revenue & Billing",
    items: [
      { label: "Subscriptions", href: "/my-admin/subscriptions", icon: CreditCard },
      { label: "Plans", href: "/my-admin/plans", icon: Tags },
      { label: "Payments", href: "/my-admin/payments", icon: CreditCard },
      { label: "Promotions", href: "/my-admin/promotions", icon: Tags },
    ],
  },
  {
    title: "Support & Communication",
    items: [
      { label: "Support", href: "/my-admin/support", icon: Ticket },
      { label: "Announcements", href: "/my-admin/announcements", icon: FileText },
      { label: "Notifications", href: "/my-admin/notifications", icon: LifeBuoy },
      { label: "Knowledge Base", href: "/my-admin/knowledge-base", icon: FileText },
    ],
  },
  {
    title: "Content",
    items: [
      { label: "Pages", href: "/my-admin/content/pages", icon: FileText },
      { label: "Blog", href: "/my-admin/content/blog", icon: FileText },
      { label: "Testimonials", href: "/my-admin/content/testimonials", icon: FileText },
      { label: "FAQs", href: "/my-admin/content/faqs", icon: FileText },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "Domains", href: "/my-admin/domains", icon: Globe },
      { label: "Integrations", href: "/my-admin/integrations", icon: Settings },
      { label: "AI Providers", href: "/my-admin/ai", icon: Settings },
      { label: "Features", href: "/my-admin/features", icon: Settings },
      { label: "API Management", href: "/my-admin/api", icon: Settings },
      { label: "Webhooks", href: "/my-admin/webhooks", icon: Settings },
    ],
  },
  {
    title: "Team & Security",
    items: [
      { label: "Staff", href: "/my-admin/staff", icon: Users },
      { label: "Roles", href: "/my-admin/roles", icon: Shield },
      { label: "Audit Logs", href: "/my-admin/audit-logs", icon: FileText },
      { label: "Security Center", href: "/my-admin/security", icon: Shield },
    ],
  },
  {
    title: "System",
    items: [
      { label: "System Health", href: "/my-admin/system", icon: BarChart3 },
      { label: "Background Jobs", href: "/my-admin/jobs", icon: BarChart3 },
      { label: "Backups", href: "/my-admin/backups", icon: BarChart3 },
      { label: "Maintenance", href: "/my-admin/maintenance", icon: Settings },
      { label: "Settings", href: "/my-admin/settings", icon: Settings },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [adminUser, setAdminUser] = useState<{ email: string; fullName: string; role: string } | null>(null);

  useEffect(() => {
    async function checkAdmin() {
      setCheckError(null);
      setMfaRequired(false);
      setLoading(true);
      try {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          router.push("/login");
          return;
        }

        const adminRes = await fetch("/api/admin/overview", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (adminRes.status === 401) {
          router.push("/login");
          return;
        }
        if (adminRes.status === 403) {
          const denial = await adminRes.json().catch(() => null);
          if (denial?.code === "MFA_REQUIRED") {
            setMfaRequired(true);
            setIsAdmin(true);
            setAdminUser({
              email: session.user.email || "",
              fullName: (session.user.user_metadata?.full_name as string) || "",
              role: "admin",
            });
            setLoading(false);
            if (pathname !== "/my-admin/security") router.replace("/my-admin/security");
            return;
          }
          // Confirmed by the server: this account is not an admin.
          router.push("/dashboard");
          return;
        }
        if (!adminRes.ok) {
          // 5xx (e.g. a database outage) must NOT misroute the admin into
          // the merchant dashboard — show a retryable error instead.
          setCheckError(
            "The admin service is temporarily unavailable. This is usually a brief database issue — retry in a moment."
          );
          setLoading(false);
          return;
        }

        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = res.ok ? await res.json() : null;
        setIsAdmin(true);
        setAdminUser({
          email: session.user.email || "",
          fullName: data?.user?.fullName || (session.user.user_metadata?.full_name as string) || "",
          role: data?.user?.role || "admin",
        });
        setLoading(false);
      } catch {
        setCheckError("Could not reach the admin service. Check your connection and retry.");
        setLoading(false);
      }
    }
    checkAdmin();
  }, [pathname, router, reloadKey]);

  async function handleLogout() {
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (checkError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Shield className="mx-auto mb-4 h-10 w-10 text-amber-500" />
          <h1 className="mb-2 text-lg font-bold text-slate-900">Admin access paused</h1>
          <p className="mb-6 text-sm text-slate-600">{checkError}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setCheckError(null);
                setLoading(true);
                setReloadKey((key) => key + 1);
              }}
              className="btn-primary"
            >
              Retry
            </button>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const visibleMenuGroups = mfaRequired
    ? [{ title: "Security", items: [{ label: "Security Center", href: "/my-admin/security", icon: Shield }] }]
    : menuGroups;

  return (
    <div className="scrollbar-hidden flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } bg-slate-900 text-white transition-all duration-300 overflow-hidden flex flex-col border-r border-slate-800`}
      >
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- local PNG logo */}
            <img
              src="/assets/sellup-logo-dark.png"
              alt="Sell Up"
              className="h-9 w-auto shrink-0"
            />
            <div>
              <p className="text-xs text-slate-400">Super Admin</p>
            </div>
          </div>
        </div>

        <nav className="scrollbar-hidden flex-1 overflow-y-auto py-6">
          {visibleMenuGroups.map((group) => (
            <div key={group.title} className="mb-6">
              <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                {group.title}
              </p>
              <div className="space-y-1 px-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <button
                      key={item.href}
                      onClick={() => router.push(item.href)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? "bg-[#25D366] text-white"
                          : "text-slate-400 hover:text-white hover:bg-slate-800"
                      }`}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="p-3 bg-slate-800 rounded-lg mb-3">
            <p className="text-xs text-slate-400 mb-1">Logged in as</p>
            <p className="text-sm font-semibold truncate">{adminUser?.email}</p>
            <p className="text-xs text-slate-500 capitalize">{adminUser?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">
              {mfaRequired ? "Multi-factor authentication required" : "Platform Administration"}
            </span>
          </div>
        </div>

        <div className="scrollbar-hidden flex-1 overflow-y-auto">
          <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
