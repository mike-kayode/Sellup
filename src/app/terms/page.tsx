import Link from "next/link";
import { MarketingHero, MarketingShell } from "@/components/marketing-shell";

const sections: { title: string; body: string[] }[] = [
  {
    title: "1. Accepting these terms",
    body: [
      "By creating an account, publishing a store, or otherwise using Sell Up (the “Service”), you agree to these Terms of Use. If you do not agree, please do not use the Service.",
      "If you use Sell Up on behalf of a business, you confirm that you have the authority to bind that business to these terms.",
    ],
  },
  {
    title: "2. Your account",
    body: [
      "You must provide accurate and complete information when registering, and keep your email address and password secure. You are responsible for all activity that happens under your account.",
      "You must be at least 18 years old, or the age of majority in your country, to create an account.",
    ],
  },
  {
    title: "3. Your store and content",
    body: [
      "You keep full ownership of the products, images, descriptions, prices and any other content you upload to your store. You grant Sell Up a limited licence to host, display and process that content purely to operate the Service.",
      "You are responsible for the legality of your content and products. Items that are illegal in Nigeria, unsafe, or that infringe third-party rights (including counterfeits) are not allowed.",
    ],
  },
  {
    title: "4. Plans, fees and billing",
    body: [
      "Sell Up offers a free (freemium) plan and paid plans. Paid plans renew automatically each month until cancelled. You can cancel at any time; access continues until the end of the paid period.",
      "Payments are processed by licensed third-party processors (such as Paystack). Prices are in Nigerian Naira (₦) and include applicable taxes unless stated otherwise. Fees are non-refundable except where required by law.",
    ],
  },
  {
    title: "5. Acceptable use",
    body: [
      "You agree not to: sell prohibited goods; mislead or defraud customers; spam or abuse WhatsApp; scrape or overload the platform; reverse-engineer the Service; or interfere with other merchants' stores.",
      "We may suspend or close accounts that break these rules, or where required to comply with the law.",
    ],
  },
  {
    title: "6. WhatsApp and third-party services",
    body: [
      "Order notifications are delivered through WhatsApp and other providers you configure. Their terms and availability apply to those channels, and Sell Up is not responsible for their outages or policy changes.",
      "Your store is reachable at the shareable Sell Up URL assigned to your business (for example sellup.ng/your-business). You may not use your store URL for unlawful activity.",
    ],
  },
  {
    title: "7. Service availability",
    body: [
      "We work hard to keep Sell Up running, but the Service is provided “as is” and “as available”. We may modify, suspend or discontinue features with reasonable notice where practical.",
    ],
  },
  {
    title: "8. Limitation of liability",
    body: [
      "To the maximum extent permitted by law, Sell Up is not liable for indirect, incidental or consequential losses — including lost profits, lost sales or data — arising from your use of the Service. Our total liability is limited to the amount you paid us in the 3 months before the claim.",
    ],
  },
  {
    title: "9. Termination",
    body: [
      "You may delete your account at any time from your dashboard. We may suspend or terminate access if these terms are breached. Sections that by their nature should survive termination (such as content licences and disclaimers) will survive.",
    ],
  },
  {
    title: "10. Changes to these terms",
    body: [
      "We may update these terms from time to time. Material changes will be announced on this page or by email. Continued use of Sell Up after changes take effect means you accept the updated terms.",
    ],
  },
];

export default function TermsPage() {
  return (
    <MarketingShell>
      <MarketingHero
        eyebrow="Legal"
        title="Terms of Use"
        description="The agreement that governs how merchants and visitors use Sell Up."
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
            Questions about these terms? Email{" "}
            <a
              href="mailto:support@sellup.ng"
              className="font-semibold text-[#128C7E] hover:underline"
            >
              support@sellup.ng
            </a>{" "}
            or read our{" "}
            <Link
              href="/privacy"
              className="font-semibold text-[#128C7E] hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
