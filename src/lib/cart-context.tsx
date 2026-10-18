"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { CartItem, Cart } from "./cart";

interface CartContextValue {
  cart: Cart;
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);
const CART_STORAGE_KEY = "naijabizz-cart";

function recalculateCart(cart: Cart): void {
  cart.subtotal = cart.items.reduce(
    (sum, item) => sum + parseFloat(item.price) * item.quantity,
    0
  );
  cart.total = cart.subtotal - cart.discount;
}

export function CartProvider({ children, storeSlug }: { children: ReactNode; storeSlug: string }) {
  const [cart, setCart] = useState<Cart>({ items: [], subtotal: 0, discount: 0, total: 0 });
  const [hydrated, setHydrated] = useState(false);
  const restoredStorageKey = useRef<string | null>(null);
  const storageKey = `${CART_STORAGE_KEY}:${storeSlug}`;

  useEffect(() => {
    if (restoredStorageKey.current === storageKey) return;
    restoredStorageKey.current = storageKey;
    try {
      const savedCart = sessionStorage.getItem(storageKey);
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart) as Partial<Cart>;
        if (Array.isArray(parsedCart.items)) {
          const restoredCart: Cart = {
            items: parsedCart.items.filter(
              (item): item is CartItem =>
                typeof item?.productId === "string" &&
                typeof item?.name === "string" &&
                typeof item?.price === "string" &&
                Number.isFinite(Number(item.price)) &&
                Number(item.price) >= 0 &&
                Number.isInteger(item?.quantity) &&
                item.quantity > 0
            ),
            subtotal: 0,
            discount: 0,
            total: 0,
          };
          recalculateCart(restoredCart);
          // Restore external session state after the client has mounted.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setCart((currentCart) => {
            if (currentCart.items.length === 0) return restoredCart;

            const mergedItems = [...restoredCart.items];
            for (const currentItem of currentCart.items) {
              const restoredItem = mergedItems.find(
                (item) => item.productId === currentItem.productId
              );
              if (restoredItem) {
                restoredItem.quantity += currentItem.quantity;
              } else {
                mergedItems.push(currentItem);
              }
            }

            const mergedCart: Cart = {
              items: mergedItems,
              subtotal: 0,
              discount: 0,
              total: 0,
            };
            recalculateCart(mergedCart);
            return mergedCart;
          });
        }
      }
    } catch {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // Ignore storage failures; the in-memory cart remains available.
      }
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (cart.items.length === 0) {
        sessionStorage.removeItem(storageKey);
      } else {
        sessionStorage.setItem(storageKey, JSON.stringify(cart));
      }
    } catch {
      // Cart persistence is best effort and must not block checkout.
    }
  }, [cart, hydrated, storageKey]);

  const addToCart = (item: CartItem): void => {
    setCart((prev) => {
      const existingItem = prev.items.find((i) => i.productId === item.productId);
      const newItems = existingItem
        ? prev.items.map((i) =>
            i.productId === item.productId
              ? { ...i, quantity: i.quantity + item.quantity }
              : i
          )
        : [...prev.items, item];
      const newCart = { ...prev, items: newItems };
      recalculateCart(newCart);
      return newCart;
    });
  };

  const removeFromCart = (productId: string): void => {
    setCart((prev) => {
      const newCart = { ...prev, items: prev.items.filter((i) => i.productId !== productId) };
      recalculateCart(newCart);
      return newCart;
    });
  };

  const updateQuantity = (productId: string, quantity: number): void => {
    setCart((prev) => {
      if (quantity <= 0) {
        const newCart = { ...prev, items: prev.items.filter((i) => i.productId !== productId) };
        recalculateCart(newCart);
        return newCart;
      }
      const newCart = {
        ...prev,
        items: prev.items.map((i) =>
          i.productId === productId ? { ...i, quantity } : i
        ),
      };
      recalculateCart(newCart);
      return newCart;
    });
  };

  const clearCart = (): void => {
    const emptyCart: Cart = { items: [], subtotal: 0, discount: 0, total: 0 };
    setCart(emptyCart);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // Ignore storage failures; the in-memory cart is still cleared.
    }
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
