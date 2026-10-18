import { redirect } from "next/navigation";

interface LegacyProductProps {
  params: Promise<{ slug: string; productId: string }>;
}

/** Legacy URL: sellup.ng/store/{slug}/products/{id} -> sellup.ng/{slug}/products/{id} */
export default async function LegacyProduct({ params }: LegacyProductProps) {
  const { slug, productId } = await params;
  redirect(`/${slug}/products/${productId}`);
}