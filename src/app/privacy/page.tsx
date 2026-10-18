import Link from "next/link";
import { MarketingHero, MarketingShell } from "@/components/marketing-shell";

const sections: { title: string; body: string[] }[] = [
  {
    title: "1. Who we are",
    body: [
      "Sell Up (“we”, “us”) operates sellup.ng, a platform that helps Nigerian businesses create online stores and receive orders on WhatsApp. This policy explains what personal data we collect and how we use it, in line with the Nigeria Data Protection Regulation (NDPR) and comparable privacy laws.",
    ],
  },
  {
    title: "2. Information we collect",
    body: [
      "Account data: your name, email address, phone number and password (stored only as a secure hash).",
      "Store data: business name, store description, product listings, prices, images and settings you configure.",
      "Order and customer data: orders placed through your store, customer names, phone numbers, delivery details and order notes.",
      "Technical data: IP address, browser type, device information, pages visited and timestamps, collected automatically for security and analytics.",
      "Payment data: transaction references and status from our payment processors. We never store your full card number or PIN.",
    ],
  },
  {
    title: "3. How we use your information",
    body: [
      "To provide and operate your store, including hosting, publishing and order processing.",
      "To send transactional messages: verification codes, order notifications, receipts and service updates.",
      "To process payments and settle merchant earnings through our payment partners.",
      "To detect, prevent and investigate fraud, abuse and security incidents.",
      "To improve the platform through aggregated, de-identified analytics.",
    ],
  },
  {
    title: "4. Who we share it with",
    body: [
      "Payment processors (e.g. Paystack) — to charge customers and pay you out.",
      "Messaging providers (e.g. WhatsApp/Meta, and our email provider) — to deliver order and account notifications you or your customers have requested.",
      "Cloud hosting and database providers (e.g. Supabase) — who process data on our behalf under contract.",
      "Law enforcement or regulators — where required by law or valid legal process.",
    ],
  },
  {
    title: "5. WhatsApp messaging",
    body: [
      "Order notifications are sent through WhatsApp Business messaging. WhatsApp's own terms and privacy policy apply to messages once they leave our platform. We only send messages related to orders, accounts and explicitly requested updates, and we never sell your contact lists.",
    ],
  },
  {
    title: "6. Data retention",
    body: [
      "We keep account data while your account is active. Order records are retained for accounting and legal purposes for as long as required by Nigerian law, then deleted or anonymised. You can request earlier deletion of your account data (subject to legal retention duties).",
    ],
  },
  {
    title: "7. Security",
    body: [
      "Data is encrypted in transit (HTTPS), passwords are hashed, and access to production systems is restricted and logged. No system is perfectly secure — if we ever experience a breach affecting your personal data, we will notify you and the relevant authority as required by law.",
    ],
  },
  {
    title: "8. Your rights",
    body: [
      "You have the right to access, correct, export or delete the personal data we hold about you, and to object to or restrict certain processing. Merchants can update most store details directly from the dashboard; for account-level requests, email support@sellup.ng and we will respond within the timeframe required by the NDPR.",
    ],
  },
  {
    title: "9. Cookies",
    body: [
      "We use strictly necessary cookies (and browser storage) to keep you signed in and to remember core preferences. We do not use third-party advertising cookies on sellup.ng.",
    ],
  },
  {
    title: "10. Changes and contact",
    body: [
      "We may update this policy from time to time; the “last updated” date above shows when it last changed. Material changes will be announced on this page or by email.",
      "For privacy questions or requests, contact support@sellup.ng.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <MarketingHero
        eyebrow="Legal"
        title="Privacy Policy"
        description="How Sell Up collects, uses and protects the information of merchants and their customers."
      />

      <section className="px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-10">
          <p className="text-sm leading-6 text-slate-500">
            Last updated: 10 October 2026
          </p>
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-lg font-bold text-slate-950 sm:text-xl">
                {section.title}
              </h2>
              {section.body.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 40)}
                  className="mt-3 text-sm leading-7 text-slate-600 sm:text-base"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          ))}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-600">
            Privacy requests and questions:{" "}
            <a
              href="mailto:support@sellup.ng"
              className="font-semibold text-[#128C7E] hover:underline"
            >
              support@sellup.ng
            </a>
            . See also our{" "}
            <Link
              href="/terms"
              className="font-semibold text-[#128C7E] hover:underline"
            >
              Terms of Use
            </Link>
            .
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
