import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, domains, stores } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getClientInfo } from "@/lib/admin-audit";
import { clearCustomDomainCache } from "@/lib/custom-domains";
import { verifyTxtRecord } from "@/lib/dns-verification";
import { retryCloudflareTlsValidation } from "@/lib/cloudflare";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("disable"),
    domainId: z.string().uuid(),
    reason: z.string().trim().min(1).max(500),
  }).strict(),
  z.object({
    action: z.literal("check_dns"),
    domainId: z.string().uuid(),
  }).strict(),
  z.object({
    action: z.literal("retry_tls"),
    domainId: z.string().uuid(),
  }).strict(),
]);

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  try {
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") || "").trim().slice(0, 100);
    const status = url.searchParams.get("status") || "all";
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50));
    const filters = [];
    if (status !== "all") filters.push(eq(domains.status, status));
    if (search) filters.push(or(ilike(domains.domain, `%${search}%`), ilike(stores.storeName, `%${search}%`))!);
    const where = filters.length ? and(...filters) : undefined;
    const [totalResult, rows] = await Promise.all([
      db.select({ total: count() }).from(domains)
        .leftJoin(stores, eq(domains.storeId, stores.id)).where(where),
      db.select({
        id: domains.id,
        storeId: domains.storeId,
        domain: domains.domain,
        status: domains.status,
        sslStatus: domains.sslStatus,
        cloudflareHostnameId: domains.cloudflareHostnameId,
        verificationStatus: domains.verificationStatus,
        dnsCheckedAt: domains.dnsCheckedAt,
        expiresAt: domains.expiresAt,
        disabledReason: domains.disabledReason,
        createdAt: domains.createdAt,
        storeName: stores.storeName,
        storeSlug: stores.storeSlug,
      }).from(domains)
        .leftJoin(stores, eq(domains.storeId, stores.id))
        .where(where)
        .orderBy(desc(domains.createdAt), desc(domains.id))
        .limit(limit).offset((page - 1) * limit),
    ]);
    return NextResponse.json({
      domains: rows.map(({ cloudflareHostnameId, ...row }) => ({
        ...row,
        canRetryTls: Boolean(cloudflareHostnameId),
        storeName: row.storeName || "Unknown store",
        storeSlug: row.storeSlug || "unknown",
      })),
      total: totalResult[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin domains error:", error);
    return NextResponse.json({ error: "Failed to load domains" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid domain action", details: parsed.error.flatten() }, { status: 400 });
  try {
    const [domain] = await db.select({
      id: domains.id,
      domain: domains.domain,
      storeId: domains.storeId,
      status: domains.status,
      sslStatus: domains.sslStatus,
      verificationStatus: domains.verificationStatus,
      verificationToken: domains.verificationToken,
      disabledReason: domains.disabledReason,
      cloudflareHostnameId: domains.cloudflareHostnameId,
    }).from(domains).where(eq(domains.id, parsed.data.domainId)).limit(1);
    if (!domain) return NextResponse.json({ error: "Domain not found" }, { status: 404 });

    const { ipAddress, userAgent } = getClientInfo(request);
    if (parsed.data.action === "check_dns") {
      if (!domain.verificationToken) return NextResponse.json({ error: "Domain has no verification token" }, { status: 409 });
      const check = await verifyTxtRecord(
        `_sellup-challenge.${domain.domain}`,
        domain.verificationToken
      );
      const checkedAt = new Date();
      const nextVerificationStatus = check.ok ? "verified" : "pending";
      const updated = await db.transaction(async (tx) => {
        const [after] = await tx.update(domains).set({
          verificationStatus: nextVerificationStatus,
          dnsCheckedAt: checkedAt,
          dnsRecords: { ownershipTxtPresent: check.ok },
          updatedAt: checkedAt,
        }).where(eq(domains.id, domain.id)).returning({
          id: domains.id,
          domain: domains.domain,
          storeId: domains.storeId,
          verificationStatus: domains.verificationStatus,
          dnsCheckedAt: domains.dnsCheckedAt,
        });
        await tx.insert(auditLogs).values({
          actorId: user.id,
          actorRole: user.role,
          action: "domain.dns_checked",
          resourceType: "domain",
          resourceId: domain.id,
          storeId: domain.storeId,
          previousValue: { verificationStatus: domain.verificationStatus },
          newValue: { verificationStatus: nextVerificationStatus, ownershipTxtPresent: check.ok },
          ipAddress,
          userAgent,
        });
        return after;
      });
      return NextResponse.json({ domain: updated, ownershipTxtPresent: check.ok });
    }

    if (parsed.data.action === "retry_tls") {
      if (!domain.cloudflareHostnameId) {
        return NextResponse.json({ error: "This domain is not connected to Cloudflare for SaaS" }, { status: 409 });
      }
      let sslStatus: string;
      try {
        sslStatus = await retryCloudflareTlsValidation(domain.cloudflareHostnameId);
      } catch (error) {
        if (error instanceof Error && (error.message === "CLOUDFLARE_NOT_CONFIGURED" || error.message === "CLOUDFLARE_CONFIGURATION_INVALID")) {
          return NextResponse.json({ error: "Cloudflare TLS management is not configured correctly" }, { status: 503 });
        }
        console.error("Cloudflare TLS retry request failed:", error);
        return NextResponse.json({ error: "Cloudflare could not retry TLS validation" }, { status: 502 });
      }
      const updated = await db.transaction(async (tx) => {
        const [after] = await tx.update(domains).set({
          sslStatus,
          updatedAt: new Date(),
        }).where(eq(domains.id, domain.id)).returning({
          id: domains.id,
          domain: domains.domain,
          storeId: domains.storeId,
          sslStatus: domains.sslStatus,
        });
        await tx.insert(auditLogs).values({
          actorId: user.id,
          actorRole: user.role,
          action: "domain.tls_retry_requested",
          resourceType: "domain",
          resourceId: domain.id,
          storeId: domain.storeId,
          previousValue: { sslStatus: domain.sslStatus },
          newValue: { sslStatus },
          ipAddress,
          userAgent,
        });
        return after;
      });
      return NextResponse.json({ domain: updated });
    }

    if (domain.status === "disabled") {
      return NextResponse.json({ error: "Domain is already disabled" }, { status: 409 });
    }
    const reason = parsed.data.reason;
    const updated = await db.transaction(async (tx) => {
      const [after] = await tx.update(domains).set({
        status: "disabled",
        disabledReason: reason,
        updatedAt: new Date(),
      }).where(eq(domains.id, domain.id)).returning({
        id: domains.id,
        domain: domains.domain,
        status: domains.status,
        disabledReason: domains.disabledReason,
      });
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "domain.disabled",
        resourceType: "domain",
        resourceId: domain.id,
        storeId: domain.storeId,
        previousValue: { status: domain.status, disabledReason: domain.disabledReason },
        newValue: after,
        ipAddress,
        userAgent,
      });
      return after;
    });
    clearCustomDomainCache();
    return NextResponse.json({ domain: updated });
  } catch (error) {
    console.error("Admin domain action failed:", error);
    return NextResponse.json({ error: "Failed to update domain" }, { status: 500 });
  }
}
