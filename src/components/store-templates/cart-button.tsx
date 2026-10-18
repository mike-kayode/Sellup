"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-context";

/**
 * Cart link for the Showcase storefront header.
 * Rendered inside the store's CartProvider (see src/app/[slug]/layout.tsx).
 */
export function CartButton({ storeSlug }: { storeSlug: string }) {
  const { cart } = useCart();
  const count = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Link
      href={`/${storeSlug}/checkout`}
      aria-label={`Checkout — ${count} item${count === 1 ? "" : "s"}`}
      className="relative inline-flex min-h-12 items-center gap-2 rounded-xl bg-white/15 px-4 py-2 font-semibold text-white transition hover:bg-white/25"
    >
      <ShoppingBag size={20} />
      <span className="hidden text-sm sm:inline">Cart</span>
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#DCF8C6] px-1 text-xs font-bold text-[#128C7E]">
          {count}
        </span>
      )}
    </Link>
  );
}
