"use client";

/**
 * Sell Up floating WhatsApp chat button (Phase 2.1).
 *
 * A tiny, lazy-loaded client widget rendered on every storefront page.
 *   - Round floating button, fixed bottom-right (or bottom-left).
 *   - Opens https://wa.me/<number>?text=<encoded message>.
 *   - Greeting bubble shows once per session (sessionStorage).
 *   - Context-aware prefill (product page: name/price/link; cart/checkout: order summary).
 *   - Never overlaps the sticky mobile cart bar (safe-area + bottom offset).
 *   - Honours prefers-reduced-motion; keyboard accessible; no layout shift.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { MessageCircle, Send } from "lucide-react";
import {
  evaluateChatButton,
  normaliseE164,
  recordWhatsAppClick,
  substituteTemplate,
  type WhatsAppChatConfig,
} from "@/lib/whatsapp-chat";

interface WhatsAppChatButtonProps {
  config: WhatsAppChatConfig;
  store: { storeName: string; storeSlug: string };
  page: "home" | "product" | "cart" | "checkout";
  productName?: string | null;
  productPrice?: string | null;
  productUrl?: string | null;
  cartBarHeight?: number;
  device: "mobile" | "desktop" | "tablet";
}

export function WhatsAppChatButton({
  config,
  store,
  page,
  productName,
  productPrice,
  productUrl,
  cartBarHeight = 52,
  device,
}: WhatsAppChatButtonProps) {
  const [mounted, setMounted] = useState(false);
  const [greetingOpen, setGreetingOpen] = useState(false);
  const greetingRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const sessionKey = `sellup:whatsapp:greeting:${store.storeSlug}`;

  const decision = useMemo(() => evaluateChatButton(config, page), [
    config,
    page,
  ]);

  const waUrl = useMemo(() => {
    if (!decision.number) return null;
    const text = encodeURIComponent(decision.message);
    return `https://wa.me/${normaliseE164(decision.number) ?? decision.number.replace(/\D/g, "")}?text=${text}`;
  }, [decision.number, decision.message]);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mounted || !decision.show || greetingOpen) return;
    const alreadyShown = sessionStorage.getItem(sessionKey) === "1";
    if (!alreadyShown) {
      setGreetingOpen(true);
      const t = setTimeout(() => setGreetingOpen(false), 6000);
      return () => clearTimeout(t);
    }
  }, [mounted, decision.show, sessionKey, greetingOpen]);

  const handleClick = useCallback(() => {
    if (!waUrl) return;
    recordWhatsAppClick({
      storeSlug: store.storeSlug,
      page,
      productId: undefined,
      device,
      productName: productName ?? null,
      productPrice: productPrice ?? null,
      productUrl: productUrl ?? null,
    }).catch(() => {});
    try {
      sessionStorage.setItem(sessionKey, "1");
    } catch {
      // sessionStorage unavailable; ignore.
    }
    setGreetingOpen(false);
    window.open(waUrl, "_blank");
  }, [waUrl, store.storeSlug, page, device, productName, productPrice, productUrl]);

  if (!mounted || !decision.show || !waUrl) return null;

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const sizeMap: Record<string, { w: string; h: string; f: string }> = {
    small: { w: "10", h: "10", f: "16" },
    medium: { w: "12", h: "12", f: "18" },
    large: { w: "14", h: "14", f: "20" },
  };
  const size = sizeMap[config.size] ?? sizeMap.medium;

  const isMobile = device === "mobile";
  const style: CSSProperties = {
    position: "fixed",
    [config.position === "bottom-left" ? "left" : "right"]: "20px",
    bottom: isMobile
      ? `calc(${cartBarHeight + 12}px + env(safe-area-inset-bottom))`
      : "20px",
    zIndex: 9999,
    width: size.w,
    height: size.h,
  };

  const bubbleStyle: CSSProperties = {
    position: "fixed",
    [config.position === "bottom-left" ? "left" : "right"]:
      config.position === "bottom-left" ? "84px" : "84px",
    bottom: isMobile
      ? `calc(${cartBarHeight + 80}px + env(safe-area-inset-bottom))`
      : "96px",
    ...(reducedMotion ? { transform: "none", opacity: 1 } : {}),
    display: greetingOpen ? "block" : "none",
    zIndex: 9998,
    pointerEvents: greetingOpen ? "auto" : "none",
  };

  return (
    <>
      <div
        ref={greetingRef}
        style={bubbleStyle}
        className="flex items-center gap-2 rounded-2xl bg-white border border-gray-200 shadow-lg px-4 py-2 text-sm font-medium text-gray-900"
        role="status"
        aria-live="polite"
      >
        <MessageCircle className="w-4 h-4 text-[#25D366]" aria-hidden />
        {decision.message}
      </div>

      <button
        ref={buttonRef}
        onClick={handleClick}
        aria-label={
          decision.away
            ? `Chat with ${store.storeName} (currently away)`
            : `Chat with ${store.storeName} on WhatsApp`
        }
        title={decision.away ? `${store.storeName} — away` : `${store.storeName} — WhatsApp`}
        style={style}
        className="rounded-full flex items-center justify-center border border-gray-200 shadow-lg transition-colors duration-200 ease-in-out"
      >
        <svg
          width={size.f}
          height={size.f}
          fill="#E0E0E0"
          viewBox="0 0 24 24"
          aria-hidden
          className="block"
        >
          <Send width={size.f} height={size.f} aria-hidden />
        </svg>
        {decision.away && (
          <span className="absolute -right-1 -top-1 flex h-3 min-w-3 items-center justify-center rounded-full bg-red-500 border border-white text-[10px] font-bold text-white">
            ·
          </span>
        )}
      </button>
    </>
  );
}
