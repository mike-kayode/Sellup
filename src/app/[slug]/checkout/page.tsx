"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Copy } from "lucide-react";
import { useCart } from "@/lib/cart-context";

interface CartItem {
  productId: string;
  name: string;
  price: string;
  quantity: number;
}

interface Cart {
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
}

interface StoreInfo {
  id: string;
  storeName: string;
  storeSlug: string;
  whatsappNumber: string;
}

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [store, setStore] = useState<StoreInfo | null>(null);
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    deliveryAddress: "",
    city: "",
    state: "",
    couponCode: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orderCreated, setOrderCreated] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [whatsappLink, setWhatsappLink] = useState("");
  const [orderMessage, setOrderMessage] = useState("");

  const { cart, clearCart } = useCart();

  useEffect(() => {
    // Resolve the real store by slug
    async function loadStore() {
      try {
        const res = await fetch(`/api/store/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setStore(data.store);
        } else {
          router.push(`/${slug}`);
        }
      } catch {
        router.push(`/${slug}`);
      }
    }
    loadStore();
  }, [slug, router]);

  // After the confirmation screen appears, automatically hand the order to
  // the merchant's WhatsApp (navigation to wa.me needs no popup permission).
  // The manual button below stays as a fallback if the app doesn't open.
  useEffect(() => {
    if (!orderCreated || !whatsappLink || !orderId) return;
    const timer = window.setTimeout(() => {
      const payload = JSON.stringify({ orderId, eventName: "WHATSAPP_OPENED" });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/orders/events",
          new Blob([payload], { type: "application/json" })
        );
      } else {
        void fetch("/api/orders/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        });
      }
      window.location.href = whatsappLink;
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [orderCreated, whatsappLink, orderId]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!store) {
        setError("Store not found. Please try again.");
        setLoading(false);
        return;
      }

      if (cart.items.length === 0) {
        setError("Your cart is empty.");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: store.id,
          idempotencyKey,
          customerName: formData.customerName,
          customerPhone: formData.customerPhone,
          customerEmail: formData.customerEmail,
          deliveryAddress: formData.deliveryAddress,
          city: formData.city,
          state: formData.state,
          items: cart.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          couponCode: formData.couponCode,
          notes: formData.notes,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to create order");
        setLoading(false);
        return;
      }

      const data = await response.json();
      setOrderId(data.order.id);
      setWhatsappLink(data.whatsappLink);
      setOrderMessage(data.whatsappMessage);
      setOrderCreated(true);
      clearCart();
      setLoading(false);
    } catch (err) {
      setError("Failed to create order. Please try again.");
      setLoading(false);
    }
  }

  function trackWhatsAppOpened() {
    if (!orderId) return;
    const payload = JSON.stringify({ orderId, eventName: "WHATSAPP_OPENED" });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/orders/events",
        new Blob([payload], { type: "application/json" })
      );
    } else {
      void fetch("/api/orders/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
    }
  }

  async function copyOrderDetails() {
    if (!orderMessage) return;
    try {
      await navigator.clipboard.writeText(orderMessage);
    } catch {
      setError("Could not copy order details. Please use the WhatsApp button instead.");
    }
  }

  if (cart.items.length === 0 && !orderCreated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Cart Empty</h1>
          <p className="text-gray-600 mb-6">
            Your cart is empty. Please add some products before checking out.
          </p>
          <Link href={`/${slug}`} className="btn-primary inline-block">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  if (orderCreated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center px-6 py-12">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-[#DCF8C6] rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">✓</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Order Created!
          </h1>
          <p className="text-gray-600 mb-8">
            We&rsquo;re opening WhatsApp now to send your order to{" "}
            {store?.storeName || "the store"}. If it doesn&rsquo;t open
            automatically, tap the button below.
          </p>
          {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}

          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackWhatsAppOpened}
            className="w-full btn-primary flex items-center justify-center gap-2 mb-4"
          >
            <Send size={20} /> Send Order to WhatsApp
          </a>

          <button
            onClick={copyOrderDetails}
            className="w-full btn-secondary flex items-center justify-center gap-2 mb-4"
          >
            <Copy size={20} /> Copy Order Details
          </button>

          <Link
            href={`/${slug}`}
            className="block text-gray-600 hover:text-gray-900 font-medium text-sm"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link
            href={`/${slug}`}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium"
          >
            <ArrowLeft size={20} /> Back to Store
          </Link>
        </div>
      </div>

      {/* Checkout */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Checkout{(store ? ` - ${store.storeName}` : "")}
        </h1>
        <p className="text-gray-600 mb-12">
          Your order will be sent to the store&rsquo;s WhatsApp right after
          you place it.
        </p>

        <div className="grid lg:grid-cols-3 gap-12">
          {/* Form */}
          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-8">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Customer Info */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Your Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.customerName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customerName: e.target.value,
                      })
                    }
                    className="input"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      value={formData.customerPhone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customerPhone: e.target.value,
                        })
                      }
                      className="input"
                      required
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Email (Optional)
                    </label>
                    <input
                      type="email"
                      value={formData.customerEmail}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customerEmail: e.target.value,
                        })
                      }
                      className="input"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Delivery Address */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Delivery Address
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Address *
                  </label>
                  <textarea
                    value={formData.deliveryAddress}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        deliveryAddress: e.target.value,
                      })
                    }
                    className="input resize-none"
                    required
                    disabled={loading}
                    rows={3}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      City *
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                      className="input"
                      required
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      State *
                    </label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) =>
                        setFormData({ ...formData, state: e.target.value })
                      }
                      className="input"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Order Notes */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Additional Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Coupon Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.couponCode}
                    onChange={(e) =>
                      setFormData({ ...formData, couponCode: e.target.value })
                    }
                    className="input"
                    disabled={loading}
                    placeholder="e.g. SAVE10"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Order Notes (Optional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    className="input resize-none"
                    disabled={loading}
                    rows={3}
                    placeholder="Any special requests or notes..."
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 text-lg font-semibold disabled:opacity-50"
            >
              {loading ? "Creating Order..." : "Place Order"}
            </button>
          </form>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="card p-6 sticky top-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Order Summary
              </h2>

              {/* Items */}
              <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                {cart.items.map((item) => (
                  <div
                    key={item.productId}
                    className="flex justify-between items-start"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-600">
                        Qty: {item.quantity}
                      </p>
                    </div>
                    <p className="font-semibold text-gray-900">
                      ₦
                      {(parseFloat(item.price) * item.quantity).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t border-gray-200 pt-6 space-y-3">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>₦{cart.subtotal.toLocaleString()}</span>
                </div>

                {cart.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-₦{cart.discount.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between text-lg font-bold text-gray-900 pt-3 border-t border-gray-200">
                  <span>Total</span>
                  <span>₦{cart.total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
