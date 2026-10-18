import Link from "next/link";
import { Clock, LayoutDashboard, Mail } from "lucide-react";
import { MarketingHero, MarketingShell } from "@/components/marketing-shell";

const cards = [
  {
    icon: Mail,
    title: "Email",
    body: "For account, billing or store questions — our support team replies within one business day.",
    action: "support@sellup.ng",
    href: "mailto:support@sellup.ng",
  },
  {
    icon: LayoutDashboard,
    title: "Merchant support",
    body: "Signed in already? Open a support ticket from your dashboard and track it to resolution.",
    action: "Go to your dashboard",
    href: "/dashboard",
  },
  {
    icon: Clock,
    title: "Support hours",
    body: "Monday to Friday, 8:00 AM – 6:00 PM (WAT). Urgent payment issues are prioritised around the clock.",
    action: "See how it works",
    href: "/how-it-works",
  },
];

export default function ContactPage() {
  return (
    <MarketingShell>
      <MarketingHero
        eyebrow="Contact"
        title="Talk to the Sell Up team"
        description="Questions about setting up your store, pricing or payments? We are one message away."
      />

      <section className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            const external = card.href.startsWith("mailto:");
            const inner = (
              <>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#DCF8C6] text-[#128C7E]">
                  <Icon size={22} />
                </div>
                <h2 className="text-lg font-bold text-slate-950">
                  {card.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {card.body}
                </p>
                <span className="mt-4 inline-block text-sm font-bold text-[#128C7E]">
                  {card.action}
                </span>
              </>
            );
            const className =
              "block rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm transition hover:border-[#25D366] hover:shadow-md";
            return external ? (
              <a key={card.title} href={card.href} className={className}>
                {inner}
              </a>
            ) : (
              <Link key={card.title} href={card.href} className={className}>
                {inner}
              </Link>
            );
          })}
        </div>

        <div className="mx-auto mt-10 max-w-6xl rounded-[28px] border border-slate-200 bg-white p-7 sm:p-9">
          <h2 className="text-xl font-bold text-slate-950">
            Before you write in
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Most quick answers live in our{" "}
            <Link
              href="/resources"
              className="font-semibold text-[#128C7E] hover:underline"
            >
              resources
            </Link>{" "}
            and{" "}
            <Link
              href="/how-it-works"
              className="font-semibold text-[#128C7E] hover:underline"
            >
              how-it-works
            </Link>{" "}
            guides. For anything else, email{" "}
            <a
              href="mailto:support@sellup.ng"
              className="font-semibold text-[#128C7E] hover:underline"
            >
              support@sellup.ng
            </a>{" "}
            and include your store name so we can help faster.
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
