"use client";

/* eslint-disable @next/next/no-img-element -- image optimizer is unavailable on the standalone server */

import Link from "next/link";
import { MarketingFooter } from "./marketing-footer";
import { Reveal } from "./reveal";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  MessageCircle,
  Package,
  ShieldCheck,
  Smartphone,
  Store,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { StoreExamples } from "@/components/store-examples";
import { WhatsAppIcon } from "@/components/icons/whatsapp";

const stats = [
  { value: "10 min", label: "Average store setup" },
  { value: "₦0", label: "Free plan, forever" },
  { value: "3 steps", label: "To your first order" },
  { value: "100%", label: "Mobile-first" },
];

const steps = [
  {
    number: "01",
    title: "Merchant Account",
    description: "Sign up and tell us what you sell.",
    icon: Store,
  },
  {
    number: "02",
    title: "Add your products",
    description: "Upload your items, prices and details.",
    icon: Package,
  },
  {
    number: "03",
    title: "Start selling on WhatsApp",
    description: "Customers order and you get the message instantly.",
    icon: WhatsAppIcon,
  },
];

const featureRows = [
  {
    icon: Store,
    title: "Your store, live in minutes.",
    body: "Sign up, add your products and share one link. If you can use WhatsApp, you can run a Sell Up store — no developer, no hosting, no stress.",
    points: [
      "Free store link to start with",
      "Add photos, prices and categories from your phone",
      "Switch themes whenever you like",
    ],
    image: "/assets/shop2.jpg",
    alt: "Shop owner smiling with a customer at the counter",
    badge: "store",
    badgeTitle: "Zara's Collection is live",
    badgeText: "sellup.ng/zaras",
    ctaHref: "/register",
    ctaLabel: "Start free",
  },
  {
    icon: WhatsAppIcon,
    title: "Orders land straight in WhatsApp.",
    body: "Customers browse and check out, and the complete order — items, totals and delivery details — arrives in the chat you already use every day.",
    points: [
      "No new app for you or your customers",
      "Confirm, track and reply in the same chat",
      "Get paid your way — bank transfer, cash, whatever you use",
    ],
    image: "/assets/shop1.jpg",
    alt: "Two colleagues reviewing their orders together",
    badge: "whatsapp",
    badgeTitle: "New order · ₦27,000",
    badgeText: "3 items from Chidi in Lagos",
    ctaHref: "/how-it-works",
    ctaLabel: "See how it works",
  },
];

const benefits = [
  {
    icon: Package,
    title: "Products & themes",
    description: "Photos, prices and a storefront that matches your brand.",
  },
  {
    icon: Users,
    title: "Team accounts",
    description: "Bring staff in with their own logins on the Business plan.",
  },
  {
    icon: ShieldCheck,
    title: "Domains & security",
    description: "Connect a custom domain and keep your data protected.",
  },
  {
    icon: Zap,
    title: "Free plan, ₦0",
    description: "Start selling without paying a kobo.",
  },
];

const whyItems = [
  { icon: Zap, title: "No Coding Needed", description: "Set up your store in minutes." },
  { icon: Smartphone, title: "Mobile Friendly", description: "Beautiful on every device." },
  { icon: ShieldCheck, title: "Secure & Reliable", description: "Your data stays protected." },
  { icon: Users, title: "Local Support", description: "Help from people who understand." },
  { icon: MessageCircle, title: "Always Improving", description: "Powerful tools keep coming." },
  { icon: TrendingUp, title: "Future Ready", description: "Built to grow with you." },
];

const inventoryItems = [
  {
    name: "Silk Dress",
    image:
      "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=320&q=85",
    stock: 24,
    percent: 78,
    low: false,
  },
  {
    name: "Linen Set",
    image:
      "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=320&q=85",
    stock: 4,
    percent: 16,
    low: true,
  },
  {
    name: "Mini Bag",
    image:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=320&q=85",
    stock: 12,
    percent: 52,
    low: false,
  },
];

