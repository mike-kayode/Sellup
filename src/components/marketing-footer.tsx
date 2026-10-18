import Link from "next/link";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TiktokIcon,
  XIcon,
} from "./icons/social";

/**
 * Canonical marketing footer — mirrors the Astrix Tradeworx layout:
 * brand block + PRODUCT / COMPANY / GET IN TOUCH columns, divider,
 * and a bottom bar (© left, "Built in Lagos, Nigeria" right).
 * Used by the homepage and every MarketingShell page.
 */

const PRODUCT_LINKS: {
  href: string;
  label: string;
  badge?: string;
}[] = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/demo-store", label: "Demo Store" },
];

const COMPANY_LINKS: { href: string; label: string; badge?: string }[] = [
  { href: "/resources", label: "Resources" },
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

// TODO(socials): swap the placeholder platform URLs for the official
// Sell Up profile links once the usernames are confirmed.
const SOCIAL_LINKS = [
  { label: "X (Twitter)", href: "https://x.com/", Icon: XIcon },
  { label: "LinkedIn", href: "https://www.linkedin.com/", Icon: LinkedinIcon },
  { label: "Facebook", href: "https://www.facebook.com/", Icon: FacebookIcon },
  { label: "Instagram", href: "https://www.instagram.com/", Icon: InstagramIcon },
  { label: "TikTok", href: "https://www.tiktok.com/", Icon: TiktokIcon },
];

function ColumnHeading({ children }: { children: string }) {
  return (
    <p className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
      {children}
    </p>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#070b0a] px-4 pt-14 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 pb-12 md:grid-cols-[1.7fr_1fr_1fr_1.2fr] lg:gap-14">
          {/* Brand block */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- local SVG logo */}
              <img
                src="/assets/sellup-logo-dark.png"
                alt="Sell Up"
                className="h-10 w-auto"
              />
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-6 text-slate-400">
              Sell Up helps SMEs and small businesses build an online presence,
              showcase their products or services, and close sales through their
              online store, WhatsApp, or both, all from one simple platform.
            </p>

            {/* Socials */}
            <div className="mt-5 flex items-center gap-3">
              {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-slate-400 transition hover:border-[#25D366]/60 hover:text-white"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <nav aria-label="Footer product">
            <ColumnHeading>Product</ColumnHeading>
            <ul className="space-y-3.5 text-sm text-slate-300">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex items-center gap-2 transition-colors hover:text-white"
                  >
                    {link.label}
                    {link.badge && (
                      <span className="rounded-full bg-[#12352a] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#4ade80]">
                        {link.badge}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Company */}
          <nav aria-label="Footer company">
            <ColumnHeading>Company</ColumnHeading>
            <ul className="space-y-3.5 text-sm text-slate-300">
              {COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Get in touch */}
          <div className="col-span-2 md:col-span-1">
            <ColumnHeading>Get in Touch</ColumnHeading>
            <div className="space-y-2 text-sm leading-6 text-slate-300">
              <p className="font-semibold text-white">Sell Up</p>
              <p className="text-slate-400">Lagos, Nigeria</p>
              <p>
                <a
                  href="mailto:support@sellup.ng"
                  className="transition-colors hover:text-white"
                >
                  support@sellup.ng
                </a>
              </p>
              <p className="text-slate-500">
                Mon–Fri · 8:00 AM – 6:00 PM (WAT)
              </p>
            </div>
          </div>
        </div>

        {/* Divider + bottom bar */}
        <div className="border-t border-white/10 py-6 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Sell Up. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
