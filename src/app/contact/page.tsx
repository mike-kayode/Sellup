import Link from "next/link";
import { MarketingHero, MarketingShell } from "@/components/marketing-shell";

const cards = [
  {
    icon: "mail",
    title: "Email",
    body: "For account, billing or store questions — our support team replies within one business day.",
    action: "support@sellup.ng",
    href: "mailto:support@sellup.ng",
  },
  {
    icon: "dashboard",
    title: "Merchant support",
    body: "Signed in already? Open a support ticket from your dashboard and track it to resolution.",
    action: "Go to your dashboard",
    href: "/dashboard",
  },
  {
    icon: "clock",
    title: "Support hours",
    body: "Monday to Friday, 8:00 AM – 6:00 PM (WAT). Urgent payment issues are prioritised around the clock.",
    action: "See how it works",
    href: "/how-it-works",
  },
] as const;

function ContactIcon({ name }: { name: (typeof cards)[number]["icon"] }) {
  const paths = {
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    dashboard: (
      <>
        <rect x="3" y="3" width="8" height="8" rx="1" />
        <rect x="13" y="3" width="8" height="5" rx="1" />
        <rect x="13" y="10" width="8" height="11" rx="1" />
        <rect x="3" y="13" width="8" height="8" rx="1" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  }[name];

  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths}
    </svg>
  );
}

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
            const external = card.href.startsWith("mailto:");
            const inner = (
              <>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#DCF8C6] text-[#128C7E]">
                  <ContactIcon name={card.icon} />
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
