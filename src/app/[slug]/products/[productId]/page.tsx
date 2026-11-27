import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadProductDetail, loadStorefrontFrame } from "@/lib/storefront/load";
import { ProductDetail } from "./product-detail";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string; productId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, productId } = await params;
  const frame = await loadStorefrontFrame(slug);
  if (!frame) return { title: "Product not found", robots: { index: false } };
  const data = await loadProductDetail(frame.store.id, productId);
  if (!data) return { title: "Product not found", robots: { index: false } };
  const { product } = data;
  const storeName = frame.config.brand.name || frame.store.storeName;
  const description = (product.description || `Buy ${product.name} from ${storeName}.`).slice(0, 160);
  return {
    title: `${product.name} | ${storeName}`,
    description,
    alternates: { canonical: `/${slug}/products/${product.id}` },
    openGraph: {
      title: product.name,
      description,
      type: "website",
      images: product.images[0] ? [product.images[0]] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug, productId } = await params;
  const frame = await loadStorefrontFrame(slug);
  if (!frame) notFound();
  const data = await loadProductDetail(frame.store.id, productId);
  if (!data) notFound();

  const { product } = data;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.images,
    description: product.description || undefined,
    sku: product.sku || undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "NGN",
      price: Number(product.price),
      availability: (product.stock ?? 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify output with "<" escaped cannot break out of the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ProductDetail
        store={frame.store}
        config={frame.config}
        theme={frame.theme}
        categories={frame.categories}
        product={data.product}
        related={data.related}
      />
    </>
  );
}
