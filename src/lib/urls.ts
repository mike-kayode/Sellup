/**
 * Central helpers for public store URLs.
 *
 * Two canonical forms exist:
 *   path-style:  sellup.ng/{slug}[/...]
 *   subdomain:   {slug}.sellup.ng[/...]
 *
 * NEXT_PUBLIC_STORE_SUBDOMAINS switches every consumer at once:
 *   1. proxy.ts      — serves {slug}.<base> and 301s path-style URLs
 *   2. storeHref()   — links shown in dashboards / emails
 *   3. display copy  — "share your store" URLs
 * Keep it false until wildcard DNS + wildcard TLS are live for *.<base>.
 */

export function getBaseDomain(): string {
  return (process.env.NEXT_PUBLIC_BASE_DOMAIN || "sellup.ng").toLowerCase();
}

export function storeSubdomainsEnabled(): boolean {
  const v = (process.env.NEXT_PUBLIC_STORE_SUBDOMAINS || "").toLowerCase();
  return v === "true" || v === "1" || v === "enabled";
}

export interface StoreHrefOptions {
  /** Force an absolute URL (emails, copy-to-clipboard). */
  absolute?: boolean;
  /** Origin for absolute path-style URLs. Defaults to https://<base>. */
  origin?: string;
}

/**
 * Canonical href for a public store page.
 *
 * - Subdomains on  -> always absolute `https://{slug}.{base}[/path]`
 *   (a subdomain is a different host, so relative hrefs can't work).
 * - Subdomains off -> relative `/{slug}[/path]` unless `absolute` is set,
 *   which produces `{origin}/{slug}[/path]`.
 */
export function storeHref(
  slug: string,
  path = "",
  options: StoreHrefOptions = {}
): string {
  const cleanPath = path
    ? path.startsWith("/")
      ? path
      : `/${path}`
    : "";

  if (storeSubdomainsEnabled()) {
    return `https://${slug}.${getBaseDomain()}${cleanPath || "/"}`;
  }

  const pathStyle = `/${slug}${cleanPath}`;
  if (!options.absolute) return pathStyle;

  const origin = (options.origin || `https://${getBaseDomain()}`).replace(
    /\/+$/,
    ""
  );
  return `${origin}${pathStyle}`;
}
