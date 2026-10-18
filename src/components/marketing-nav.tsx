"use client";

import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Astrix-style marketing navigation:
 * - sticky header that tightens + gains blur/shadow once you scroll
 * - animated underline hover on links
 * - a "Learn" dropdown (hover + keyboard focus) with a rotating chevron
 * - full-screen mobile overlay with staggered link entrance
 */

interface NavLink {
  href: string;
  label: string;
  badge?: string;
}

const PRIMARY_LINKS: NavLink[] = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

const LEARN_LINKS: NavLink[] = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/resources", label: "Resources" },
  { href: "/demo-store", label: "Demo Store", badge: "New" },
];

const MOBILE_LINKS: NavLink[] = [
  ...PRIMARY_LINKS,
  ...LEARN_LINKS,
  { href: "/login", label: "Login" },
];

const linkUnderline =
  "relative transition-colors after:absolute after:-bottom-1.5 after:left-0 after:h-[2px] after:w-0 after:bg-[#25D366] after:transition-all after:duration-300 hover:after:w-full";

export function MarketingNav() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock scrolling and allow Escape while the mobile overlay is open.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  return (
    <>
      <nav
        className={`sticky top-0 z-50 border-b transition-all duration-300 ${
          scrolled
            ? "border-slate-200 bg-white/95 shadow-[0_12px_40px_-18px_rgba(15,23,42,0.25)] backdrop-blur-md"
            : "border-transparent bg-white/80 backdrop-blur"
        }`}
      >
        <div
          className={`mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 transition-all duration-300 sm:px-6 ${
            scrolled ? "py-2.5" : "py-4 sm:py-5"
          }`}
        >
          <Link href="/" className="flex min-w-0 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- local PNG logo */}
            <img
              src="/assets/sellup-logo.png"
              alt="Sell Up"
              className="h-8 w-auto shrink-0 sm:h-9"
            />
          </Link>

          {/* Desktop */}
          <div className="hidden items-center gap-8 text-sm font-semibold text-slate-600 lg:flex">
            {PRIMARY_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`${linkUnderline} hover:text-slate-900`}
              >
                {link.label}
              </Link>
            ))}

            {/* Learn dropdown */}
            <div className="group relative">
              <button
                type="button"
                className={`${linkUnderline} flex items-center gap-1 hover:text-slate-900`}
              >
                Learn
                <ChevronDown
                  size={14}
                  className="transition-transform duration-200 group-hover:rotate-180 group-focus-within:rotate-180"
                />
              </button>
              <div className="invisible absolute left-0 top-full translate-y-2 pt-3 opacity-0 transition-all duration-200 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                <div className="w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
                  {LEARN_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                    >
                      {link.label}
                      {"badge" in link && link.badge && (
                        <span className="rounded-full bg-[#DCF8C6] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#128C7E]">
                          {link.badge}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <Link
              href="/login"
              className={`${linkUnderline} hover:text-slate-900`}
            >
              Login
            </Link>
            <Link href="/register" className="btn-primary text-sm">
              Merchant Account
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            aria-label={
              isOpen ? "Close navigation menu" : "Open navigation menu"
            }
            aria-expanded={isOpen}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:scale-105 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] lg:hidden"
            onClick={() => setIsOpen((open) => !open)}
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile full-screen overlay with staggered entrance */}
      <div
        aria-hidden={!isOpen}
        className={`fixed inset-0 z-[60] flex flex-col bg-white transition-all duration-300 lg:hidden ${
          isOpen
            ? "visible opacity-100"
            : "pointer-events-none invisible -translate-y-2 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center"
            onClick={() => setIsOpen(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local PNG logo */}
            <img
              src="/assets/sellup-logo.png"
              alt="Sell Up"
              className="h-8 w-auto shrink-0"
            />
          </Link>
          <button
            type="button"
            aria-label="Close navigation menu"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-50"
            onClick={() => setIsOpen(false)}
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="flex flex-col gap-1">
            {MOBILE_LINKS.map((link, index) => (
              <Link
                key={`${link.href}-${index}`}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between rounded-2xl px-4 py-4 text-2xl font-bold tracking-tight text-slate-950 transition-all duration-500 hover:bg-[#f1fbf3] hover:text-[#128C7E] ${
                  isOpen
                    ? "translate-y-0 opacity-100"
                    : "translate-y-5 opacity-0"
                }`}
                style={{
                  transitionDelay: isOpen ? `${90 + index * 70}ms` : "0ms",
                }}
              >
                {link.label}
                {"badge" in link && link.badge && (
                  <span className="rounded-full bg-[#DCF8C6] px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[#128C7E]">
                    {link.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>

          <div
            className={`mt-8 flex flex-col gap-3 transition-all duration-500 ${
              isOpen ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
            }`}
            style={{ transitionDelay: isOpen ? "420ms" : "0ms" }}
          >
            <Link
              href="/register"
              className="btn-primary text-center"
              onClick={() => setIsOpen(false)}
            >
              Merchant Account
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
