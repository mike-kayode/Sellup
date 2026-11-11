"use client";

import { useState, useEffect } from "react";
import { SettingsIcon, LogOut, CreditCard, Mail, Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  clearBrowserAdminImpersonation,
  getBrowserAdminImpersonation,
  getSupabaseClient,
} from "@/lib/supabase/client";
import { isPaidPlan, normalizePlan } from "@/lib/entitlements";

interface Store {
  id: string;
  storeName: string;
  plan: string;
}

interface PlanInfo {
  id: string;
  name: string;
  price: number;
  priceOnRequest?: boolean;
  billingCycle?: string;
  tagline: string;
  features: string[];
}

function getInitialPaymentMethod(): string {
  return "whatsapp";
}

function getInitialPaystackKey(): string {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("sellup_paystack_public_key");
      if (saved) return saved;
    } catch {
      // localStorage unavailable; ignore
    }
  }
  return "";
}

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("account");
  const [paymentMethod, setPaymentMethod] = useState(getInitialPaymentMethod);
  const [paystackKey, setPaystackKey] = useState(getInitialPaystackKey);
  const [saving, setSaving] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [promotionCode, setPromotionCode] = useState("");
  const [announcementEmailOptOut, setAnnouncementEmailOptOut] = useState(false);
  const [announcementWhatsAppOptOut, setAnnouncementWhatsAppOptOut] = useState(false);
  const [savingNotificationPreferences, setSavingNotificationPreferences] = useState(false);
  const [notificationNotice, setNotificationNotice] = useState("");
  const [notificationError, setNotificationError] = useState("");

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
    }
  }

  async function loadPlans() {
    try {
      const res = await fetch("/api/subscriptions/plans");
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
      }
    } catch (err) {
      console.error("Error loading plans:", err);
    }
  }

  useEffect(() => {
    async function execute() {
      await loadStores();
      await loadPlans();
    }
    execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedStoreId) return;
    async function loadNotificationPreferences() {
      try {
        const token = await getToken();
        if (!token) throw new Error("Please sign in again.");
        const response = await fetch("/api/merchant/notification-preferences", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Failed to load preferences.");
        setAnnouncementEmailOptOut(Boolean(result.preferences.emailOptOut));
        setAnnouncementWhatsAppOptOut(Boolean(result.preferences.whatsappOptOut));
      } catch (cause) {
        setNotificationError(cause instanceof Error ? cause.message : "Failed to load preferences.");
      }
    }
    void loadNotificationPreferences();
    // getToken is stable for the page lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId]);

  async function saveNotificationPreferences() {
    if (savingNotificationPreferences) return;
    setSavingNotificationPreferences(true);
    setNotificationError("");
    setNotificationNotice("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again.");
      const response = await fetch("/api/merchant/notification-preferences", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailOptOut: announcementEmailOptOut,
          whatsappOptOut: announcementWhatsAppOptOut,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to save preferences.");
      setNotificationNotice("Announcement preferences saved.");
    } catch (cause) {
      setNotificationError(cause instanceof Error ? cause.message : "Failed to save preferences.");
    } finally {
      setSavingNotificationPreferences(false);
    }
  }

  const currentPlan = stores.find((s) => s.id === selectedStoreId)?.plan || "freemium";
  // Paystack (online card payments) is a paid-plan perk.
  const paidSubscriber = isPaidPlan(normalizePlan(currentPlan));

  // After a Paystack upgrade, the redirect lands back here with ?reference= —
  // verify it so the plan flips immediately (the webhook also confirms it).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");
    if (!reference) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(
          `/api/billing/verify?reference=${encodeURIComponent(reference)}&provider=paystack`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          window.history.replaceState({}, "", "/dashboard/settings");
          loadStores();
        }
      } catch {
        // Webhook will still finalize the upgrade.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpgrade(planId: string) {
    if (!selectedStoreId) return;
    setLoadingPlan(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/billing/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storeId: selectedStoreId,
          plan: planId,
          ...(promotionCode.trim() ? { promotionCode: promotionCode.trim() } : {}),
          // Subscription upgrades always run through the platform's configured
          // provider (Paystack) — independent of the customer-facing payment
          // method (WhatsApp ordering etc.) chosen on the Payments tab.
          provider: "paystack",
        }),
      });
      const data = await res.json();
      if (data.result?.authorizationUrl) {
        window.open(data.result.authorizationUrl, "_blank");
      } else if (data.canPay === false) {
        alert(
          "Online payments are not configured yet. Please contact support to upgrade."
        );
      } else {
        alert(data.error || data.message || "Payment initialization started. Please complete payment.");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to initialize payment");
    } finally {
      setLoadingPlan(false);
    }
  }

  async function handleLogout() {
    const impersonation = getBrowserAdminImpersonation();
    if (impersonation) {
      try {
        const response = await fetch("/api/impersonation/exit", {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${impersonation.accessToken}`,
          },
        });
        if (!response.ok && response.status !== 401) {
          const result = await response.json();
          throw new Error(result.error || "Failed to end impersonation");
        }
        clearBrowserAdminImpersonation();
        router.replace(`/my-admin/businesses/${impersonation.storeId}`);
        router.refresh();
      } catch {
        window.alert("Could not end impersonation. Please retry from the banner.");
      }
      return;
    }

    const supabase = getSupabaseClient();
    supabase.auth.signOut();
    router.push("/");
  }

  async function handleSavePaymentSettings() {
    setSaving(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("sellup_paystack_public_key", paystackKey);
      }
      alert("Payment settings saved successfully!");
    } catch (error) {
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your account and preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        {[
          { id: "account", label: "Account", icon: SettingsIcon },
          { id: "payments", label: "Payments", icon: CreditCard },
          { id: "notifications", label: "Notifications", icon: Bell },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition ${
              activeTab === tab.id
                ? "border-green-600 text-green-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            <tab.icon size={20} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Account Tab */}
      {activeTab === "account" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Account Settings</h2>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Manage your account information and preferences.
              </p>
              <button className="btn-outline">Edit Account</button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Subscription</h2>

            {/* Store selector for multi-store owners */}
            {stores.length > 1 && (
              <div className="mb-4 flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">
                  Store:
                </label>
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

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Current Plan</p>
                <p className="text-lg font-bold capitalize">{currentPlan}</p>
              </div>

              {plans.length > 0 && (
                <div>
                  <label className="mb-3 block max-w-sm text-sm font-medium text-gray-700">
                    Promotion code (optional)
                    <input
                      value={promotionCode}
                      onChange={(event) => setPromotionCode(event.target.value)}
                      maxLength={50}
                      autoCapitalize="characters"
                      className="input mt-1 w-full"
                    />
                  </label>
                  <p className="text-sm text-gray-600 mb-3">
                    Available Plans — click a plan to upgrade instantly with
                    Paystack
                  </p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {plans.map((plan) => {
                      const isCurrent = plan.id === currentPlan;
                      const cardClass = `p-4 border-2 rounded-xl text-left w-full transition ${
                        isCurrent
                          ? "border-green-500 bg-green-50"
                          : plan.priceOnRequest
                            ? "border-gray-200"
                            : "border-gray-200 hover:border-green-400 hover:shadow-md cursor-pointer"
                      }`;

                      const cardBody = (
                        <>
                          <p className="font-bold text-gray-900">{plan.name}</p>
                          <p className="text-sm text-gray-600 mb-2">
                            {plan.priceOnRequest
                              ? "Custom pricing"
                              : plan.price === 0
                                ? "Free"
                                : `₦${plan.price.toLocaleString()}/month`}
                          </p>
                          {isCurrent ? (
                            <span className="text-xs font-medium text-green-600">
                              Current Plan
                            </span>
                          ) : plan.priceOnRequest ? (
                            <span className="text-sm font-medium text-green-600">
                              Contact us
                            </span>
                          ) : (
                            <span className="text-sm font-medium text-green-600">
                              {loadingPlan
                                ? "Processing..."
                                : `Upgrade — ₦${plan.price.toLocaleString()}/${plan.billingCycle === "yearly" ? "yr" : "mo"} →`}
                            </span>
                          )}
                        </>
                      );

                      if (isCurrent || plan.priceOnRequest) {
                        return (
                          <div key={plan.id} className={cardClass}>
                            {cardBody}
                          </div>
                        );
                      }
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => handleUpgrade(plan.id)}
                          disabled={loadingPlan}
                          className={cardClass}
                        >
                          {cardBody}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    Payments are processed securely by Paystack. Your plan
                    activates immediately after payment.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === "payments" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Payment Methods</h2>
            <p className="text-gray-600 text-sm">
              Choose how customers can pay for orders
            </p>

            <div className="space-y-3">
              {/* WhatsApp */}
              <label className="flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition" style={{
                borderColor: paymentMethod === "whatsapp" ? "#25D366" : "#e5e7eb",
                backgroundColor: paymentMethod === "whatsapp" ? "#f0fdf4" : "white",
              }}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="whatsapp"
                  checked={paymentMethod === "whatsapp"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-5 h-5 text-green-600 mt-1"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">WhatsApp Ordering</div>
                  <div className="text-sm text-gray-600">
                    Customers place orders via WhatsApp - no fees
                  </div>
                  <div className="text-xs text-green-600 mt-1">✓ Recommended for getting started</div>
                </div>
              </label>

              {/* Paystack — paid subscribers only */}
              <label
                className={`flex items-start gap-4 p-4 border-2 rounded-lg transition ${
                  paidSubscriber ? "cursor-pointer" : "cursor-not-allowed"
                }`}
                style={{
                  borderColor:
                    paidSubscriber && paymentMethod === "paystack"
                      ? "#25D366"
                      : "#e5e7eb",
                  backgroundColor:
                    paidSubscriber && paymentMethod === "paystack"
                      ? "#f0fdf4"
                      : "white",
                  opacity: paidSubscriber ? 1 : 0.65,
                }}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="paystack"
                  checked={paidSubscriber && paymentMethod === "paystack"}
                  disabled={!paidSubscriber}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-5 h-5 text-green-600 mt-1"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">
                    Paystack Payments{" "}
                    {!paidSubscriber && (
                      <span className="ml-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        Paid plan
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    Accept cards, USSD, bank transfers and more
                  </div>
                  {paidSubscriber ? (
                    <div className="text-xs text-gray-500 mt-1">
                      Fee: 1.5% + ₦10 per transaction
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("account");
                      }}
                      className="mt-1 text-xs font-medium text-green-600 hover:underline"
                    >
                      Upgrade your plan to accept card payments →
                    </button>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Paystack Configuration */}
          {paymentMethod === "paystack" && (
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Paystack Configuration</h2>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                <p className="text-blue-900 font-medium mb-2">Get your Paystack keys:</p>
                <ol className="list-decimal list-inside text-blue-800 space-y-1">
                  <li>
                    Visit{" "}
                    <a
                      href="https://dashboard.paystack.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium"
                    >
                      Paystack Dashboard
                    </a>
                  </li>
                  <li>Go to Settings → API Keys & Webhooks</li>
                  <li>Copy your Public key and paste below</li>
                </ol>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Public Key
                </label>
                <input
                  type="password"
                  value={paystackKey}
                  onChange={(e) => setPaystackKey(e.target.value)}
                  placeholder="pk_live_xxxxx"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div className="text-xs text-gray-600">
                Your keys are stored securely. Only use live keys when ready for production.
              </div>
            </div>
          )}

          <button
            onClick={handleSavePaymentSettings}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-lg font-medium transition"
          >
            {saving ? "Saving..." : "Save Payment Settings"}
          </button>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === "notifications" && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Notification Settings</h2>
          <p className="text-gray-600 text-sm mb-4">Choose whether Sell Up platform announcements can reach you by email or WhatsApp.</p>
          {notificationError && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{notificationError}</p>}
          {notificationNotice && <p role="status" className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notificationNotice}</p>}
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={!announcementEmailOptOut} onChange={(event) => setAnnouncementEmailOptOut(!event.target.checked)} className="w-4 h-4 text-green-600" />
              <span><span className="block font-medium text-gray-900">Email platform announcements</span><span className="text-sm text-gray-600">Email delivery can be disabled at any time.</span></span>
            </label>
            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={!announcementWhatsAppOptOut} onChange={(event) => setAnnouncementWhatsAppOptOut(!event.target.checked)} className="w-4 h-4 text-green-600" />
              <span><span className="block font-medium text-gray-900">WhatsApp platform announcements</span><span className="text-sm text-gray-600">Messages use the WhatsApp number on your store profile.</span></span>
            </label>
          </div>
          <button type="button" disabled={savingNotificationPreferences || !selectedStoreId} onClick={() => void saveNotificationPreferences()} className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{savingNotificationPreferences ? "Saving…" : "Save preferences"}</button>
        </div>
      )}

      {/* Danger Zone - Always visible */}
      <div className="mt-12 bg-red-50 border border-red-200 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Danger Zone</h2>
        <p className="text-sm text-gray-600 mb-6">Be careful with these actions. They cannot be undone.</p>
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 px-4 py-2 text-red-700 bg-white border border-red-200 rounded-lg font-medium hover:bg-red-50 transition-colors"
        >
          <LogOut size={20} /> Logout
        </button>
      </div>
    </div>
  );
}