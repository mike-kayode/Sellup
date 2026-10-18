import { redirect } from "next/navigation";

interface LegacyCheckoutProps {
  params: Promise<{ slug: string }>;
}

/** Legacy URL: sellup.ng/store/{slug}/checkout -> sellup.ng/{slug}/checkout */
export default async function LegacyCheckout({ params }: LegacyCheckoutProps) {
  const { slug } = await params;
  redirect(`/${slug}/checkout`);
}