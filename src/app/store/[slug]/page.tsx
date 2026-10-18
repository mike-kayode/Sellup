import { redirect } from "next/navigation";

interface LegacyStorePageProps {
  params: Promise<{ slug: string }>;
}

/** Legacy URL: sellup.ng/store/{slug} -> sellup.ng/{slug} */
export default async function LegacyStorePage({ params }: LegacyStorePageProps) {
  const { slug } = await params;
  redirect(`/${slug}`);
}