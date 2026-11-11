import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, orders, payments } from "@/db/schema";
import { getClientInfo } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";
import {
  requestGatewayRefund,
  type AdminPaymentGateway,
  decimalToMinorUnits,
} from "@/lib/admin-payments";

const paramsSchema = z.string().uuid();
const refundSchema = z
  .object({
    reason: z.string().trim().min(3).max(500),
    confirmation: z.literal("REFUND"),
  })
  .strict();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!paramsSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Invalid payment id" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = refundSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid refund request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [payment] = await db
      .select({
        id: payments.id,
        storeId: payments.storeId,
        reference: payments.reference,
        amount: payments.amount,
        currency: payments.currency,
        gateway: payments.gateway,
        status: payments.status,
        metadata: payments.metadata,
      })
      .from(payments)
      .where(eq(payments.id, id))
      .limit(1);
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }
    if (payment.gateway !== "paystack" && payment.gateway !== "flutterwave") {
      return NextResponse.json(
        { error: "This payment gateway does not support automated refunds" },
        { status: 422 }
      );
    }
    if (payment.status !== "success" && payment.status !== "paid") {
      return NextResponse.json(
        { error: "Only successful, not-yet-refunded payments can be refunded" },
        { status: 409 }
      );
    }
    if (decimalToMinorUnits(payment.amount) === null) {
      return NextResponse.json({ error: "Payment amount is invalid" }, { status: 409 });
    }

    const priorMetadata = isRecord(payment.metadata) ? payment.metadata : {};
    const now = new Date();
    const requestMetadata = {
      ...priorMetadata,
      refund: {
        status: "requested",
        reason: parsed.data.reason,
        requestedBy: user.id,
        requestedAt: now.toISOString(),
      },
    };
    const { ipAddress, userAgent } = getClientInfo(request);

    const [reserved] = await db.transaction(async (tx) => {
      const rows = await tx
        .update(payments)
        .set({ status: "refund_pending", metadata: requestMetadata })
        .where(
          and(
            eq(payments.id, id),
            inArray(payments.status, ["success", "paid"])
          )
        )
        .returning({ id: payments.id });
      if (!rows[0]) return [null];

      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "payment.refund_requested",
        resourceType: "payment",
        resourceId: id,
        storeId: payment.storeId,
        previousValue: { status: payment.status },
        newValue: {
          status: "refund_pending",
          amount: payment.amount,
          currency: payment.currency,
          reason: parsed.data.reason,
        },
        ipAddress,
        userAgent,
      });
      return [rows[0]];
    });

    if (!reserved) {
      return NextResponse.json(
        { error: "Payment refund is already being processed" },
        { status: 409 }
      );
    }

    let refundResult: Awaited<ReturnType<typeof requestGatewayRefund>>;
    try {
      refundResult = await requestGatewayRefund({
        gateway: payment.gateway as AdminPaymentGateway,
        reference: payment.reference,
        amount: payment.amount,
        currency: payment.currency || "NGN",
        reason: parsed.data.reason,
      });
    } catch (gatewayError) {
      console.error("Admin refund request failed", {
        paymentId: payment.id,
        gateway: payment.gateway,
        error:
          gatewayError instanceof Error
            ? gatewayError.message
            : "Unknown gateway error",
      });
      return NextResponse.json(
        {
          error:
            "The gateway did not confirm the refund request. Payment remains pending; reconcile with the provider before retrying.",
        },
        { status: 502 }
      );
    }

    const finalStatus = refundResult.state;
    const finalMetadata = {
      ...requestMetadata,
      refund: {
        ...(requestMetadata.refund),
        status: finalStatus,
        providerReference: refundResult.providerReference,
        completedAt: finalStatus === "refunded" ? new Date().toISOString() : null,
      },
    };

    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({ status: finalStatus, metadata: finalMetadata })
        .where(
          and(
            eq(payments.id, id),
            eq(payments.status, "refund_pending")
          )
        );

      const metadataOrderId = priorMetadata.orderId;
      if (finalStatus === "refunded" && typeof metadataOrderId === "string") {
        await tx
          .update(orders)
          .set({ paymentStatus: "refunded", updatedAt: new Date() })
          .where(
            and(
              eq(orders.id, metadataOrderId),
              eq(orders.storeId, payment.storeId)
            )
          );
      }

      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action:
          finalStatus === "refunded"
            ? "payment.refunded"
            : "payment.refund_pending",
        resourceType: "payment",
        resourceId: id,
        storeId: payment.storeId,
        previousValue: { status: "refund_pending" },
        newValue: {
          status: finalStatus,
          providerReference: refundResult.providerReference,
        },
        ipAddress,
        userAgent,
      });
    });

    return NextResponse.json({ success: true, status: finalStatus });
  } catch (error) {
    console.error("Admin payment refund error:", error);
    return NextResponse.json({ error: "Failed to process payment refund" }, { status: 500 });
  }
}
