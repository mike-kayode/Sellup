"use client";

import { ReactNode } from "react";
import { useParams } from "next/navigation";
import { CartProvider } from "@/lib/cart-context";

export default function StoreLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ slug: string }>();
  return <CartProvider key={params.slug} storeSlug={params.slug}>{children}</CartProvider>;
}
