/* eslint-disable @next/next/no-img-element -- image optimizer is unavailable on the standalone server */
import Link from "next/link";
import { ArrowLeft, MessageCircle, ShieldCheck, Truck } from "@/components/icons/lucide-icons";
import { formatCurrency } from "@/lib/utils";

/**
 * Static demo storefront reachable from /demo ("Browse demo store").
 * Shows the customer-facing store experience without touching the database.
 */

const DEMO_PRODUCTS = [
  {
    name: "Ankara Tote Bag",
    price: 12500,
    image:
      "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Shea Body Butter (250ml)",
    price: 4800,
    image:
      "https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Handstitched Leather Loafers",
    price: 25000,
    image:
      "https://images.unsplash.com/photo-1614252369475-531eba835eb1?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Scented Soy Candle",
    price: 6500,
    image:
      "https://images.unsplash.com/photo-1602874801006-e26c4c5b5c6a?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Woven Raffia Sun Hat",
    price: 8500,
    image:
      "https://images.unsplash.com/photo-1529958030586-3aae4ca485ff?auto=format&fit=crop&w=800&q=80",
  },
  {
    name: "Ceramic Dinner Set (12pc)",
    price: 32000,
    image:
      "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80",
  },
];

export default function DemoStorePage() {
  return (
    <div className="min-h-screen bg-[#faf7f2]">
      {/* Store header */}
      <header className="bg-[#128C7E] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-lg font-extrabold">
              AD
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">Adaeze Finds</p>
              <p className="text-xs text-white/75">
                Lagos made · Ships nationwide
              </p>
            </div>
          </div>
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-3 py-2 text-xs font-semibold transition hover:bg-white/10"
          >
            <ArrowLeft size={15} /> Back to demo
          </Link>
        </div>
      </header>

      {/* Hero banner */}
      <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <div className="rounded-[28px] bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-[#25D366]">
            Sample storefront
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
            Everything you see here is powered by Sell Up.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            This is what your customers experience: browse products, pick
            quantities and send the order straight to your WhatsApp. Create
            your own store and it can look exactly like this in minutes.
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-xs font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Truck size={14} className="text-[#25D366]" /> Nationwide
              delivery
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-[#25D366]" /> Pay on
              delivery or transfer
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle size={14} className="text-[#25D366]" /> Orders on
              WhatsApp
            </span>
          </div>
        </div>
      </section>

      {/* Product grid */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-lg font-bold text-slate-950 sm:text-xl">
            Latest products
          </h2>
          <span className="text-xs font-semibold text-slate-500">
            {DEMO_PRODUCTS.length} items
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:gap-6">
          {DEMO_PRODUCTS.map((product) => (
            <article
              key={product.name}
              className="group overflow-hidden rounded-3xl border border-slate-200 bg-white transition hover:border-[#25D366] hover:shadow-md"
            >
              <div className="relative aspect-square overflow-hidden bg-slate-100">
                <img
                  src={product.image}
                  alt={product.name}
                  className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-4">
                <h3 className="text-sm font-bold leading-5 text-slate-950">
                  {product.name}
                </h3>
                <p className="mt-1.5 text-sm font-extrabold text-[#128C7E]">
                  {formatCurrency(product.price)}
                </p>
                <a
                  href="https://wa.me/2340000000000"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 py-2.5 text-xs font-bold text-white transition hover:bg-[#1eb855]"
                >
                  <MessageCircle size={15} /> Order on WhatsApp
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Footer note */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center sm:px-6">
          <p className="text-sm font-semibold text-slate-700">
            This is a sample store — orders are not sent anywhere.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/register" className="btn-primary text-sm">
              Build your own store
            </Link>
            <Link href="/demo" className="btn-outline text-sm">
              Back to demo overview
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
