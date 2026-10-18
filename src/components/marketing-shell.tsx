import Link from "next/link";
import { MarketingFooter } from "./marketing-footer";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { MarketingNav } from "./marketing-nav";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <MarketingNav />
      {children}
      <MarketingFooter />
    </div>
  );
}

export function MarketingHero({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <section className="relative overflow-hidden bg-white py-20 lg:py-28">
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(37,211,102,0.18),_transparent_55%)]" />
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#25D366]">{eyebrow}</p>
        <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">{title}</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">{description}</p>
      </div>
    </section>
  );
}

export function MarketingCta() {
  return (
    <section className="bg-[#25D366] px-6 py-20 text-center text-white">
      <h2 className="text-3xl font-bold sm:text-4xl">Launch your store today.</h2>
      <p className="mx-auto mt-4 max-w-2xl text-white/90">Join thousands of Nigerian businesses growing with Sell Up.</p>
      <Link href="/register" className="mt-8 inline-flex items-center gap-2 rounded-3xl bg-white px-8 py-4 font-semibold text-[#25D366] shadow-lg hover:bg-slate-100">Start Your Free Store <ArrowRight size={18} /></Link>
    </section>
  );
}
