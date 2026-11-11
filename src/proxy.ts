import { NextRequest, NextResponse } from "next/server";
import { APP_ROUTE_SLUGS, MARKETING_ROUTE_SLUGS, SYSTEM_SLUGS } from "@/lib/slugs";
import { resolveCustomDomain } from "@/lib/custom-domains";
import { isMaintenanceActive, readMaintenanceSettings } from "@/lib/admin-settings";

/**
 * SellUp subdomain architecture
 * =============================
 *   try.sellup.ng    -> marketing site (landing, pricing, features, ...)
 *   sellup.ng        -> merchant app (login, register, dashboard, ...)
 *   sellup.ng/{slug} -> public business pages
 *   app.sellup.ng    -> legacy alias; redirects to the canonical host
 *
 * In local development the base domain is `localhost`, so
 * `app.localhost:3000` and `try.localhost:3000` behave the same way.
 * A bare `localhost:3000` (or an IP address) is treated in "dev" mode and
 * always serves content directly, so the classic local workflow is untouched.
 */

const APP_SLUGS = new Set<string>(APP_ROUTE_SLUGS);
const MARKETING_SLUGS = new Set<string>(MARKETING_ROUTE_SLUGS);
const SYSTEM_SLUGS_SET = new Set<string>(SYSTEM_SLUGS);

/**
 * Store subdomain architecture ({slug}.<base>) — a single env flag gates all
 * three pieces so they can never disagree:
 *   1. proxy serves {slug}.<base> by rewriting to /{slug}[/...]
 *   2. apex /{slug} 301-redirects to {slug}.<base>
 *   3. storeHref() emits subdomain URLs
 * Keep OFF until wildcard DNS + wildcard TLS are live for *.<base>.
 */
const SUBDOMAINS_ON =
  process.env.NEXT_PUBLIC_STORE_SUBDOMAINS === "true" ||
  process.env.NEXT_PUBLIC_STORE_SUBDOMAINS === "1";

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

function splitHost(host: string): { hostname: string; port: string } {
  // Strip port (handles IPv6 bracket notation as well).
  const match = host.match(/^(.*?)(?::(\d+))?$/);
  return { hostname: match?.[1] ?? "", port: match?.[2] ?? "" };
}

