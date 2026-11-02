/* eslint-disable @next/next/no-img-element -- image optimizer is unavailable on the standalone server */
import Link from "next/link";
import {
  ArrowRight,
  LayoutGrid,
  Package,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
} from "@/components/icons/lucide-icons";
import { MarketingCta, MarketingHero, MarketingShell } from "@/components/marketing-shell";
import { WhatsAppIcon } from "@/components/icons/whatsapp";

const features = [
  [Zap, "Professional Store", "Beautiful, mobile-friendly stores that build trust and increase sales."],
  [WhatsAppIcon, "WhatsApp Orders", "Orders go straight to your WhatsApp instantly. No more missed messages."],
  [TrendingUp, "Sales Analytics", "Track orders, revenue, customers and top products in real time."],
  [Package, "Discounts & Coupons", "Create offers and coupons to boost sales and reward loyal customers."],
  [Users, "Customer Management", "Keep track of customers, order history and total spending."],
  [LayoutGrid, "Customizable Store", "Choose colors, fonts, banners and make the store truly yours."],
];

export default function FeaturesPage() {
  return (
    <MarketingShell>
      <MarketingHero
        eyebrow="Powerful features"
        title="Everything you need to grow your business"
        description="Sell Up brings your storefront, orders, customers and growth tools together in one simple place."
      />

      {/* What is Sell Up? — skite.co style prose intro with imagery */}
      <section className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-[#25D366] sm:text-sm">
              What is Sell Up?
            </p>
            <h2 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
              One simple platform for your whole business.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">
              Sell Up lets you set up a professional online store from your
              phone, share it anywhere and run every order through the WhatsApp
              chat you already use. Products, customers, coupons and analytics
              live together in one dashboard — no coding, no hosting, no
              developer.
            </p>
            <Link
              href="/register"
              className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-[#128C7E] hover:underline"
            >
              Start free <ArrowRight size={16} />
            </Link>
          </div>
          <div className="relative overflow-hidden rounded-[28px] border border-slate-200 shadow-[0_36px_90px_-45px_rgba(18,140,126,0.55)] sm:rounded-[36px]">
            <div className="relative aspect-[4/3] sm:aspect-[16/11]">
              <img
                src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=80"
                alt="Shop owner serving a customer at the counter"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
            <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-2xl border border-[#d5efdb] bg-white/95 px-4 py-3 shadow-xl backdrop-blur sm:right-auto sm:max-w-xs">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f2fdf5]">
                <WhatsAppIcon size={18} className="text-[#25D366]" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-extrabold text-slate-900">
                  New order received
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  Straight to your WhatsApp
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature grid — big icon tiles, responsive 1 → 2 → 3 columns */}
      <section className="px-4 pb-14 sm:px-6 sm:pb-20 lg:px-8 lg:pb-24">
        <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
          {features.map(([Icon, title, description]) => {
            const FeatureIcon = Icon as typeof Zap;
            return (
              <div
                key={title as string}
                className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#25D366]/60 hover:shadow-lg hover:shadow-green-500/5 sm:rounded-[32px] sm:p-8"
              >
                <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-[#DCF8C6] text-[#128C7E]">
                  <FeatureIcon size={26} />
                </div>
                <h2 className="mb-3 text-lg font-bold text-slate-950 sm:text-xl">
                  {title as string}
                </h2>
                <p className="text-sm leading-6 text-slate-600 sm:text-base">
                  {description as string}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Built for band — with real WhatsApp glyph */}
      <section className="border-y border-slate-200 bg-[#f1fbf3] px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
          <div>
            <ShieldCheck className="text-[#128C7E]" />
            <h2 className="mt-4 text-xl font-bold text-slate-950">Built for trust</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Clear product details and a polished storefront help customers buy with confidence.
            </p>
          </div>
          <div>
            <TrendingUp className="text-[#128C7E]" />
            <h2 className="mt-4 text-xl font-bold text-slate-950">Built for insight</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              See which products and channels are actually moving your business forward.
            </p>
          </div>
          <div>
            <WhatsAppIcon className="text-[#128C7E]" size={24} />
            <h2 className="mt-4 text-xl font-bold text-slate-950">Built for conversation</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Keep the familiar WhatsApp handoff at the heart of every order.
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 text-center sm:px-6">
        <h2 className="text-2xl font-bold text-slate-950 sm:text-3xl">
          Ready to put the tools to work?
        </h2>
        <Link
          href="/register"
          className="btn-primary mt-7 inline-flex items-center gap-2"
        >
          Create your free store <ArrowRight size={17} />
        </Link>
      </section>

      <MarketingCta />
    </MarketingShell>
  );
}
