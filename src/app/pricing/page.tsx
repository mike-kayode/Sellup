import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { MarketingHero, MarketingShell } from "@/components/marketing-shell";

const plans = [
  {
    title: "Freemium",
    price: "₦0",
    priceSuffix: "/month",
    description: "Perfect for getting started",
    items: ["Up to 5 Products", "1 Store Admin", "Basic Theme"],
  },
  {
    title: "Starter",
    price: "₦5,000",
    priceSuffix: "/month",
    description: "For growing businesses",
    items: ["20 Products", "Product Listing Template", "Remove Branding"],
    featured: true,
  },
  {
    title: "Business",
    price: "₦12,000",
    priceSuffix: "/month",
    description: "Everything you need to scale",
    items: ["Unlimited Products", "Multiple Staff", "Inventory & Coupons"],
  },
  {
    title: "Custom",
    price: "Custom",
    priceSuffix: "Tailored pricing",
    description: "Built around your business",
    items: ["Unlimited Everything", "API Access", "White Label"],
  },
];

export default function PricingPage() {
  return (
    <MarketingShell>
      <MarketingHero
        eyebrow="Pricing plans"
        title="Simple, transparent pricing"
        description="Start for free, then choose the plan that fits the pace and ambition of your business."
      />

      <section className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.title}
              className={`flex flex-col rounded-[28px] border p-5 sm:p-6 lg:p-8 ${
                plan.featured
                  ? "border-[#25D366] bg-white shadow-[0_20px_80px_-40px_rgba(37,211,102,0.24)]"
                  : "border-slate-200 bg-white"
              }`}
            >
              {plan.featured && (
                <div className="mb-4 inline-flex w-fit rounded-full bg-[#DCF8C6] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#128C7E]">
                  Most Popular
                </div>
              )}
              <h2 className="mb-2 text-xl font-bold text-slate-950 sm:text-2xl">
                {plan.title}
              </h2>
              <p className="mb-6 text-sm text-slate-600 sm:text-base">
                {plan.description}
              </p>
              <div className="text-3xl font-bold text-slate-950 sm:text-4xl">
                {plan.price}
              </div>
              <p className="mb-6 text-sm text-slate-500 sm:mb-8">
                {plan.priceSuffix === "/month"
                  ? "/month"
                  : plan.priceSuffix}
              </p>
              <ul className="mb-6 space-y-3 text-sm text-slate-600 sm:mb-8">
                {plan.items.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <Check size={16} className="shrink-0 text-[#25D366]" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className={`mt-auto flex min-h-12 w-full items-center justify-center rounded-xl px-4 py-3 text-center font-bold transition ${
                  plan.featured
                    ? "btn-primary"
                    : "border border-[#25D366] text-[#128C7E] hover:bg-[#f1fbf3]"
                }`}
              >
                {plan.price === "Custom" ? "Contact us" : `Choose ${plan.title}`}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-[#f1fbf3] px-4 py-12 sm:px-6 sm:py-14">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#128C7E]">
              Every plan includes
            </p>
            <p className="mt-2 text-base font-semibold text-slate-950 sm:text-lg">
              A mobile-ready store, WhatsApp orders and local-friendly support.
            </p>
          </div>
          <Link
            href="/features"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#128C7E]"
          >
            Compare features <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
