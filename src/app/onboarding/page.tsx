"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { normalizeBusinessSlug, validateStoreSlug } from "@/lib/slugs";
import { storeHref, storeSubdomainsEnabled } from "@/lib/urls";
import { ChevronRight, Store, Package, CheckCircle2, LayoutGrid } from "lucide-react";

type Step = "offer" | "business" | "store" | "plan" | "product";
type BusinessType = "product" | "service" | "both";

const BUSINESS_TYPE_STORAGE_KEY = "sellup:onboarding:businessType";

/** Canonical slug suggestion derived from the merchant's business name. */
function deriveSlugFromName(name: string): string {
  const base = normalizeBusinessSlug(name);
  if (!base) return "";
  // validateBusinessSlug needs at least 3 characters — pad very short names
  // so the suggested URL is never too short to save.
  return base.length >= 3 ? base : normalizeBusinessSlug(`${base} store`);
}

const PRODUCT_CATEGORIES = [
  "Fashion",
  "Beauty Products",
  "Electronics",
  "Food",
  "Furniture",
  "Groceries",
  "Accessories",
  "Home & Living",
  "Digital Products",
  "Other",
];

const SERVICE_CATEGORIES = [
  "Beauty",
  "Photography",
  "Cleaning",
  "Repairs",
  "Education",
  "Fitness",
  "Consulting",
  "Technology",
  "Events",
  "Transportation",
  "Home Services",
  "Professional Services",
  "Other",
];

const DEFAULT_SIGNUP_PLANS = [
  { id: "freemium", name: "Freemium", price: 0, billingCycle: "monthly", features: ["5 Products", "1 Admin", "Basic Theme"] },
  { id: "starter", name: "Starter", price: 5000, billingCycle: "monthly", features: ["20 Products", "Listing Template", "No Branding", "SEO"] },
  { id: "business", name: "Business", price: 12000, billingCycle: "monthly", features: ["Unlimited Products", "5 Staff", "Inventory", "Coupons", "Custom Domain"] },
  { id: "pro", name: "Custom", price: 0, priceOnRequest: true, billingCycle: "monthly", features: ["Unlimited Everything", "API Access", "White Label"] },
];

interface BusinessForm {
  businessName: string;
  category: string;
  phone: string;
}

interface StoreForm {
  storeName: string;
  storeSlug: string;
  whatsappNumber: string;
}

interface ProductForm {
  name: string;
  price: string;
  description: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("offer");
  const [businessType, setBusinessType] = useState<BusinessType>("product");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [storeId, setStoreId] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("freemium");
  const [promotionCode, setPromotionCode] = useState("");
  const [signupPlans, setSignupPlans] = useState(DEFAULT_SIGNUP_PLANS);
  // Once the merchant edits the slug by hand it stops following the name.
  const [slugTouched, setSlugTouched] = useState(false);

  const [business, setBusiness] = useState<BusinessForm>({
    businessName: "",
    category: "",
    phone: "",
  });

  const [store, setStore] = useState<StoreForm>({
    storeName: "",
    storeSlug: "",
    whatsappNumber: "",
  });

  const [product, setProduct] = useState<ProductForm>({
    name: "",
    price: "",
    description: "",
  });

