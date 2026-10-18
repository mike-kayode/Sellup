/**
 * Reserved business slugs.
 *
 * Public business pages now live at the ROOT of the domain:
 *
 *   sellup.ng/{business_slug}
 *
 * so every platform route - merchant app, marketing site, and system
 * paths - must be reserved and can never be claimed by a business.
 */

/** First path segments that belong to the merchant app (app.sellup.ng). */
export const APP_ROUTE_SLUGS = [
  "login",
  "register",
  "verify",
  "dashboard",
  "onboarding",
  "my-admin",
  "admin",
  "settings",
  "support",
  "staff",
  "billing",
  "account",
  "auth",
  "superadmin",
  "preview",
] as const;

/** First path segments that belong to the marketing site (try.sellup.ng). */
export const MARKETING_ROUTE_SLUGS = [
  "pricing",
  "features",
  "how-it-works",
  "resources",
  "demo-store",
  "about",
  "contact",
  "help",
  "terms",
  "privacy",
  "blog",
  "docs",
  "status",
  "demo",
] as const;

/** System paths (API, legacy store routes, assets, subdomains, ...). */
export const SYSTEM_SLUGS = [
  "api",
  "store",
  "stores",
  "products",
  "checkout",
  "cart",
  "orders",
  "customers",
  "analytics",
  "coupons",
  "subscription",
  "subscriptions",
  "domains",
  "integrations",
  "appearance",
  "pages",
  "_next",
  "favicon",
  "robots",
  "sitemap",
  "assets",
  "images",
  "uploads",
  "api-docs",
  "graphql",
  "health",
  "static",
  "mail",
  "www",
  "app",
  "try",
  "proxy",
  "middleware",
] as const;

/**
 * Every slug that can never be used by a business.
 */
export const RESERVED_BUSINESS_SLUGS: string[] = [
  ...new Set<string>([
    ...APP_ROUTE_SLUGS,
    ...MARKETING_ROUTE_SLUGS,
    ...SYSTEM_SLUGS,
  ]),
];

/**
 * @deprecated Prefer RESERVED_BUSINESS_SLUGS. Kept for existing imports.
 */
export const RESERVED_STORE_SLUGS = RESERVED_BUSINESS_SLUGS;

/**
 * Validate a proposed business slug.
 * Returns an error message or null if valid.
 */
export function validateBusinessSlug(slug: string): string | null {
  // Must be 2-50 chars, lowercase alphanumeric + hyphens
  if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) {
    return "Business URL must be 2-50 characters and use only lowercase letters, numbers, and hyphens.";
  }

  if (/--/.test(slug) || slug.startsWith("-") || slug.endsWith("-")) {
    return "Business URL cannot contain consecutive or leading/trailing hyphens.";
  }

  if (RESERVED_BUSINESS_SLUGS.includes(slug)) {
    return `"${slug}" is a reserved URL and cannot be used.`;
  }

  return null;
}

/**
 * Normalize a merchant-typed business slug into canonical form:
 * lowercase, whitespace/underscores become hyphens, invalid characters
 * are dropped, repeated hyphens collapse, and the result is trimmed to
 * the 50-character limit without otherwise truncating meaningful name
 * content.
 */
export function normalizeBusinessSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

/**
 * @deprecated Prefer validateBusinessSlug. Kept for existing imports.
 */
export const validateStoreSlug = validateBusinessSlug;