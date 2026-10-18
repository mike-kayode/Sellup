/**
 * Vertical presets (spec section 8).
 *
 * A preset only changes default labels, category icons, hero copy and the
 * suggested brand color. The layout NEVER changes.
 */

export const VERTICALS = ["fashion", "food", "grocery", "perfume", "general"] as const;
export type Vertical = (typeof VERTICALS)[number];

export function normalizeVertical(input: string | null | undefined): Vertical {
  const v = (input || "").toLowerCase();
  return (VERTICALS as readonly string[]).includes(v) ? (v as Vertical) : "general";
}

export interface PresetCategory {
  name: string;
  /** Key resolved to a lucide icon inside the renderer. */
  icon: string;
}

export interface VerticalPreset {
  vertical: Vertical;
  label: string;
  defaultCategories: PresetCategory[];
  heroTitle: string;
  heroSubtitle: string;
  brandColor: string;
}

export const VERTICAL_PRESETS: Record<Vertical, VerticalPreset> = {
  fashion: {
    vertical: "fashion",
    label: "Fashion & lifestyle",
    defaultCategories: [
      { name: "Fashion", icon: "shirt" },
      { name: "Beauty", icon: "sparkles" },
      { name: "Home", icon: "home" },
    ],
    heroTitle: "Trendy Styles\nJust for You",
    heroSubtitle: "Quality. Style. Always.",
    brandColor: "#16A34A",
  },
  food: {
    vertical: "food",
    label: "Food & restaurants",
    defaultCategories: [
      { name: "Meals", icon: "utensils" },
      { name: "Drinks", icon: "drinks" },
      { name: "Snacks", icon: "snacks" },
    ],
    heroTitle: "Hot & Fresh\nEvery Day",
    heroSubtitle: "Made with love, delivered fast.",
    brandColor: "#EA580C",
  },
  grocery: {
    vertical: "grocery",
    label: "Groceries",
    defaultCategories: [
      { name: "Fresh", icon: "fresh" },
      { name: "Pantry", icon: "pantry" },
      { name: "Drinks", icon: "drinks" },
    ],
    heroTitle: "Fresh Picks\nAt Your Door",
    heroSubtitle: "Market-fresh, fair prices.",
    brandColor: "#16A34A",
  },
  perfume: {
    vertical: "perfume",
    label: "Perfumes & scents",
    defaultCategories: [
      { name: "Men", icon: "men" },
      { name: "Women", icon: "women" },
      { name: "Unisex", icon: "unisex" },
    ],
    heroTitle: "Signature Scents\nFor Every Mood",
    heroSubtitle: "Authentic fragrances, always.",
    brandColor: "#7C3AED",
  },
  general: {
    vertical: "general",
    label: "General store",
    defaultCategories: [
      { name: "Featured", icon: "sparkles" },
      { name: "New in", icon: "grid" },
      { name: "Deals", icon: "home" },
    ],
    heroTitle: "Great Finds\nJust for You",
    heroSubtitle: "Everything you love in one store.",
    brandColor: "#16A34A",
  },
};

export function getPreset(vertical: Vertical): VerticalPreset {
  return VERTICAL_PRESETS[vertical] || VERTICAL_PRESETS.general;
}