const plans = [
  {
    name: "Freemium",
    price: "₦0",
    priceSuffix: "/mo",
    description: "Start selling for free",
    features: ["Up to 5 products", "1 store admin", "Basic theme"],
  },
  {
    name: "Starter",
    price: "₦5,000",
    priceSuffix: "/mo",
    description: "For growing businesses",
    features: ["20 products", "Product listing template", "No branding"],
    featured: true,
  },
  {
    name: "Business",
    price: "₦12,000",
    priceSuffix: "/mo",
    description: "For busy stores",
    features: ["Unlimited products", "Multiple staff", "Coupons & domain"],
  },
  {
    name: "Custom",
    price: "Custom",
    priceSuffix: "",
    description: "Tailored to your business",
    features: ["Unlimited everything", "API access", "White label"],
  },
];

const faqs = [
  {
    question: "Do I need a website or any coding skills?",
    answer:
      "No. Sell Up is built for phone-first business owners. You add your products in the dashboard, and your store link is ready to share — no code, no hosting, no developer.",
  },
  {
    question: "How do customers place orders?",
    answer:
      "Customers open your store link, pick what they want and tap Order. The complete order — items, totals, delivery details — lands directly in your WhatsApp chat so you can confirm and fulfil it.",
  },
  {
    question: "Is there really a free plan?",
    answer:
      "Yes. The ₦0 Freemium plan lets you list up to 5 products with a basic theme, forever. Upgrade to Starter (₦5,000/mo) for 20 products and the product listing template, or Business (₦12,000/mo) for unlimited products, staff and coupons.",
  },
  {
    question: "Can I run everything from my phone?",
    answer:
      "Absolutely. Adding products, tracking orders, changing your theme and replying to customers all work from mobile — if you can use WhatsApp, you can run your Sell Up store.",
  },
  {
    question: "How do I get paid?",
    answer:
      "You and the customer confirm payment directly on WhatsApp using whatever method you already trust — bank transfer, mobile money or cash on delivery. Sell Up handles the order, you keep your payment flow.",
  },
];

const storeProducts = [
  {
    name: "Silk Dress",
    price: "₦12,000",
    image:
      "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=320&q=85",
  },
  {
    name: "Linen Set",
    price: "₦18,000",
    image:
      "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=320&q=85",
  },
  {
    name: "Mini Bag",
    price: "₦9,000",
    image:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=320&q=85",
  },
];

