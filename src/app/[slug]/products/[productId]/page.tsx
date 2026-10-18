"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShoppingCart, ArrowLeft, Star } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";

/* eslint-disable @next/next/no-img-element */

interface Product {
  id: string;
  storeId: string;
  name: string;
  price: string;
  description?: string;
  images: string[];
  stock: number;
  comparePrice?: string;
  categoryId?: string;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const productId = params.productId as string;

  const [quantity, setQuantity] = useState(1);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      try {
        // Fetch the product scoped to this store
        const res = await fetch(
          `/api/${slug}/products/${productId}`
        );
        if (res.ok) {
          const data = await res.json();
          setProduct(data.product);
        } else {
          router.push(`/${slug}`);
        }
      } catch {
        router.push(`/${slug}`);
      } finally {
        setLoading(false);
      }
    }
    loadProduct();
  }, [slug, productId, router]);

  const { addToCart } = useCart();

  function handleAddToCart() {
    if (!product) return;
    addToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity,
      image: product.images?.[0],
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-gray-100 rounded-2xl aspect-square animate-pulse" />
            <div className="space-y-4">
              <div className="h-10 bg-gray-200 rounded animate-pulse" />
              <div className="h-6 bg-gray-200 rounded animate-pulse w-1/2" />
              <div className="h-8 bg-gray-200 rounded animate-pulse w-1/3" />
              <div className="h-24 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Product Not Found
          </h1>
          <Link href={`/${slug}`} className="btn-primary inline-block">
            Back to Store
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <div className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium"
          >
            <ArrowLeft size={20} /> Back
          </button>
        </div>
      </div>

      {/* Product Detail */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Product Image */}
          <div>
            <div className="bg-gray-100 rounded-2xl aspect-square flex items-center justify-center mb-4">
              {product.images && product.images.length > 0 ? (
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                <div className="text-gray-400 text-center">
                  <p className="text-lg">No image available</p>
                </div>
              )}
            </div>
            {product.images && product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-4">
                {product.images.map((img, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-100 rounded-lg aspect-square cursor-pointer hover:opacity-80"
                  >
                    <img
                      src={img}
                      alt="Product"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              {product.name}
            </h1>

            {/* Price */}
            <div className="mb-6">
              <div className="flex items-baseline gap-3 mb-2">
                <p className="text-3xl font-bold text-[#25D366]">
                  ₦{parseFloat(product.price).toLocaleString()}
                </p>
                {product.comparePrice && (
                  <p className="text-lg text-gray-400 line-through">
                    ₦{parseFloat(product.comparePrice).toLocaleString()}
                  </p>
                )}
              </div>
              {product.comparePrice && (
                <p className="text-sm text-[#25D366] font-semibold">
                  Save ₦
                  {(
                    parseFloat(product.comparePrice) - parseFloat(product.price)
                  ).toLocaleString()}
                </p>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">
                  Description
                </h3>
                <p className="text-gray-600">{product.description}</p>
              </div>
            )}

            {/* Stock Status */}
            <div className="mb-6">
              {product.stock === 0 ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 font-medium">
                  Out of Stock
                </div>
              ) : product.stock < 10 ? (
                <p className="text-sm text-orange-600 font-medium">
                  Only {product.stock} left in stock!
                </p>
              ) : (
                <p className="text-sm text-green-600 font-medium">In Stock</p>
              )}
            </div>

            {/* Add to Cart */}
            <div className="space-y-4 mb-8">
              {product.stock > 0 && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-gray-200 rounded-xl">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) =>
                        setQuantity(Math.max(1, parseInt(e.target.value) || 1))
                      }
                      className="w-16 text-center border-0 focus:outline-none"
                      min="1"
                      max={product.stock}
                    />
                    <button
                      onClick={() =>
                        setQuantity(Math.min(product.stock, quantity + 1))
                      }
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {product.stock > 0 ? (
                <button
                  onClick={handleAddToCart}
                  className="w-full btn-primary flex items-center justify-center gap-2 text-lg py-3"
                >
                  <ShoppingCart size={24} />
                  {added ? "Added ✓" : "Add to Cart"}
                </button>
              ) : (
                <button
                  disabled
                  className="w-full py-3 bg-gray-200 text-gray-600 font-semibold rounded-xl cursor-not-allowed"
                >
                  Out of Stock
                </button>
              )}

              <Link
                href={`/${slug}/checkout`}
                className="w-full btn-outline flex items-center justify-center gap-2 text-lg py-3"
              >
                Proceed to Checkout
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