type Mode = "apex" | "app" | "try" | "store" | "dev" | "other";

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const search = request.nextUrl.search;
  // Business slug when the host is {slug}.<base> (store subdomain mode).
  let storeSub: string | null = null;

  // API routes, internal files, and assets are host-agnostic.
  if (path === "/api" || path.startsWith("/api/")) return NextResponse.next();
  if (path === "/_next" || path.startsWith("/_next/")) return NextResponse.next();
  const lastSegment = path.split("/").filter(Boolean).pop() ?? "";
  if (lastSegment.includes(".")) return NextResponse.next(); // favicon.ico, robots.txt, images, ...

  const configuredBase = (process.env.NEXT_PUBLIC_BASE_DOMAIN || "sellup.ng").toLowerCase();
  // Behind Cloudflare an Origin Rule rewrites Host to the apex before the
  // request reaches TrueHost's Apache (which would otherwise serve the
  // default vhost for unknown *.sellup.ng hosts). The real visitor hostname
  // arrives in X-Original-Host instead. Trust it ONLY when it belongs to
  // our base domain, so direct requests can't spoof it for open redirects.
  const forwardedHost = (request.headers.get("x-original-host") ?? "").toLowerCase();
  const rawHost = (
    forwardedHost === configuredBase || forwardedHost.endsWith("." + configuredBase)
      ? forwardedHost
      : request.headers.get("host") ?? ""
  ).toLowerCase();
  const { hostname, port } = splitHost(rawHost);

  // Resolve which "apex" the current host belongs to and what mode we are in.
  let baseDomain = configuredBase;
  let mode: Mode;

  if (hostname === configuredBase) {
    mode = isLocalHostname(configuredBase) ? "dev" : "apex";
  } else if (hostname.endsWith("." + configuredBase)) {
    const sub = hostname.slice(0, -(configuredBase.length + 1));
    mode = sub === "app" ? "app" : sub === "try" ? "try" : "apex"; // unknown subs (www, ...) treated as apex below
    if (mode === "apex" && sub !== "www") {
      // {slug}.<base> -> store subdomain (env-gated); anything else
      // (random subdomains, infra hosts) still serves natively.
      if (SUBDOMAINS_ON && !sub.includes(".")) {
        mode = "store";
        storeSub = sub;
      } else {
        mode = "dev";
      }
    }
  } else if (isLocalHostname(hostname)) {
    // Bare localhost / IP / *.localhost
    if (hostname === "localhost" || /^\d/.test(hostname) || hostname.startsWith("[") || hostname === "::1") {
      baseDomain = "localhost";
      mode = "dev";
    } else {
      baseDomain = "localhost";
      const sub = hostname.slice(0, -".localhost".length);
      mode = sub === "app" ? "app" : sub === "try" ? "try" : "dev";
      // Parity with production: {slug}.localhost:3000 serves the store
      // subdomain tree when the flag is on.
      if (SUBDOMAINS_ON && mode === "dev" && !sub.includes(".")) {
        mode = "store";
        storeSub = sub;
      }
    }
  } else {
    // Unknown host (custom domain, previews, ...): serve natively.
    mode = "dev";
  }

  const firstSegment = path.split("/").filter(Boolean)[0] ?? "";
  const isAdminPage =
    firstSegment === "my-admin" || firstSegment === "admin";
  const isCustomDomain =
    mode === "dev" &&
    hostname !== configuredBase &&
    !hostname.endsWith(`.${configuredBase}`) &&
    !isLocalHostname(hostname);
  const isStorefrontPage =
    mode === "store" ||
    isCustomDomain ||
    (mode !== "try" &&
      path !== "/" &&
      !APP_SLUGS.has(firstSegment) &&
      !MARKETING_SLUGS.has(firstSegment) &&
      !SYSTEM_SLUGS_SET.has(firstSegment));

  if (!isAdminPage && (isStorefrontPage || APP_SLUGS.has(firstSegment))) {
    try {
      const maintenance = await readMaintenanceSettings();
      if (isMaintenanceActive(maintenance)) {
        const safeMessage = maintenance.message.replace(
          /[&<>"']/g,
          (character) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[character]!
        );
        return new NextResponse(
          `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Maintenance</title></head><body style="font-family:system-ui,sans-serif;max-width:42rem;margin:15vh auto;padding:1.5rem;color:#17202a"><h1>Temporarily unavailable</h1><p>${safeMessage}</p></body></html>`,
          {
            status: 503,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Retry-After": "300",
              "Cache-Control": "no-store",
            },
          }
        );
      }
    } catch (error) {
      console.error("Maintenance status lookup failed:", error);
      if (isStorefrontPage || APP_SLUGS.has(firstSegment)) {
        return new NextResponse(
          "Service temporarily unavailable while platform status is checked.",
          {
            status: 503,
            headers: { "Retry-After": "60", "Cache-Control": "no-store" },
          }
        );
      }
    }
  }

  if (mode === "dev") {
    // Custom domain resolution (Phase 4). Resolve an active custom hostname to
    // its storefront. Requires the Cloudflare-set shared secret so hostnames
    // cannot be spoofed by direct requests to the origin.
    if (
      hostname !== configuredBase &&
      !hostname.endsWith("." + configuredBase) &&
      !isLocalHostname(hostname)
    ) {
      const secret = request.headers.get("x-custom-domain-secret");
      if (
        !process.env.CUSTOM_DOMAIN_SECRET ||
        secret !== process.env.CUSTOM_DOMAIN_SECRET
      ) {
        return new NextResponse("Forbidden", { status: 403 });
      }
      const resolved = await resolveCustomDomain(hostname);
      if (resolved) {
        const path = request.nextUrl.pathname;
        const search = request.nextUrl.search;
        return NextResponse.rewrite(
          `https://${configuredBase}/${resolved.storeSlug}${path}${search}`
        );
      }
    }
    return NextResponse.next();
  }

  const local = isLocalHostname(baseDomain) || baseDomain === "localhost";
  const scheme = local ? request.nextUrl.protocol : "https:";
  const portSuffix = local && port ? `:${port}` : "";

  const hostFor = (sub: "app" | "try" | null) =>
    `${sub ? sub + "." : ""}${baseDomain}${portSuffix}`;

  const redirectTo = (sub: "app" | "try" | null, targetPath = path) =>
    NextResponse.redirect(`${scheme}//${hostFor(sub)}${targetPath}${search}`);

  // ---- Store subdomain: {slug}.<base> serves the business page tree ----
  if (mode === "store" && storeSub) {
    // Platform paths on a store host go to their canonical host.
    if (APP_SLUGS.has(firstSegment)) return redirectTo(null);
    if (MARKETING_SLUGS.has(firstSegment)) return redirectTo("try");

    // Internal links inside store pages already carry the slug
    // (/{slug}/products/...) — pass them through untouched.
    if (path === `/${storeSub}` || path.startsWith(`/${storeSub}/`)) {
      return NextResponse.next();
    }

    // Map the clean subdomain path under the slug:
    //   /         -> /{slug}
    //   /checkout -> /{slug}/checkout
    // Next.js 16 requires absolute URLs for rewrites.
    if (path === "/") {
      return NextResponse.rewrite(`${scheme}//${hostFor(null)}/${storeSub}${search}`);
    }
    return NextResponse.rewrite(`${scheme}//${hostFor(null)}/${storeSub}${path}${search}`);
  }

  // Landing paths - the marketing site lives on try.<base>.
  if (path === "/") {
    if (mode === "try") return NextResponse.next();
    return redirectTo("try", "/"); // apex + app -> canonical landing on try.<base>
  }

  // Merchant app routes (login, register, dashboard, ...) live on the apex.
  if (APP_SLUGS.has(firstSegment)) {
    return mode === "apex" ? NextResponse.next() : redirectTo(null);
  }

  // Marketing routes (pricing, features, ...).
  if (MARKETING_SLUGS.has(firstSegment)) {
    return mode === "try" ? NextResponse.next() : redirectTo("try");
  }

  // Everything else is a public business page: sellup.ng/{business_slug}
  if (mode === "apex") {
    // Env-gated cutover: 301 path-style store URLs to {slug}.<base>.
    // Only single-segment, non-system paths are store candidates; the
    // [slug] route 404s anything that turns out not to be a real slug.
    if (
      SUBDOMAINS_ON &&
      firstSegment &&
      !SYSTEM_SLUGS_SET.has(firstSegment) &&
      !firstSegment.includes(".")
    ) {
      const rest = path.slice(1 + firstSegment.length); // "" | "/" | "/products/1"
      return NextResponse.redirect(
        `https://${firstSegment}.${configuredBase}${rest || "/"}${search}`,
        301
      );
    }
    return NextResponse.next();
  }
  return redirectTo(null);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|css|js|map|woff2?)$).*)",
  ],
};
