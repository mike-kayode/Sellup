"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { useCart } from "@/lib/cart-context";

interface AddToCartButtonProps {
  productId: string;
  name: string;
  price: string;
  image?: string;
  stock: number | null;
}

/**
 * Quick add-to-cart control used by the Showcase product listing template.
 * Adds a single unit and shows brief confirmation feedback.
 */
export function AddToCartButton({
  productId,
  name,
  price,
  image,
  stock,
}: AddToCartButtonProps) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);
  const outOfStock = (stock ?? 0) <= 0;

  if (outOfStock) {
    return (
      <button
        disabled
        className="flex w-full min-h-12 items-center justify-center rounded-xl bg-gray-100 text-sm font-semibold text-gray-400 cursor-not-allowed"
      >
        Sold out
      </button>
    );
  }

  function handleAdd() {
    addToCart({ productId, name, price, quantity: 1, image });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <button
      onClick={handleAdd}
      className={`flex w-full min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold transition ${
        added
          ? "bg-[#DCF8C6] text-[#128C7E]"
          : "bg-[#25D366] text-white hover:bg-[#128C7E]"
      }`}
    >
      {added ? (
        <>
          <Check size={18} /> Added
        </>
      ) : (
        <>
          <Plus size={18} /> Add to cart
        </>
      )}
    </button>
  );
}
