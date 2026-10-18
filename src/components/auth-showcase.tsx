/* eslint-disable @next/next/no-img-element -- image optimizer is unavailable on the standalone server */
import Link from "next/link";
import { ArrowRight, Users, Zap } from "lucide-react";
import type { ReactNode } from "react";

const SHOWCASE_IMAGE =
  "https://images.unsplash.com/photo-1750263160670-42be92c0eaf0?auto=format&fit=crop&w=1600&q=80";

const chips = [
  { icon: Users, label: "Sellers joined", value: "10,000+" },
  { icon: Zap, label: "Setup time", value: "10 minutes" },
];

type AuthShowcaseProps = {
  badge: string;
  headline: ReactNode;
  subtext: string;
  question: string;
  switchLabel: string;
  switchHref: string;
};

/**
 * Left photo panel for /login and /register — split layout with an African
 * woman at the counter of her store, brand overlay, stat chips and a
 * switch-to-other-page box.
 */
export function AuthShowcase({
  badge,
  headline,
  subtext,
  question,
  switchLabel,
  switchHref,
}: AuthShowcaseProps) {
  return (
    <aside className="flex p-4 sm:p-6 lg:min-h-screen lg:items-stretch">
      <div className="relative flex w-full flex-col justify-between overflow-hidden rounded-[26px] bg-slate-950 p-6 min-h-[440px] sm:p-8 sm:min-h-[520px] lg:rounded-[32px]">
        <img
          src={SHOWCASE_IMAGE}
          alt="Shop owner standing at the counter of her store"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/55" />

        {/* Top: logo + badge */}
        <div className="relative flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- local PNG logo */}
            <img
              src="/assets/sellup-logo-dark.png"
              alt="Sell Up"
              className="h-8 w-auto"
            />
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#25D366]" />
            {badge}
          </span>
        </div>

        {/* Stat chips — desktop only, right side like the reference */}
        <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
          {chips.map((chip) => {
            const Icon = chip.icon;
            return (
              <div
                key={chip.label}
                className="flex items-center gap-3 rounded-2xl border border-white/15 bg-black/40 px-4 py-3 shadow-lg backdrop-blur"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/20 text-[#7ee2a8]">
                  <Icon size={17} />
                </span>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/60">
                    {chip.label}
                  </p>
                  <p className="text-sm font-extrabold text-white">
                    {chip.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Headline */}
        <div className="relative max-w-md">
          <h1 className="text-3xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-4xl">
            {headline}
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/75">{subtext}</p>
        </div>

        {/* Switch box */}
        <div className="relative rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
          <p className="text-sm font-semibold text-white/85">{question}</p>
          <Link
            href={switchHref}
            className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/15 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/25"
          >
            {switchLabel} <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </aside>
  );
}
