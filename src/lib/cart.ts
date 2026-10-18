export interface CartItem {
  productId: string;
  name: string;
  price: string;
  quantity: number;
  image?: string;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
}

export function recalculateCart(cart: Cart): void {
  cart.subtotal = cart.items.reduce(
    (sum, item) => sum + parseFloat(item.price) * item.quantity,
    0
  );
  cart.total = cart.subtotal - cart.discount;
}