export function Homepage() {
  const [activePlan, setActivePlan] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const currentPlan = plans[activePlan];

  const showPreviousPlan = () =>
    setActivePlan((index) => (index - 1 + plans.length) % plans.length);

  const showNextPlan = () =>
    setActivePlan((index) => (index + 1) % plans.length);

  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-950">
      {/* ============ HERO — bold statement, dual CTAs ============ */}
      <section className="relative overflow-hidden bg-[#f8fbf8] px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:px-8 lg:pb-24 lg:pt-20">
        <Reveal>
        <div className="pointer-events-none absolute left-1/2 top-[-10rem] h-96 w-96 -translate-x-1/2 rounded-full bg-[#25D366]/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-[-6rem] h-72 w-72 rounded-full bg-[#128C7E]/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
          {/* Copy */}
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#b7ecd0] bg-white px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#128C7E] shadow-sm sm:text-xs">
              <span className="h-2 w-2 rounded-full bg-[#25D366]" />
              Built for Nigerian Businesses
            </span>

            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl xl:text-[4.25rem]">
              Everything Your Business{" "}
              <span className="text-[#128C7E]">Needs to Sell Online.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg lg:mx-0 lg:text-xl">
              Create your store, list your products and take orders on
              WhatsApp — all from your phone. No coding, no website headaches.
            </p>

            {/* Dual CTAs */}
            <div className="mt-8 grid grid-cols-[1.8fr_1fr] gap-2 sm:flex sm:justify-center sm:gap-3 lg:justify-start">
              <Link
                href="/register"
                className="inline-flex min-h-14 w-full min-w-0 items-center justify-center gap-1 rounded-2xl bg-[#25D366] px-2 py-4 text-xs font-extrabold text-white shadow-xl shadow-green-500/25 transition hover:bg-[#1ebd57] sm:w-auto sm:gap-2 sm:px-7 sm:text-base"
              >
                Start your free store <ArrowRight size={18} />
              </Link>
              <Link
                href="#pricing"
                className="inline-flex min-h-14 w-full min-w-0 items-center justify-center gap-1 rounded-2xl border border-slate-300 bg-white px-2 py-4 text-xs font-extrabold text-slate-900 transition hover:border-slate-400 hover:bg-slate-50 sm:w-auto sm:gap-2 sm:px-7 sm:text-base"
              >
                See pricing
              </Link>
            </div>

            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-sm">
              Free plan · No coding · Ready in minutes
            </p>
          </div>

          {/* Store mockup */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_36px_90px_-45px_rgba(18,140,126,0.55)] sm:rounded-[36px] sm:p-6">
              <div className="flex items-center justify-between rounded-2xl bg-[#128C7E] px-4 py-3 text-white">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
                    Live store
                  </p>
                  <p className="text-sm font-extrabold">
                    Zara&apos;s Collection
                  </p>
                </div>
                <div className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold">
                  Fashion
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {storeProducts.map((item) => (
                  <div
                    key={item.name}
                    className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50"
                  >
                    <div className="relative aspect-square">
                      { }
                      <img
                        src={item.image}
                        alt={item.name}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </div>
                    <div className="p-2">
                      <p className="truncate text-[11px] font-bold text-slate-900">
                        {item.name}
                      </p>
                      <p className="text-[11px] font-extrabold text-[#128C7E]">
                        {item.price}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-[#d5efdb] bg-[#f2fdf5] px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <WhatsAppIcon size={15} className="text-[#25D366]" />
                  Order sent to WhatsApp
                </div>
                <ArrowRight size={15} className="text-[#128C7E]" />
              </div>
            </div>

            <a
              href="#examples"
              className="mt-6 flex items-center justify-center gap-2 text-sm font-extrabold text-[#128C7E] hover:underline lg:mt-8"
            >
              See store examples <ArrowRight size={16} />
            </a>
          </div>
        </div>
        </Reveal>
      </section>

      {/* ============ STATS STRIP ============ */}
      <section className="bg-slate-950 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <Reveal>
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-extrabold tracking-tight text-[#25D366] sm:text-4xl lg:text-5xl">
                {stat.value}
              </p>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 sm:text-xs">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
        </Reveal>
      </section>

      {/* ============ STORE EXAMPLES ============ */}
      <Reveal delay={120}>
        <StoreExamples />
      </Reveal>

      {/* ============ WHY SELL UP — bento feature cards ============ */}
      <section className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <Reveal>
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center lg:max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-[#25D366] sm:text-sm">
              Features
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              Everything you need to sell. Nothing you don&apos;t.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-lg">
              Built for how Nigerian businesses actually sell — quick, simple
              and straight from your phone.
            </p>
          </div>

          {/* Feature rows — skite.co style, alternating copy and imagery */}
          <div className="mt-10 space-y-12 sm:mt-16 sm:space-y-20">
            {featureRows.map((row, index) => {
              const Icon = row.icon;
              return (
                <div
                  key={row.title}
                  className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14"
                >
                  <div className={index % 2 === 1 ? "lg:order-2" : undefined}>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#25D366] text-white shadow-lg shadow-green-500/20">
                      <Icon size={26} />
                    </div>
                    <h3 className="mt-6 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
                      {row.title}
                    </h3>
                    <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                      {row.body}
                    </p>
                    <ul className="mt-5 space-y-2.5">
                      {row.points.map((point) => (
                        <li
                          key={point}
                          className="flex items-start gap-2.5 text-sm font-semibold text-slate-700"
                        >
                          <Check
                            size={16}
                            className="mt-0.5 shrink-0 text-[#25D366]"
                          />
                          {point}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={row.ctaHref}
                      className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-[#128C7E] hover:underline"
                    >
                      {row.ctaLabel} <ArrowRight size={16} />
                    </Link>
                  </div>

                  <div className={index % 2 === 1 ? "lg:order-1" : undefined}>
                    <div className="relative">
                      <div className="relative overflow-hidden rounded-[28px] border border-slate-200 shadow-[0_36px_90px_-45px_rgba(18,140,126,0.55)] sm:rounded-[36px]">
                        <div className="relative aspect-[4/3] sm:aspect-[16/11]">
                          { }
                          <img
                            src={row.image}
                            alt={row.alt}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        </div>
                      </div>
                      <div className="absolute -bottom-5 left-4 right-4 flex items-center gap-3 rounded-2xl border border-[#d5efdb] bg-white px-4 py-3 shadow-xl sm:left-6 sm:right-auto sm:max-w-xs">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f2fdf5]">
                          {row.badge === "whatsapp" ? (
                            <WhatsAppIcon
                              size={18}
                              className="text-[#25D366]"
                            />
                          ) : (
                            <Store size={18} className="text-[#128C7E]" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-extrabold text-slate-900">
                            {row.badgeTitle}
                          </p>
                          <p className="truncate text-[11px] text-slate-500">
                            {row.badgeText}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-14 grid grid-cols-2 gap-4 sm:mt-16 sm:gap-5 lg:grid-cols-4">
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <article
                  key={benefit.title}
                  className="rounded-[24px] border border-slate-200 bg-white p-5 transition hover:border-[#25D366]/60 hover:shadow-lg hover:shadow-green-500/5 sm:rounded-[28px] sm:p-6"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f2fdf5] text-[#128C7E]">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-4 text-base font-extrabold text-slate-950 sm:text-lg">
                    {benefit.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">
                    {benefit.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
        </Reveal>
      </section>

      {/* ============ HOW IT WORKS — 3 steps ============ */}
      <section className="bg-[#f8fbf8] px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <Reveal>
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-[#25D366] sm:text-sm">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              Live in three steps.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-lg">
              No delays, no developers. From sign-up to first order the same
              day.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-3 sm:gap-5">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <article
                  key={step.number}
                  className="relative rounded-[28px] border border-slate-200 bg-white p-6 sm:rounded-[32px] sm:p-7"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-4xl font-extrabold tracking-tight text-[#25D366]/30 sm:text-5xl">
                      {step.number}
                    </span>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#128C7E] text-white">
                      <Icon size={20} />
                    </div>
                  </div>
                  <h3 className="mt-5 text-lg font-extrabold text-slate-950 sm:text-xl">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {step.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
        </Reveal>
      </section>

      {/* ============ PRICING ============ */}
      <section
        id="pricing"
        className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-28"
      >
        <Reveal>
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center lg:max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-[#25D366] sm:text-sm">
              Pricing
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              Simple pricing that grows with you.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-lg">
              Start free. Upgrade when you&apos;re ready — cancel anytime.
            </p>
          </div>

          {/* Mobile: single-plan carousel */}
          <div className="mt-9 sm:hidden">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">
                  {activePlan + 1} of {plans.length}
                </span>
                <p className="mt-1 text-xl font-extrabold text-slate-950">
                  {currentPlan.name}
                </p>
              </div>
              <div className="flex items-center gap-3 text-slate-500">
                <button
                  type="button"
                  aria-label="Previous plan"
                  onClick={showPreviousPlan}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]"
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label="Next plan"
                  onClick={showNextPlan}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]"
                >
                  →
                </button>
              </div>
            </div>

            <article
              className={`mt-4 rounded-[28px] border p-6 ${
                currentPlan.featured
                  ? "border-[#25D366] bg-white shadow-xl shadow-green-500/10"
                  : "border-slate-200 bg-white"
              }`}
            >
              {currentPlan.featured && (
                <span className="rounded-full bg-[#DCF8C6] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#128C7E]">
                  Most popular
                </span>
              )}
              <h3 className="mt-3 text-2xl font-extrabold text-slate-950">
                {currentPlan.name}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {currentPlan.description}
              </p>
              <p className="mt-5 text-4xl font-extrabold text-slate-950">
                {currentPlan.price}
                <span className="text-sm font-medium text-slate-400">
                  {currentPlan.priceSuffix}
                </span>
              </p>
              <ul className="mt-5 space-y-3">
                {currentPlan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2.5 text-sm font-semibold text-slate-600"
                  >
                    <Check size={16} className="shrink-0 text-[#25D366]" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className={`mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl px-4 py-4 text-sm font-extrabold ${
                  currentPlan.featured
                    ? "bg-[#25D366] text-white"
                    : "border border-[#25D366] text-[#128C7E]"
                }`}
              >
                Choose {currentPlan.name}
              </Link>
            </article>

            <div className="mt-5 flex justify-center gap-1.5">
              {plans.map((plan, index) => (
                <button
                  key={plan.name}
                  type="button"
                  aria-label={`Show ${plan.name} plan`}
                  onClick={() => setActivePlan(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === activePlan
                      ? "w-6 bg-[#25D366]"
                      : "w-2 bg-slate-300"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Tablet & up: full grid */}
          <div className="mt-10 hidden gap-4 sm:grid sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-[28px] border p-5 text-left sm:p-6 ${
                  plan.featured
                    ? "border-[#25D366] bg-white shadow-xl shadow-green-500/10"
                    : "border-slate-200 bg-white"
                }`}
              >
                {plan.featured && (
                  <span className="rounded-full bg-[#DCF8C6] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#128C7E]">
                    Most popular
                  </span>
                )}
                <h3 className="mt-4 text-lg font-extrabold text-slate-950">
                  {plan.name}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {plan.description}
                </p>
                <p className="mt-4 text-2xl font-extrabold text-slate-950">
                  {plan.price}
                  <span className="text-xs font-medium text-slate-400">
                    {plan.priceSuffix}
                  </span>
                </p>
                <ul className="mt-4 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-xs font-semibold text-slate-600"
                    >
                      <Check size={14} className="shrink-0 text-[#25D366]" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`mt-5 flex min-h-12 w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-extrabold ${
                    plan.featured
                      ? "bg-[#25D366] text-white"
                      : "border border-[#25D366] text-[#128C7E]"
                  }`}
                >
                  Choose {plan.name}
                </Link>
              </article>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            Need something bigger?{" "}
            <Link
              href="/pricing"
              className="font-extrabold text-[#128C7E] hover:underline"
            >
              Compare all plans →
            </Link>
          </p>
        </div>
        </Reveal>
      </section>

      {/* ============ WHY SELL UP — mobile + laptop dashboard ============ */}
      <section className="bg-[#f0faf1] px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <Reveal>
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Left — copy + compact feature list (image 2) */}
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-[#128C7E] sm:text-sm">
              Why Sell Up?
            </p>
            <h2 className="mt-4 text-3xl font-extrabold leading-[1.08] tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              Built for Nigerian businesses.{" "}
              <span className="text-[#128C7E]">Loved by customers.</span>
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-600 sm:text-base">
              Sell Up makes it easy to look professional online and sell more
              without the stress of complicated platforms.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-5 sm:gap-x-8 sm:gap-y-6 lg:gap-x-10">
              {whyItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex items-start gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e3f2e7] bg-white text-[#128C7E] shadow-[0_4px_14px_-6px_rgba(18,140,126,0.25)]">
                      <Icon size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-slate-950">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-5 text-slate-500">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right — laptop dashboard: Sales · Finance · Inventory */}
          <div className="relative">
            {/* Laptop screen */}
            <div className="rounded-t-[18px] bg-slate-800 p-2 shadow-[0_30px_80px_-50px_rgba(18,140,126,0.55)] sm:rounded-t-[24px] sm:p-3">
              <div className="overflow-hidden rounded-t-lg bg-white sm:rounded-t-xl">
                {/* Browser bar */}
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="flex shrink-0 gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
                    <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
                    <span className="h-2 w-2 rounded-full bg-[#28c840]" />
                  </span>
                  <span className="ml-1 min-w-0 truncate rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
                    sellup.ng/zaras/dashboard
                  </span>
                  <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e8f8ee] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#128C7E]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#25D366]" />
                    Live
                  </span>
                </div>

                {/* Dashboard body */}
                <div className="p-3 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400">
                        Dashboard
                      </p>
                      <p className="text-sm font-extrabold text-slate-950 sm:text-base">
                        Zara&apos;s Collection
                      </p>
                    </div>
                    <div className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5 text-[9px] font-bold sm:text-[10px]">
                      <span className="rounded-md bg-white px-2 py-1 text-[#128C7E] shadow-sm">
                        Sales
                      </span>
                      <span className="rounded-md px-2 py-1 text-slate-500">
                        Finance
                      </span>
                      <span className="rounded-md px-2 py-1 text-slate-500">
                        Inventory
                      </span>
                    </div>
                  </div>
                  {/* __KPI_CHART__ */}

                  {/* KPI cards */}
                  <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-3">
                    <div className="rounded-xl border border-slate-100 bg-white p-2 sm:p-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#f2fdf5] text-[#128C7E] sm:h-8 sm:w-8">
                        <TrendingUp size={13} />
                      </span>
                      <p className="mt-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                        Sales
                      </p>
                      <p className="text-xs font-extrabold text-slate-950 sm:text-sm">
                        ₦284,500
                      </p>
                      <p className="text-[9px] font-bold text-[#25D366]">
                        +12.4% this week
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-white p-2 sm:p-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#f2fdf5] text-[#128C7E] sm:h-8 sm:w-8">
                        <Wallet size={13} />
                      </span>
                      <p className="mt-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                        Finance
                      </p>
                      <p className="text-xs font-extrabold text-slate-950 sm:text-sm">
                        ₦1.24m
                      </p>
                      <p className="text-[9px] font-bold text-slate-500">
                        ₦480k ready to pay out
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-white p-2 sm:p-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#fff8ec] text-[#d97706] sm:h-8 sm:w-8">
                        <Package size={13} />
                      </span>
                      <p className="mt-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                        Inventory
                      </p>
                      <p className="text-xs font-extrabold text-slate-950 sm:text-sm">
                        142 items
                      </p>
                      <p className="text-[9px] font-bold text-[#d97706]">
                        7 low stock
                      </p>
                    </div>
                  </div>
                  {/* Sales chart + inventory panel */}
                  <div className="mt-2.5 grid gap-2.5 lg:grid-cols-5">
                    <div className="rounded-xl border border-slate-100 bg-white p-3 lg:col-span-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-extrabold text-slate-950">
                          Sales this week
                        </p>
                        <p className="text-[9px] font-bold text-slate-400">
                          Mon – Sun
                        </p>
                      </div>
                      <div className="mt-2.5 flex h-14 items-end gap-1.5 sm:h-20">
                        {[38, 52, 44, 68, 56, 88, 74].map((height, index) => (
                          <div
                            key={`bar-${height}-${index}`}
                            className={`flex-1 rounded-t-md ${
                              index === 5 ? "bg-[#25D366]" : "bg-[#bdeed0]"
                            }`}
                            style={{ height: `${height}%` }}
                          />
                        ))}
                      </div>
                      <div className="mt-1.5 flex gap-1.5">
                        {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                          <span
                            key={`day-${day}-${index}`}
                            className="flex-1 text-center text-[8px] font-bold text-slate-400"
                          >
                            {day}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-white p-3 lg:col-span-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-extrabold text-slate-950">
                          Inventory
                        </p>
                        <span className="rounded-full bg-[#e8f8ee] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#128C7E]">
                          Live
                        </span>
                      </div>
                      <ul className="mt-2 space-y-2">
                        {inventoryItems.map((item) => (
                          <li
                            key={item.name}
                            className="flex items-center gap-2"
                          >
                            <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-lg border border-slate-100">
                              { }
                              <img
                                src={item.image}
                                alt={item.name}
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-slate-700">
                              {item.name}
                            </span>
                            <span
                              className={`shrink-0 text-[9px] font-extrabold ${
                                item.low ? "text-[#d97706]" : "text-[#128C7E]"
                              }`}
                            >
                              {item.low ? "Low" : `${item.stock} in stock`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Laptop base */}
            <div className="relative left-1/2 h-3 w-[108%] -translate-x-1/2 rounded-b-xl bg-gradient-to-b from-slate-300 to-slate-400 sm:h-4">
              <div className="absolute left-1/2 top-0 h-1.5 w-16 -translate-x-1/2 rounded-b-md bg-slate-400 sm:w-24" />
            </div>
          </div>
        </div>
        </Reveal>
      </section>

      {/* ============ FAQ ============ */}
      <section className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <Reveal>
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-[#25D366] sm:text-sm">
              FAQ
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              Questions, answered.
            </h2>
          </div>

          <div className="mt-9 space-y-3 sm:mt-12 sm:space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={faq.question}
                  className={`rounded-2xl border transition ${
                    isOpen
                      ? "border-[#25D366]/60 bg-white shadow-lg shadow-green-500/5"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
                  >
                    <span className="text-sm font-extrabold text-slate-950 sm:text-base">
                      {faq.question}
                    </span>
                    <ChevronDown
                      size={18}
                      className={`shrink-0 text-[#128C7E] transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="px-5 pb-5 text-sm leading-6 text-slate-600 sm:px-6 sm:pb-6">
                      {faq.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        </Reveal>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="px-4 pb-14 sm:px-6 sm:pb-20 lg:px-8 lg:pb-28">
        <Reveal>
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[32px] bg-[#128C7E] px-5 py-12 text-center text-white sm:rounded-[40px] sm:px-10 sm:py-16">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full border-[28px] border-white/10" />
          <div className="absolute -bottom-20 -left-14 h-52 w-52 rounded-full border-[24px] border-white/10" />

          <div className="relative">
            <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-[#baf3c8] sm:text-sm">
              Your next customer is online
            </p>
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Launch your store today.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/75 sm:text-lg">
              Join thousands of businesses growing with simple WhatsApp
              selling. Free to start — no card needed.
            </p>

            <p className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-bold text-white sm:text-sm">
              <WhatsAppIcon size={16} className="text-[#25D366]" />
              Orders arrive straight in your WhatsApp
            </p>

            {/* Dual CTAs */}
            <div className="mt-8 grid grid-cols-[2.2fr_1fr] items-stretch gap-2 sm:flex sm:justify-center sm:gap-3">
              <Link
                href="/register"
                className="inline-flex min-h-14 w-full min-w-0 items-center justify-center gap-0 rounded-2xl bg-white px-2 py-4 text-[11px] font-extrabold text-[#128C7E] shadow-xl sm:w-auto sm:gap-2 sm:px-7 sm:text-base"
              >
                Start your free store <ArrowRight size={16} />
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-14 w-full min-w-0 items-center justify-center gap-1 rounded-2xl border border-white/40 px-2 py-4 text-xs font-extrabold text-white transition hover:bg-white/10 sm:w-auto sm:gap-2 sm:px-7 sm:text-base"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
        </Reveal>
      </section>

      {/* ============ FOOTER ============ */}
      <MarketingFooter />
    </main>
  );
}
