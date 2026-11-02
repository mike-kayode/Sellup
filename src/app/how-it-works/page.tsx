import Link from "next/link";
import { Check, MessageCircle, Settings, Store } from "@/components/icons/lucide-icons";
import { MarketingCta, MarketingHero, MarketingShell } from "@/components/marketing-shell";

const steps = [
  [Store, "Create your store", "Sign up, add your business details, choose a store name and publish your online home."],
  [Settings, "Add your products", "Upload photos, set prices, organize categories and customize your store to match your brand."],
  [MessageCircle, "Receive orders on WhatsApp", "Customers browse, check out and send their orders directly to your WhatsApp."],
];

export default function HowItWorksPage() {
  return <MarketingShell><MarketingHero eyebrow="How it works" title="From setup to sales in three simple steps" description="No complicated setup and no coding. Sell Up gets your business ready to sell online in minutes." /><section className="px-6 py-20 lg:py-28"><div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">{steps.map(([Icon, title, description], index) => { const StepIcon = Icon as typeof Store; return <div key={title as string} className="relative rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm"><div className="mb-6 flex items-center justify-between"><div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[#DCF8C6] text-[#128C7E]"><StepIcon size={26} /></div><span className="text-5xl font-bold text-slate-100">0{index + 1}</span></div><h2 className="mb-3 text-xl font-semibold text-slate-950">{title as string}</h2><p className="text-slate-600">{description as string}</p></div>; })}</div></section><section className="bg-white px-6 py-16"><div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[1fr_1.2fr] md:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.25em] text-[#128C7E]">A calmer way to sell</p><h2 className="mt-3 text-3xl font-bold text-slate-950">Your business stays in your hands.</h2></div><ul className="grid gap-4 text-sm text-slate-600 sm:grid-cols-2">{["Your own shareable store link", "Orders organized in one place", "Customers reach you on WhatsApp", "No developer required"].map((item) => <li key={item} className="flex gap-3"><Check className="shrink-0 text-[#25D366]" size={18} />{item}</li>)}</ul></div></section><MarketingCta /></MarketingShell>;
}
