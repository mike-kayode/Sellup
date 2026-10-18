"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Tag,
  BarChart3,
  UserPlus,
  Percent,
  Store,
  FileText,
  Globe,
  Palette,
  Paintbrush,
  Search,
  CreditCard,
  Plug,
  Code,
  Webhook,
  FileBarChart,
  Bell,
  LifeBuoy,
  ClipboardList,
  Warehouse,
  MessageCircle,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  isPaidPlan,
  isPlanAtLeast,
  normalizePlan,
  type PlanId,
} from "@/lib/entitlements";
import { OrderNotificationPrompt } from "@/components/order-notification-prompt";

/** Dashboard modules restricted to paid subscribers (Starter and above). */
const PAID_ONLY_PATHS = [
  "/dashboard/seo",
  "/dashboard/domain",
  "/dashboard/staff",
  "/dashboard/integrations",
  "/dashboard/developers",
  "/dashboard/webhooks",
  "/dashboard/activity",
];

interface User {
  id: string;
  email: string;
  fullName: string;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          router.push("/login");
          return;
        }

        setUser({
          id: session.user.id,
          email: session.user.email || "",
          fullName:
            (session.user.user_metadata?.full_name as string) || "",
        });

        // Resolve the merchant's plan so paid-only modules can be hidden
        // from freemium accounts (defaults to freemium on any failure).
        try {
          const res = await fetch("/api/stores/list", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({}),
          });
          if (res.ok) {
            const data = await res.json();
            let best: PlanId = "freemium";
            for (const s of data.stores || []) {
              const p = normalizePlan(s.plan);
              if (isPlanAtLeast(p, "business")) {
                best = p;
                break;
              }
              if (isPlanAtLeast(p, "starter")) best = p;
            }
            setPaid(isPaidPlan(best));
          }
        } catch {
          // Treat as freemium — modules re-appear once the plan loads.
        }
        setLoading(false);
      } catch {
        router.push("/login");
      }
    }
    checkAuth();
  }, [router]);

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- local PNG logo */}
          <img
            src="/assets/sellup-logo.png"
            alt="Sell Up"
            className="h-9 w-auto mx-auto mb-4"
          />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const allMenuItems = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { label: "My Store", icon: Store, href: "/dashboard/store" },
  { label: "Store design", icon: Paintbrush, href: "/dashboard/store-design" },
    { label: "Products", icon: Package, href: "/dashboard/products" },
    { label: "Categories", icon: Tag, href: "/dashboard/categories" },
    { label: "Inventory", icon: Warehouse, href: "/dashboard/inventory" },
    { label: "Orders", icon: ShoppingCart, href: "/dashboard/orders" },
    { label: "Customers", icon: Users, href: "/dashboard/customers" },
    { label: "WhatsApp Orders", icon: MessageCircle, href: "/dashboard/whatsapp" },
    { label: "Coupons", icon: Percent, href: "/dashboard/coupons" },
    { label: "Analytics", icon: BarChart3, href: "/dashboard/analytics" },
    { label: "Reports", icon: FileBarChart, href: "/dashboard/reports" },
    { label: "Appearance", icon: Palette, href: "/dashboard/appearance" },
    { label: "SEO", icon: Search, href: "/dashboard/seo" },
    { label: "Domain", icon: Globe, href: "/dashboard/domain" },
    { label: "Staff", icon: UserPlus, href: "/dashboard/staff" },
    { label: "Integrations", icon: Plug, href: "/dashboard/integrations" },
    { label: "Developers", icon: Code, href: "/dashboard/developers" },
    { label: "Webhooks", icon: Webhook, href: "/dashboard/webhooks" },
    { label: "Billing", icon: CreditCard, href: "/dashboard/billing" },
    { label: "Notifications", icon: Bell, href: "/dashboard/notifications" },
    { label: "Support", icon: LifeBuoy, href: "/dashboard/support" },
    { label: "Activity", icon: ClipboardList, href: "/dashboard/activity" },
    { label: "Settings", icon: Settings, href: "/dashboard/settings" },
  ];
  const menuItems = allMenuItems.filter(
    (item) =>
      paid || !PAID_ONLY_PATHS.includes(item.href)
  );

  const isActive = (href: string) => pathname === href;

  // Freemium merchants can't open paid-only modules — show an upgrade panel.
  const onPaidOnlyPage =
    !paid &&
    PAID_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (onPaidOnlyPage) {
    const moduleName =
      allMenuItems.find((m) => pathname.startsWith(m.href))?.label ||
      "This module";
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-4 text-amber-600">
            <CreditCard size={22} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {moduleName} is a paid feature
          </h1>
          <p className="text-gray-600 mb-6">
            Upgrade to a paid plan to unlock {moduleName.toLowerCase()} and the
            rest of the business toolkit.
          </p>
          <Link
            href="/dashboard/settings"
            className="btn-primary inline-block"
            onClick={() => setSidebarOpen(false)}
          >
            Upgrade plan
          </Link>
          <Link
            href="/dashboard"
            className="block mt-3 text-sm text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(false)}
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="scrollbar-hidden flex h-screen bg-gray-50 overflow-hidden">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col overflow-hidden border-r border-gray-800 bg-gray-900 text-white transition-transform duration-300 lg:static lg:z-auto lg:h-auto lg:translate-x-0 lg:shrink-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- local PNG logo */}
            <img
              src="/assets/sellup-logo-dark.png"
              alt="Sell Up"
              className="w-auto h-9 shrink-0"
            />
            <div>
              <h1 className="font-bold text-sm text-gray-400">Dashboard</h1>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="scrollbar-hidden flex-1 overflow-y-auto py-6">
          <div className="space-y-2 px-4">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive(item.href)
                      ? "bg-[#25D366] text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-gray-800">
          <div className="p-4 bg-gray-800 rounded-lg mb-4">
            <p className="text-xs text-gray-400 mb-1">Logged in as</p>
            <p className="text-sm font-semibold truncate">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={sidebarOpen}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="text-right">
            <p className="text-sm text-gray-600">Welcome back,</p>
            <p className="font-semibold">{user.fullName || user.email}</p>
          </div>
          <OrderNotificationPrompt />
        </div>

        {/* Content */}
        <div className="scrollbar-hidden flex-1 overflow-y-auto">
          <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