  async function checkAuth() {
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");
    const returnedStoreId = params.get("storeId");
    if (params.get("payment") === "success" && reference && returnedStoreId) {
      setLoading(true);
      const verification = await fetch(`/api/billing/verify?reference=${encodeURIComponent(reference)}`);
      if (!verification.ok) {
        setError("Payment could not be verified. Please contact support before retrying.");
        setLoading(false);
        return;
      }
      setStoreId(returnedStoreId);
      const storedType = sessionStorage.getItem(BUSINESS_TYPE_STORAGE_KEY);
      if (storedType === "service") {
        // Service businesses skip the product step entirely.
        await fetch("/api/stores/update", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ id: returnedStoreId, isPublished: true }),
        });
        router.push("/dashboard");
        setLoading(false);
        return;
      }
      setStep("product");
      setLoading(false);
    }
  }

  useEffect(() => {
    // Auth and payment callback state are synchronized after the client mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkAuth();
    void fetch("/api/subscriptions/plans")
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json();
        if (Array.isArray(result.plans) && result.plans.length > 0) setSignupPlans(result.plans);
      })
      .catch(() => {
        // Keep the existing plan choices available when the public plan service is temporarily unavailable.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitBusiness(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/stores/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          storeName: business.businessName,
          businessType,
          whatsappNumber: business.phone,
          description: `Business category: ${business.category}`,
          phone: business.phone,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create store");
      }

      const data = await res.json();
      setStoreId(data.store.id);
      setStore((prev) => ({
        ...prev,
        storeName: data.store.storeName,
        storeSlug: data.store.storeSlug,
      }));
      setStep("store");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function submitStore(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const normalizedSlug = normalizeBusinessSlug(store.storeSlug);
      if (!normalizedSlug) {
        setError("Business URL is required");
        setLoading(false);
        return;
      }
      const slugProblem = validateStoreSlug(normalizedSlug);
      if (slugProblem) {
        setError(slugProblem);
        setLoading(false);
        return;
      }

      const res = await fetch("/api/stores/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: storeId,
          storeName: store.storeName,
          storeSlug: normalizedSlug,
          whatsappNumber: store.whatsappNumber,
          isPublished: false,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update store");
      }

      setStep("plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function submitPlan() {
    setLoading(true);
    setError("");

    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      if (selectedPlan !== "freemium") {
        const res = await fetch("/api/billing/initialize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            storeId,
            plan: selectedPlan,
            provider: "paystack",
            ...(promotionCode.trim() ? { promotionCode: promotionCode.trim() } : {}),
          }),
        });

        const paymentData = await res.json();
        if (!res.ok || !paymentData.canPay || !paymentData.result?.authorizationUrl) {
          setError(paymentData.error || paymentData.message || "Payment could not be initialized. Please try again or choose Freemium.");
          setLoading(false);
          return;
        }

        window.location.assign(paymentData.result.authorizationUrl);
        return;
      }

      const res = await fetch("/api/stores/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: storeId,
          plan: selectedPlan,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update plan");
      }

      if (businessType === "service") {
        // Service businesses publish immediately - there is no product step.
        await fetch("/api/stores/update", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ id: storeId, isPublished: true }),
        });
        router.push(storeHref(store.storeSlug));
        return;
      }

      setStep("product");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function submitProduct(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/products/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          storeId,
          name: product.name,
          price: product.price,
          description: product.description,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create product");
      }

      await fetch("/api/stores/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: storeId,
          isPublished: true,
        }),
      });

      router.push(storeHref(store.storeSlug));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const allSteps: { key: Step; label: string; icon: React.ReactNode }[] = [
    { key: "offer", label: "Business Type", icon: <LayoutGrid size={18} /> },
    { key: "business", label: "Business", icon: <Store size={18} /> },
    { key: "store", label: "Page", icon: <Store size={18} /> },
    { key: "plan", label: "Plan", icon: <CheckCircle2 size={18} /> },
    { key: "product", label: "Product", icon: <Package size={18} /> },
  ];

  // Service businesses never add products, so the product step is hidden.
  const steps = allSteps.filter(
    (s) => s.key !== "product" || businessType !== "service"
  );
  const currentStepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Set Up Your Business
          </h1>
          <p className="text-gray-600">
            Let&apos;s get your business online in a few steps.
          </p>
        </div>

        <div className="flex items-center justify-between mb-8">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                  i <= currentStepIndex
                    ? "bg-[#DCF8C6] text-[#128C7E]"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {s.icon}
                {s.label}
              </div>
              {i < steps.length - 1 && (
                <ChevronRight
                  size={16}
                  className="mx-2 text-gray-300"
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {step === "offer" && (
          <div className="card p-8 space-y-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              What does your business offer?
            </h2>
            <p className="text-sm text-gray-600">
              This shapes your dashboard and public page. You can change it
              later in business settings.
            </p>
            <div className="space-y-3">
              {(
                [
                  {
                    value: "product",
                    title: "Sell Products",
                    description:
                      "For businesses selling physical or digital products.",
                  },
                  {
                    value: "service",
                    title: "Offer Services",
                    description:
                      "For businesses providing professional or local services.",
                  },
                  {
                    value: "both",
                    title: "Products & Services",
                    description: "For businesses doing both.",
                  },
                ] as { value: BusinessType; title: string; description: string }[]
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setBusinessType(option.value)}
                  disabled={loading}
                  className={`w-full text-left p-4 border-2 rounded-xl transition ${
                    businessType === option.value
                      ? "border-[#25D366] bg-[#DCF8C6]"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-bold text-gray-900">{option.title}</p>
                  <p className="text-sm text-gray-600">{option.description}</p>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem(BUSINESS_TYPE_STORAGE_KEY, businessType);
                setStep("business");
              }}
              className="w-full btn-primary py-3 text-lg font-semibold"
            >
              Continue
            </button>
          </div>
        )}

        {step === "business" && (
          <form onSubmit={submitBusiness} className="card p-8 space-y-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Business Information
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Business Name *
              </label>
              <input
                type="text"
                value={business.businessName}
                onChange={(e) =>
                  setBusiness({ ...business, businessName: e.target.value })
                }
                className="input"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Business Category *
              </label>
              <select
                value={business.category}
                onChange={(e) =>
                  setBusiness({ ...business, category: e.target.value })
                }
                className="input"
                required
                disabled={loading}
              >
                <option value="">Select category</option>
                {businessType !== "service" && (
                  <optgroup label="Products">
                    {PRODUCT_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </optgroup>
                )}
                {businessType !== "product" && (
                  <optgroup label="Services">
                    {SERVICE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                value={business.phone}
                onChange={(e) =>
                  setBusiness({ ...business, phone: e.target.value })
                }
                className="input"
                required
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 text-lg font-semibold disabled:opacity-50"
            >
              {loading ? "Creating..." : "Continue"}
            </button>
          </form>
        )}

        {step === "store" && (
          <form onSubmit={submitStore} className="card p-8 space-y-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Business Page Setup
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Business Name *
              </label>
              <input
                type="text"
                value={store.storeName}
                onChange={(e) => {
                  const storeName = e.target.value;
                  // The slug carries the business name until edited by hand.
                  setStore((prev) => ({
                    ...prev,
                    storeName,
                    storeSlug: slugTouched
                      ? prev.storeSlug
                      : deriveSlugFromName(storeName),
                  }));
                }}
                className="input"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Business URL (Slug) *
              </label>
              <div className="flex items-center gap-2">
                {!storeSubdomainsEnabled() && (
                  <span className="text-gray-500 text-sm">sellup.ng/</span>
                )}
                <input
                  type="text"
                  value={store.storeSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setStore({
                      ...store,
                      storeSlug: e.target.value
                        .toLowerCase()
                        .replace(/\s+/g, "-")
                        .replace(/[^a-z0-9-]/g, ""),
                    });
                  }}
                  className="input flex-1"
                  placeholder="your-business-name"
                  required
                  disabled={loading}
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                {normalizeBusinessSlug(store.storeSlug) &&
                validateStoreSlug(normalizeBusinessSlug(store.storeSlug)) ===
                  null ? (
                  <>
                    Customers will find you at{" "}
                    <span className="font-semibold text-[#128C7E]">
                      {storeHref(normalizeBusinessSlug(store.storeSlug), "", {
                        absolute: true,
                      })}
                    </span>
                  </>
                ) : (
                  "Suggested from your business name — edit it if you like."
                )}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                WhatsApp Number *
              </label>
              <input
                type="tel"
                value={store.whatsappNumber}
                onChange={(e) =>
                  setStore({ ...store, whatsappNumber: e.target.value })
                }
                className="input"
                required
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 text-lg font-semibold disabled:opacity-50"
            >
              {loading ? "Saving..." : "Continue"}
            </button>
          </form>
        )}

        {step === "plan" && (
          <div className="card p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              Choose Your Plan
            </h2>
            <div className="grid gap-4">
              {signupPlans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`p-4 border-2 rounded-xl text-left transition ${
                    selectedPlan === plan.id
                      ? "border-[#25D366] bg-[#DCF8C6]"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  disabled={loading}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-gray-900">{plan.name}</h3>
                      <p className="text-sm text-gray-600">
                        {plan.features.slice(0, 3).join(" • ")}
                      </p>
                    </div>
                    <span className="font-bold text-[#25D366]">
                      {plan.priceOnRequest || plan.price === 0
                        ? plan.priceOnRequest ? "Custom" : "Free"
                        : `₦${Number(plan.price).toLocaleString()}/${plan.billingCycle === "yearly" ? "year" : "mo"}`}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            {selectedPlan !== "freemium" && (
              <label className="mt-4 block text-sm font-medium text-gray-700">
                Promotion code (optional)
                <input
                  value={promotionCode}
                  onChange={(event) => setPromotionCode(event.target.value)}
                  maxLength={50}
                  autoCapitalize="characters"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
            )}
            <button
              onClick={submitPlan}
              disabled={loading}
              className="w-full btn-primary py-3 text-lg font-semibold disabled:opacity-50 mt-6"
            >
              {loading ? "Processing..." : "Continue"}
            </button>
          </div>
        )}

        {step === "product" && (
          <form onSubmit={submitProduct} className="card p-8 space-y-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Add Your First Product
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Product Name *
              </label>
              <input
                type="text"
                value={product.name}
                onChange={(e) =>
                  setProduct({ ...product, name: e.target.value })
                }
                className="input"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Price (₦) *
              </label>
              <input
                type="number"
                value={product.price}
                onChange={(e) =>
                  setProduct({ ...product, price: e.target.value })
                }
                className="input"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Description
              </label>
              <textarea
                value={product.description}
                onChange={(e) =>
                  setProduct({ ...product, description: e.target.value })
                }
                className="input resize-none"
                disabled={loading}
                rows={3}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 text-lg font-semibold disabled:opacity-50"
            >
              {loading ? "Publishing..." : "Publish Business"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
