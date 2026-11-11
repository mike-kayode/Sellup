export type AdminPaymentGateway = "paystack" | "flutterwave";

export interface VerifiedGatewayPayment {
  reference: string;
  status: string;
  amountMinor: number;
  currency: string;
  transactionId: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function decimalToMinorUnits(amount: string): number | null {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(amount);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] || "").padEnd(2, "0"));
  const result = whole * 100 + fraction;
  return Number.isSafeInteger(result) ? result : null;
}

function getGatewaySecret(gateway: AdminPaymentGateway) {
  return gateway === "paystack"
    ? process.env.PAYSTACK_SECRET_KEY || process.env.PAYMENT_SECRET_KEY
    : process.env.FLUTTERWAVE_SECRET_KEY || process.env.PAYMENT_SECRET_KEY;
}

export async function verifyGatewayPayment(
  gateway: AdminPaymentGateway,
  reference: string
): Promise<VerifiedGatewayPayment> {
  const secret = getGatewaySecret(gateway);
  if (!secret) throw new Error("Payment gateway is not configured");

  const response =
    gateway === "paystack"
      ? await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
          { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store" }
        )
      : await fetch(
          `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
          { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store" }
        );
  const body: unknown = await response.json();
  if (!response.ok || !isRecord(body) || body.status !== "success" || !isRecord(body.data)) {
    throw new Error("Payment gateway verification failed");
  }

  const data = body.data;
  const gatewayReference =
    gateway === "paystack" ? data.reference : data.tx_ref;
  const amount =
    gateway === "paystack"
      ? (typeof data.amount === "number" ? data.amount : Number.NaN)
      : decimalToMinorUnits(
          typeof data.amount === "number" || typeof data.amount === "string"
            ? String(data.amount)
            : ""
        );
  const status =
    typeof data.status === "string" ? data.status.toLowerCase() : "";
  const currency =
    typeof data.currency === "string" ? data.currency.toUpperCase() : "";
  const transactionId =
    typeof data.id === "number" || typeof data.id === "string"
      ? String(data.id)
      : null;

  if (
    gatewayReference !== reference ||
    !status ||
    typeof amount !== "number" ||
    !Number.isSafeInteger(amount) ||
    !currency
  ) {
    throw new Error("Payment gateway returned invalid verification data");
  }

  return {
    reference,
    status,
    amountMinor: amount,
    currency,
    transactionId,
  };
}

export async function requestGatewayRefund(input: {
  gateway: AdminPaymentGateway;
  reference: string;
  amount: string;
  currency: string;
  reason: string;
}) {
  const secret = getGatewaySecret(input.gateway);
  if (!secret) throw new Error("Payment gateway is not configured");
  const amountMinor = decimalToMinorUnits(input.amount);
  if (amountMinor === null) throw new Error("Payment amount is invalid");
  const verified = await verifyGatewayPayment(input.gateway, input.reference);
  const successfulStatuses =
    input.gateway === "paystack" ? ["success"] : ["successful"];
  if (
    !successfulStatuses.includes(verified.status) ||
    verified.amountMinor !== amountMinor ||
    verified.currency !== input.currency.toUpperCase()
  ) {
    throw new Error("Verified payment does not match the refundable amount");
  }

  if (input.gateway === "paystack") {
    const response = await fetch("https://api.paystack.co/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction: input.reference,
        amount: amountMinor,
        merchant_note: input.reason,
      }),
      cache: "no-store",
    });
    const body: unknown = await response.json();
    if (!response.ok || !isRecord(body) || body.status !== true) {
      throw new Error("Payment gateway rejected the refund request");
    }
    const data = isRecord(body.data) ? body.data : {};
    const state = typeof data.status === "string" ? data.status.toLowerCase() : "pending";
    return {
      state: state === "processed" || state === "completed" ? "refunded" : "pending",
      providerReference:
        typeof data.id === "number" || typeof data.id === "string"
          ? String(data.id)
          : null,
    } as const;
  }

  if (!verified.transactionId || !/^\d+$/.test(verified.transactionId)) {
    throw new Error("Payment gateway transaction id is unavailable");
  }
  const response = await fetch(
    `https://api.flutterwave.com/v3/transactions/${verified.transactionId}/refund`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: input.amount }),
      cache: "no-store",
    }
  );
  const body: unknown = await response.json();
  if (!response.ok || !isRecord(body) || body.status !== "success") {
    throw new Error("Payment gateway rejected the refund request");
  }
  const data = isRecord(body.data) ? body.data : {};
  const state = typeof data.status === "string" ? data.status.toLowerCase() : "pending";
  return {
    state: state === "successful" || state === "completed" ? "refunded" : "pending",
    providerReference:
      typeof data.id === "number" || typeof data.id === "string"
        ? String(data.id)
        : verified.transactionId,
  } as const;
}
