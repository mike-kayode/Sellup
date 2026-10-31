/**
 * Sell Up DNS verification helpers (Phase 4 custom domains).
 *
 * Server-side DNS lookups only. Never trust client-supplied results.
 * Used to verify TXT ownership tokens and CNAME/A targets before a custom
 * domain is activated.
 */

import dns from "dns/promises";

export interface DnsVerifyResult {
  ok: boolean;
  error?: string;
  details: Record<string, unknown>;
}

/** Normalise a hostname: lowercase, trimmed. Returns null for empty. */
export function normalizeHostname(hostname: string): string | null {
  const h = hostname.trim().toLowerCase();
  return h.length === 0 ? null : h;
}

/** True if the hostname looks like an IP address (IPv4 or IPv6). Reject these. */
export function isIpAddress(hostname: string): boolean {
  // IPv4 dotted decimal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true;
  // IPv6 (contains colons)
  if (hostname.includes(":")) return true;
  return false;
}

/**
 * True if the hostname is platform-owned and therefore cannot be used as a
 * custom domain (apex, www, app, try, api, etc. of the base domain).
 */
export function isPlatformHostname(
  hostname: string,
  baseDomain: string
): boolean {
  const base = baseDomain.toLowerCase();
  if (hostname === base) return true;
  if (hostname === "www." + base) return true;
  const platformSubs = [
    "app",
    "try",
    "api",
    "stores",
    "store",
    "dashboard",
    "admin",
    "superadmin",
    "my-admin",
    "preview",
    "proxy",
    "middleware",
    "health",
    "assets",
    "images",
    "uploads",
    "mail",
    "static",
    "blog",
    "docs",
    "status",
    "pricing",
    "features",
    "contact",
    "about",
    "help",
    "terms",
    "privacy",
  ];
  const parts = hostname.split(".");
  if (parts.length >= 2) {
    const subdomain = parts.slice(0, parts.length - 2).join(".");
    if (platformSubs.includes(subdomain)) return true;
  }
  return false;
}

function resolveTxt(domain: string): Promise<string[]> {
  return dns.resolveTxt(domain).then((records) =>
    records.flatMap((r) => r)
  );
}

function resolveCname(domain: string): Promise<string[]> {
  return dns.resolveCname(domain).catch(() => [] as string[]);
}

function resolveA(domain: string): Promise<string[]> {
  return dns.resolve4(domain).catch(() => [] as string[]);
}

/**
 * Verify a TXT record exists at `fqdn` containing `token`.
 * Checks each TXT record string for an exact substring match of the token.
 */
export async function verifyTxtRecord(
  fqdn: string,
  token: string
): Promise<DnsVerifyResult> {
  const details: Record<string, unknown> = { fqdn, recordType: "TXT" };
  try {
    const records = await resolveTxt(fqdn);
    details.records = records;
    const found = records.some((r) => r.includes(token));
    if (!found) {
      return {
        ok: false,
        error: `TXT record for ${fqdn} does not contain the ownership token`,
        details,
      };
    }
    return { ok: true, details };
  } catch (err: any) {
    details.err = err?.code ?? err?.message ?? String(err);
    return {
      ok: false,
      error: `DNS TXT lookup failed for ${fqdn}: ${details.err}`,
      details,
    };
  }
}

/**
 * Verify the hostname points at the expected target.
 * - CNAME: resolves CNAME and checks it ends with / equals target.
 * - A/ALIAS: resolves A records and checks target is among them.
 */
export async function verifyDnsTarget(
  hostname: string,
  target: string,
  type: "CNAME" | "A" = "CNAME"
): Promise<DnsVerifyResult> {
  const details: Record<string, unknown> = {
    hostname,
    recordType: type,
    expectedTarget: target,
  };
  try {
    if (type === "CNAME") {
      const cnames = await resolveCname(hostname);
      details.cnames = cnames;
      const found = cnames.some(
        (c) => c.toLowerCase() === target.toLowerCase() ||
          c.toLowerCase().endsWith("." + target.toLowerCase())
      );
      if (!found) {
        return {
          ok: false,
          error: `Hostname ${hostname} does not resolve via CNAME to ${target}`,
          details,
        };
      }
    } else {
      const addrs = await resolveA(hostname);
      details.a = addrs;
      const found = addrs.includes(target);
      if (!found) {
        return {
          ok: false,
          error: `Hostname ${hostname} does not resolve via A to ${target}`,
          details,
        };
      }
    }
    return { ok: true, details };
  } catch (err: any) {
    details.err = err?.code ?? err?.message ?? String(err);
    return {
      ok: false,
      error: `DNS ${type} lookup failed for ${hostname}: ${details.err}`,
      details,
    };
  }
}

/**
 * Full domain verification: TXT ownership token + target (CNAME/A) check.
 * Returns ok=true only when both pass.
 */
export async function verifyDomainDns(input: {
  hostname: string;
  expectedType: "CNAME" | "A";
  expectedTarget: string;
  txtToken: string;
  txtFqdn: string;
}): Promise<DnsVerifyResult> {
  const txt = await verifyTxtRecord(input.txtFqdn, input.txtToken);
  if (!txt.ok) return txt;
  return verifyDnsTarget(input.hostname, input.expectedTarget, input.expectedType);
}
