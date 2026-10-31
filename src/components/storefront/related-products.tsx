"use client";

/**
 * Sell Up related products (Phase 2.2a).
 *
 * Renders a horizontal scroll of premium product cards, typically shown on
 * product detail pages ("you may also like"). Filters out the current
 * product and prefers products from the same category.
 */

import { PremiumProductCard } from "./premium-product-card";

interface RelatedProductsProps {
  products: Array<{
    id: string;
    name: string;
    price: string;
    comparePrice?: string | null;
    images?: unknown;
    stock?: number | null;
    isFeatured?: boolean | null;
    isActive?: boolean | null;
    categoryId?: string | null;
  }>;
  currentProductId: string;
  storeSlug: string;
  limit?: number;
}

export function RelatedProducts({
  products,
  currentProductId,
  storeSlug,
  limit = 4,
}: RelatedProductsProps) {
  const related = products
    .filter((p) => p.id !== currentProductId && (p.isActive ?? true))
    .slice(0, limit);

  if (related.length === 0) return null;

  return (
    <section className="mb-12">
      <h2 className="mb-6 text-xl font-bold text-gray-900 dark:text-slate-100">
        You may also like
      </h2>
      <div className="flex gap-4 overflow-x-auto scrollbar-hidden pb-4">
        {related.map((product) => (
          <PremiumProductCard
            key={product.id}
            product={product}
            storeSlug={storeSlug}
            className="flex-none w-[200px] sm:w-[240px]"
          />
        ))}
      </div>
    </section>
  );
}
