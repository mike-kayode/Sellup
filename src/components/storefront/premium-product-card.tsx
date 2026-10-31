"use client";

/**
 * Sell Up premium product card (Phase 2.2a).
 *
 * Premium product card with hover lift, sale / featured / out-of-stock
 * badges, quick add-to-cart, and savings display. Works in light and dark
 * modes via the shared `.card` / `.dark .card` CSS variables.
 */

import Link from "next/link";
import { useState } from "react";
import { ShoppingCart, Star, Tag } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { formatNaira } from "@/components/store-templates/storefront-v1/parts";

interface PremiumProductCardProps {
  product: {
    id: string;
    name: string;
    price: string;
    comparePrice?: string | null;
    images?: unknown;
    stock?: number | null;
    isFeatured?: boolean | null;
    isActive?: boolean | null;
    categoryId?: string | null;
  };
  storeSlug?: string;
  onAdd?: (product: PremiumProductCardProps["product"]) => void;
  className?: string;
}

function productImage(product: PremiumProductCardProps["product"]): string | null {
  if (Array.isArray(product.images) && product.images.length > 0) {
    const first = product.images[0];
    return typeof first === "string" && first.length > 0 ? first : null;
  }
  return null;
}

export function PremiumProductCard({
  product,
  storeSlug,
  onAdd,
  className,
}: PremiumProductCardProps) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  const image = productImage(product);
  const price = Number(product.price);
  const compare = product.comparePrice ? Number(product.comparePrice) : null;
  const hasDiscount = compare !== null && !Number.isNaN(compare) && compare > price;
  const savings = hasDiscount ? compare - price : 0;
  const outOfStock = (product.stock ?? 0) <= 0;
  const isActive = product.isActive ?? true;

  function handleAdd() {
    if (outOfStock || !isActive) return;
    addToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      image,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
    onAdd?.(product);
  }

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-1 ${className ?? ""}`}
    >
      <div className="relative aspect-square bg-gray-100 overflow-hidden">
        {image ? (
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-gray-400 text-3xl">
            🛍️
          </div>
        )}
        {product.isFeatured && (
          <span className="absolute top-2 left-2 rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-bold text-gray-900 shadow">
            <Star size={10} className="mr-1" aria-hidden /> Featured
          </span>
        )}
        {hasDiscount && (
          <span className="absolute top-2 right-2 rounded-full bg-[#25D366] px-2 py-0.5 text-[10px] font-bold text-white shadow">
            Save {Math.round((savings / compare) * 100)}%
          </span>
        )}
        {outOfStock || !isActive && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm text-sm font-bold text-white">
            Sold out
          </span>
        )}
      </div>
      <div className="p-4">
        <Link
          href={storeSlug ? `/${storeSlug}/products/${product.id}` : `/products/${product.id}`}
          className="line-clamp-2 block mb-1 text-[14px] font-semibold text-gray-900 group-hover:text-[#25D366] transition-colors"
        >
          {product.name}
        </Link>
        <div className="flex items-baseline gap-2 mb-3">
          {Number.isFinite(price) && (
            <span className="text-lg font-extrabold text-gray-900">
              {formatNaira(price)}
            </span>
          )}
          {hasDiscount && (
            <span className="text-sm text-gray-500 line-through">
              {formatNaira(compare)}
            </span>
          )}
          {hasDiscount && savings > 0 && (
            <span className="text-xs font-semibold text-[#25D366]">
              Save {formatNaira(savings)}
            </span>
          )}
        </div>
        <button
          onClick={handleAdd}
          disabled={added || outOfStock || !isActive}
          aria-label={added ? "Added to cart" : `Add ${product.name} to cart`}
          className={`w-full min-h-10 items-center justify-center rounded-xl text-sm font-bold transition-colors duration-200 flex ${added
            ? "bg-[#DCF8C6] text-[#128C7E]"
            : "bg-[#25D366] text-white hover:bg-[#128C7E]"}
          `}
        >
          {added ? (
            <>
              <ShoppingCart size={14} className="mr-1.5" aria-hidden />
              Added
            </>
          ) : (
            <>
              <Tag size={14} className="mr-1.5" aria-hidden />
              Add to cart
            </>
          )}
        </button>
      </div>
    </article>
  );
}
