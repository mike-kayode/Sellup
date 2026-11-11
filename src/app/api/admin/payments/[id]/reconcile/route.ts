import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, orders, payments } from "@/db/schema";
import { getClientInfo } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";
import {
  decimalToMinorUnits,
  verifyGatewayPayment,
  type AdminPaymentGateway,
} from "@/lib/admin-payments";

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
        { error: "This payment gateway cannot be reconciled automatically" },
        { status: 422 }
      );
    }
    if (payment.status === "refund_pending" || payment.status === "refunded") {
      return NextResponse.json(
        { error: "Refunds must be reconciled using the payment provider" },
        { status: 409 }
      );
    }

    const verified = await verifyGatewayPayment(
      payment.gateway as AdminPaymentGateway,
      payment.reference
    );
    const localAmount = decimalToMinorUnits(payment.amount);
    const localCurrency = (payment.currency || "NGN").toUpperCase();
    if (
      localAmount === null ||
      verified.amountMinor !== localAmount ||
      verified.currency !== localCurrency
    ) {
      return NextResponse.json(
        {
          error: "Provider and platform amount/currency do not match",
          mismatch: true,
          provider: {
            status: verified.status,
            amountMinor: verified.amountMinor,
            currency: verified.currency,
          },
          platform: {
            status: payment.status,
            amountMinor: localAmount,
            currency: localCurrency,
          },
        },
        { status: 409 }
      );
    }

    const normalizedStatus =
      verified.status === "success" || verified.status === "successful"
        ? "success"
        : ["failed", "abandoned", "cancelled"].includes(verified.status)
          ? "failed"
          : "pending";
    if (
      (payment.status === "success" || payment.status === "paid") &&
      normalizedStatus !== "success"
    ) {
      return NextResponse.json(
        {
          error: "Provider and platform payment statuses do not match",
          mismatch: true,
          providerStatus: normalizedStatus,
          platformStatus: payment.status,
        },
        { status: 409 }
      );
    }

    const { ipAddress, userAgent } = getClientInfo(request);
    const metadata =
      typeof payment.metadata === "object" &&
      payment.metadata !== null &&
      !Array.isArray(payment.metadata)
        ? payment.metadata
        : {};
    const orderId =
      "orderId" in metadata && typeof metadata.orderId === "string"
        ? metadata.orderId
        : null;

    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(payments)
        .set({
          status: normalizedStatus,
          paidAt: normalizedStatus === "success" ? new Date() : null,
        })
        .where(
          and(
            eq(payments.id, id),
            eq(payments.status, payment.status)
          )
        )
        .returning({ id: payments.id });
      if (!updated) {
        throw new Error("Payment changed while reconciliation was running");
      }

      if (orderId) {
        await tx
          .update(orders)
          .set({
            paymentStatus:
              normalizedStatus === "success" ? "paid" : normalizedStatus,
            updatedAt: new Date(),
          })
          .where(and(eq(orders.id, orderId), eq(orders.storeId, payment.storeId)));
      }

      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "payment.reconciled",
        resourceType: "payment",
        resourceId: id,
        storeId: payment.storeId,
        previousValue: {
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
        },
        newValue: {
          status: normalizedStatus,
          providerStatus: verified.status,
          amount: payment.amount,
          currency: payment.currency,
        },
        ipAddress,
        userAgent,
      });
    });

    return NextResponse.json({
      success: true,
      status: normalizedStatus,
      providerStatus: verified.status,
    });
  } catch (error) {
    console.error("Admin payment reconciliation error:", error);
    return NextResponse.json(
      { error: "Failed to reconcile payment" },
      { status: 502 }
    );
  }
}
