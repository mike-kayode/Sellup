import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { domains, businesses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireMerchant } from "@/lib/merchant-auth";
import { createMerchantAuditLog } from "@/lib/admin-audit";
import { verifyDomainDns, normalizeHostname, isPlatformHostname } from "@/lib/dns-verification";
import { clearCustomDomainCache } from "@/lib/custom-domains";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";

const addDomainSchema = z.object({
  domain: z.string().min(1),
});

const verifyDomainSchema = z.object({});

export async function GET(request: NextRequest) {
  const auth = await requireMerchant(request);
  if (auth.error) return auth.error;
  const { merchant } = auth!;

  try {
    const rows = await db
      .select({
        id: domains.id,
        domain: domains.domain,
        status: domains.status,
        sslStatus: domains.sslStatus,
        verificationStatus: domains.verificationStatus,
        dnsCheckedAt: domains.dnsCheckedAt,
        connectedAt: domains.connectedAt,
        createdAt: domains.createdAt,
      })
      .from(domains)
      .where(eq(domains.storeId, merchant.storeId))
      .orderBy(domains.createdAt);

    return NextResponse.json({ domains: rows });
  } catch (error) {
    console.error("Domains list error:", error);
    return NextResponse.json({ error: "Failed to list domains" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireMerchant(request);
  if (auth.error) return auth.error;
  const { merchant } = auth!;

  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rate = await checkAuthRateLimit("merchant-domain-add:" + ip);
    if (!rate.success) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await request.json();
    const { domain } = addDomainSchema.parse(body);

    const hostname = normalizeHostname(domain);
    if (!hostname) {
      return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
    }

    const baseDomain = (process.env.NEXT_PUBLIC_BASE_DOMAIN || "sellup.ng").toLowerCase();
    if (isPlatformHostname(hostname, baseDomain)) {
      return NextResponse.json({ error: "Platform-owned hostname cannot be used" }, { status: 400 });
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
      return NextResponse.json({ error: "IP addresses are not allowed as domains" }, { status: 400 });
    }

    // Check uniqueness across all stores.
    const [existing] = await db
      .select({ id: domains.id })
      .from(domains)
      .where(eq(domains.domain, hostname))
      .limit(1);
    if (existing) {
      return NextResponse.json({ error: "Domain already in use" }, { status: 409 });
    }

    const verificationToken = crypto.randomBytes(24).toString("hex");
    const txtFqdn = "_sellup-challenge." + hostname;

    const [inserted] = await db
      .insert(domains)
      .values({
        storeId: merchant.storeId,
        domain: hostname,
        status: "pending",
        sslStatus: "pending",
        verificationStatus: "pending",
        verificationToken,
      })
      .returning();

    try {
      await createMerchantAuditLog({
        actorId: merchant.userId,
        actorRole: "merchant",
        action: "merchant.domain.add",
        resourceType: "domain",
        resourceId: inserted.id,
        storeId: merchant.storeId,
        previousValue: undefined,
        newValue: { storeId: merchant.storeId, domain: hostname },
        ipAddress: ip,
        userAgent: request.headers.get("user-agent") ?? undefined,
        status: "success",
      });
    } catch { /* ignore */ }

    return NextResponse.json({
      domain: inserted,
      dnsRecords: {
        type: "TXT",
        name: txtFqdn,
        value: verificationToken,
      },
      instructions: {
        subdomain: "Create a CNAME record: " + hostname + " -> cname.sellup.ng",
        apex: "Create an A record: " + hostname + " -> the platform apex IP (provided on request)",
        txt: "Add a TXT record at " + txtFqdn + " with value: " + verificationToken,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }
    console.error("Domain add error:", error);
    return NextResponse.json({ error: "Failed to add domain" }, { status: 500 });
  }
}
