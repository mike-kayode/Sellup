"use client";

/* eslint-disable @next/next/no-img-element -- image optimizer is unavailable on the standalone server */

import { useState } from "react";
import { storeHref } from "@/lib/urls";

const stores = [
  {
    title: "Zara's Collection",
    category: "Fashion",
    image: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "FoodVilla",
    category: "Restaurant",
    image: "https://images.unsplash.com/photo-1499028344343-cd173ffc68a9?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "GlowUp Cosmetics",
    category: "Beauty",
    image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "TechZone",
    category: "Electronics",
    image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80",
  },
];

function StoreCard({ store }: { store: (typeof stores)[number] }) {
  return (
    <div className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm sm:rounded-[32px]">
      <div className="relative h-44 overflow-hidden sm:h-56">
        <img src={store.image} alt={store.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      </div>
      <div className="p-4 sm:p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500 sm:text-sm sm:tracking-[0.3em]">{store.category}</p>
        <h3 className="mt-2 text-lg font-semibold text-slate-950 sm:mt-3 sm:text-xl">{store.title}</h3>
        <p className="mt-2 break-all text-sm text-slate-600 sm:mt-4">
          {storeHref(
            store.title.toLowerCase().replace(/\s+/g, ""),
            "",
            { absolute: true }
          )}
        </p>
      </div>
    </div>
  );
}

export function StoreExamples() {
  const [activeIndex, setActiveIndex] = useState(0);

  const showPrevious = () => setActiveIndex((index) => (index - 1 + stores.length) % stores.length);
  const showNext = () => setActiveIndex((index) => (index + 1) % stores.length);

  return (
    <section id="examples" className="bg-slate-50 py-14 sm:py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:mb-10 sm:gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#25D366] sm:text-sm">Store Examples</p>
            <h2 className="mt-2 text-2xl leading-tight font-bold text-slate-950 sm:mt-4 sm:text-3xl lg:text-4xl">Beautiful stores from Sell Up users</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:mt-4 sm:text-lg">Join thousands of businesses already selling online.</p>
          </div>
          <div className="flex items-center gap-3 text-slate-500 sm:hidden">
            <button type="button" aria-label="Previous store example" onClick={showPrevious} className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-sm hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]">←</button>
            <button type="button" aria-label="Next store example" onClick={showNext} className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-sm hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]">→</button>
          </div>
        </div>

        <div className="sm:hidden">
          <StoreCard store={stores[activeIndex]} />
          <div className="mt-5 flex items-center justify-center gap-2">
            {stores.map((store, index) => (
              <button
                key={store.title}
                type="button"
                aria-label={`Show ${store.title} example`}
                onClick={() => setActiveIndex(index)}
                className={`h-1.5 rounded-full transition-all ${index === activeIndex ? "w-6 bg-[#25D366]" : "w-1.5 bg-slate-300"}`}
              />
            ))}
          </div>
        </div>
        <div className="hidden gap-4 sm:grid sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {stores.map((store) => <StoreCard key={store.title} store={store} />)}
        </div>
      </div>
    </section>
  );
}
