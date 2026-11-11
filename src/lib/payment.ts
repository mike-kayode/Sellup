/**
 * Payment service for Sell Up
 * Supports Paystack and Flutterwave
 * Phase 2 implementation
 */

export enum PaymentProvider {
  PAYSTACK = "paystack",
  FLUTTERWAVE = "flutterwave",
}

export interface PaymentConfig {
  provider: PaymentProvider;
  publicKey: string;
  secretKey: string;
}

export interface PaymentInitRequest {
  email: string;
  amount: number; // In kobo (smallest currency unit)
  orderId: string;
  metadata?: Record<string, any>;
  callbackUrl?: string;
}

export interface PaymentInitResponse {
  success: boolean;
  authorizationUrl?: string;
  accessCode?: string;
  reference?: string;
  message?: string;
}

export interface PaymentVerifyRequest {
  provider: PaymentProvider;
  reference: string;
}

export interface PaymentVerifyResponse {
  success: boolean;
  status: "success" | "pending" | "failed";
  amount: number;
  reference: string;
  customer: {
    email: string;
    name?: string;
  };
}

/**
 * Initialize payment with Paystack
 */
export async function initializePaystackPayment(
  config: PaymentConfig,
  request: PaymentInitRequest
): Promise<PaymentInitResponse> {
  try {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: request.email,
        amount: request.amount,
        reference: request.orderId,
        metadata: request.metadata,
        callback_url: request.callbackUrl,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || "Payment initialization failed",
      };
    }

    return {
      success: true,
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
    };
  } catch (error) {
    console.error("Paystack initialization error:", error);
    return {
      success: false,
      message: "Payment initialization failed",
    };
  }
}

/**
 * Verify payment with Paystack
 */
export async function verifyPaystackPayment(
  config: PaymentConfig,
  reference: string
): Promise<PaymentVerifyResponse> {
  try {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${config.secretKey}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok || !data.status) {
      return {
        success: false,
        status: "failed",
        amount: 0,
        reference,
        customer: { email: "" },
      };
    }

    const transaction = data.data;

    return {
      success: transaction.status === "success",
      status: transaction.status,
      amount: transaction.amount,
      reference: transaction.reference,
      customer: {
        email: transaction.customer.email,
        name: transaction.customer.customer_code,
      },
    };
  } catch (error) {
    console.error("Paystack verification error:", error);
    return {
      success: false,
      status: "failed",
      amount: 0,
      reference,
      customer: { email: "" },
    };
  }
}

/**
 * Initialize payment with Flutterwave
 */
export async function initializeFlutterwavePayment(
  config: PaymentConfig,
  request: PaymentInitRequest
): Promise<PaymentInitResponse> {
  try {
    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: request.orderId,
        amount: request.amount / 100, // Convert from kobo to naira
        currency: "NGN",
        redirect_url: request.callbackUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/verify`,
        customer: {
          email: request.email,
        },
        meta: request.metadata,
        customizations: {
          title: "Sell Up Order Payment",
          description: `Order ${request.orderId}`,
        },
      }),
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });

    const data = await response.json();

    if (!data.status || data.status !== "success") {
      return {
        success: false,
        message: data.message || "Payment initialization failed",
      };
    }

    return {
      success: true,
      authorizationUrl: data.data.link,
      reference: data.data.tx_ref || request.orderId,
    };
  } catch (error) {
    console.error("Flutterwave initialization error:", error);
    return {
      success: false,
      message: "Payment initialization failed",
    };
  }
}

/**
 * Verify payment with Flutterwave
 */
export async function verifyFlutterwavePayment(
  config: PaymentConfig,
  reference: string
): Promise<PaymentVerifyResponse> {
  try {
    const response = await fetch(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${config.secretKey}`,
        },
      }
    );

    const data = await response.json();

    if (!data.status || data.status !== "success") {
      return {
        success: false,
        status: "failed",
        amount: 0,
        reference,
        customer: { email: "" },
      };
    }

    const transaction = data.data;

    return {
      success: transaction.status === "successful",
      status: transaction.status === "successful" ? "success" : "failed",
      amount: transaction.amount * 100, // Convert to kobo
      reference: transaction.tx_ref,
      customer: {
        email: transaction.customer.email,
        name: transaction.customer.name,
      },
    };
  } catch (error) {
    console.error("Flutterwave verification error:", error);
    return {
      success: false,
      status: "failed",
      amount: 0,
      reference,
      customer: { email: "" },
    };
  }
}

/**
 * Generic payment initialization
 */
export async function initializePayment(
  provider: PaymentProvider,
  config: PaymentConfig,
  request: PaymentInitRequest
): Promise<PaymentInitResponse> {
  if (provider === PaymentProvider.PAYSTACK) {
    return initializePaystackPayment(config, request);
  } else if (provider === PaymentProvider.FLUTTERWAVE) {
    return initializeFlutterwavePayment(config, request);
  }

  return {
    success: false,
    message: "Invalid payment provider",
  };
}

/**
 * Generic payment verification
 */
export async function verifyPayment(
  provider: PaymentProvider,
  config: PaymentConfig,
  reference: string
): Promise<PaymentVerifyResponse> {
  if (provider === PaymentProvider.PAYSTACK) {
    return verifyPaystackPayment(config, reference);
  } else if (provider === PaymentProvider.FLUTTERWAVE) {
    return verifyFlutterwavePayment(config, reference);
  }

  return {
    success: false,
    status: "failed",
    amount: 0,
    reference,
    customer: { email: "" },
  };
}

/**
 * Format amount to kobo (Paystack standard)
 */
export function formatAmountToKobo(naira: number): number {
  return Math.round(naira * 100);
}

/**
 * Format amount from kobo to naira
 */
export function formatAmountFromKobo(kobo: number): number {
  return kobo / 100;
}

/**
 * Generate payment reference
 */
export function generatePaymentReference(orderId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PAY-${timestamp}-${random}`;
}

/**
 * Validate webhook signature (Paystack)
 */
export function validatePaystackWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const crypto = require("crypto");
  const hash = crypto
    .createHmac("sha512", secret)
    .update(body)
    .digest("hex");
  return hash === signature;
}

/**
 * Validate webhook signature (Flutterwave)
 */
export function validateFlutterwaveWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const crypto = require("crypto");
  const hash = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return hash === signature;
}
