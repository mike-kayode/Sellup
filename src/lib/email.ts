/**
 * Email service for Sell Up
 * Integrated with Resend for production email delivery.
 *
 * Requires the following environment variables:
 *   - RESEND_API_KEY (e.g. re_...)
 *   - RESEND_FROM_EMAIL (defaults to no-reply@sellup.ng)
 *   - RESEND_FROM_NAME (defaults to "Sell Up")
 */

export enum EmailTemplate {
  ORDER_CONFIRMATION = "order_confirmation",
  ORDER_STATUS_UPDATE = "order_status_update",
  CUSTOMER_WELCOME = "customer_welcome",
  STORE_WELCOME = "store_welcome",
  PASSWORD_RESET = "password_reset",
  EMAIL_VERIFICATION = "email_verification",
  VERIFICATION_CODE = "verification_code",
  SUPPORT_REPLY = "support_reply",
  BILLING_PAST_DUE = "billing_past_due",
  ANNOUNCEMENT = "announcement",
}

export interface EmailMessage {
  to: string;
  subject: string;
  template: EmailTemplate;
  data: Record<string, any>;
  cc?: string[];
  bcc?: string[];
}

/**
 * Send email notification using Resend.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "no-reply@sellup.ng";
    const fromName = process.env.RESEND_FROM_NAME || "Sell Up";

    // Keep local development usable, but fail closed in production.
    if (!apiKey) {
      if (process.env.NODE_ENV === "production") {
        console.error("RESEND_API_KEY is not configured");
        return false;
      }
      console.log(
        `[EMAIL] (Development Mode) Email would be sent to ${message.to}:`,
        {
          subject: message.subject,
          template: message.template,
          data: message.data,
        }
      );
      return true;
    }

    // Build email content based on template
    const emailContent = buildEmailContent(message.template, message.data);

    // Plain-text fallback: HTML-only mail is a spam signal for many filters.
    const textContent = emailContent
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Send via Resend REST API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: message.to,
        subject: message.subject,
        html: emailContent,
        text: textContent,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Resend error:", errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

/**
 * Build email content based on template
 * Polished, responsive templates with light/dark mode support
 */
function buildEmailContent(
  template: EmailTemplate,
  data: Record<string, any>
): string {
  const brandColor = "#25D366";

  const baseTemplate = (body: string) => `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="light dark" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <title>Sell Up</title>
        <style>
          @media (prefers-color-scheme: dark) {
            .bg-dark { background-color: #0f172a; }
            .text-dark { color: #e2e8f0; }
            .muted-dark { color: #94a3b8; }
            .border-dark { border-color: #334155; }
            .card-dark { background-color: #1e293b; }
            .btn-dark { background-color: #25D366; color: white; }
            .body-dark { background-color: #0f172a; color: #e2e8f0; }
          }
          @media (prefers-color-scheme: light) {
            .bg-light { background-color: #ffffff; }
            .text-light { color: #333333; }
            .muted-light { color: #64748b; }
            .border-light { border-color: #e2e8f0; }
            .card-light { background-color: #f8fafc; }
            .btn-light { background-color: #25D366; color: white; }
            .body-light { background-color: #ffffff; color: #333333; }
          }
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
            background-color: #ffffff;
            color: #333333;
          }
          .container {
            max-width: 640px;
            margin: 0 auto;
            padding: 0;
            width: 100%;
          }
          .header {
            background-color: #25D366;
            color: white;
            text-align: center;
            padding: 32px 24px;
            border-radius: 12px 12px 0 0;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.5px;
          }
          .header p {
            margin: 8px 0 0;
            font-size: 16px;
            opacity: 0.9;
          }
          .content {
            background-color: #f8fafc;
            padding: 32px 24px;
            border-radius: 0 0 12px 12px;
          }
          .card {
            background-color: white;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
          }
          .card h2 {
            margin: 0 0 16px;
            font-size: 20px;
            font-weight: 600;
            color: #333333;
          }
          .order-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 12px 0;
            border-bottom: 1px solid #f1f5f9;
          }
          .order-row:last-child {
            border-bottom: none;
          }
          .order-item-name {
            font-weight: 500;
            color: #333333;
          }
          .order-item-qty {
            color: #64748b;
            font-size: 14px;
          }
          .order-item-price {
            font-weight: 600;
            color: #333333;
          }
          .totals {
            margin-top: 24px;
            padding-top: 24px;
            border-top: 2px solid #e2e8f0;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            color: #64748b;
            margin: 8px 0;
          }
          .total-row.bold {
            font-weight: 700;
            color: #333333;
            font-size: 18px;
            margin-top: 16px;
          }
          .highlight {
            color: #25D366;
            font-weight: 600;
          }
          .btn {
            display: inline-block;
            background-color: #25D366;
            color: white;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 8px;
            font-weight: 600;
            text-align: center;
            margin: 24px 0;
          }
          .footer {
            padding: 24px;
            text-align: center;
            font-size: 14px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
          }
          .footer a {
            color: #25D366;
            text-decoration: none;
          }
          .code-box {
            font-size: 32px;
            font-weight: 700;
            letter-spacing: 8px;
            text-align: center;
            color: #25D366;
            padding: 24px;
            background-color: #f0fdf4;
            border-radius: 12px;
            border: 1px solid #bbf7d0;
            margin: 24px 0;
            font-family: "Courier New", monospace;
          }
          @media (max-width: 480px) {
            .container { padding: 0 12px; }
            .header { padding: 24px 16px; }
            .content { padding: 24px 16px; }
            .card { padding: 20px 16px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          {{body}}
        </div>
      </body>
    </html>
  `;
  return baseTemplate(buildTemplateBody(template, data));
}

/**
 * Build template-specific email body
 */
function buildTemplateBody(
  template: EmailTemplate,
  data: Record<string, any>
): string {
  const brandColor = "#25D366";

  switch (template) {
    case EmailTemplate.ORDER_CONFIRMATION:
      return `
        <div class="header"><h1>✓ Order Confirmed!</h1></div>
        <div class="content">
          <p>Hi ${data.customerName || "Customer"},</p>
          <p>Your order has been confirmed successfully!</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="border-bottom: 1px solid #ddd;">
              <td style="padding: 10px;"><strong>Order Number</strong></td>
              <td style="padding: 10px; text-align: right;"><strong>#${data.orderNumber}</strong></td>
            </tr>
            <tr style="border-bottom: 1px solid #ddd;">
              <td style="padding: 10px;">Total Amount</td>
              <td style="padding: 10px; text-align: right;">₦${parseFloat(
                data.total || 0
              ).toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 10px;">Store</td>
              <td style="padding: 10px; text-align: right;">${data.storeName}</td>
            </tr>
          </table>
          <p>Your order will be processed shortly. You'll receive updates on the status of your delivery.</p>
          <p>If you have any questions, please contact the store directly.</p>
        </div>
      `;

    case EmailTemplate.ORDER_STATUS_UPDATE:
      return `
        <div class="header"><h1>Order Update</h1></div>
        <div class="content">
          <p>Hi ${data.customerName || "Customer"},</p>
          <p>Your order <strong>#${data.orderNumber}</strong> status has been updated:</p>
          <p style="font-size: 18px; color: ${brandColor}; font-weight: bold; margin: 20px 0;">
            Status: ${capitalizeStatus(data.status)}
          </p>
          <p>${getStatusMessage(data.status)}</p>
          <p>Store: ${data.storeName}</p>
        </div>
      `;

    case EmailTemplate.CUSTOMER_WELCOME:
      return `
        <div class="header"><h1>Welcome to ${data.storeName}!</h1></div>
        <div class="content">
          <p>Hi ${data.customerName},</p>
          <p>Thank you for your first purchase! We're excited to have you as a customer.</p>
          <p>Browse our latest products and enjoy exclusive deals!</p>
          <a href="${data.storeUrl}" class="button">Visit Store</a>
        </div>
      `;

    case EmailTemplate.STORE_WELCOME:
      return `
        <div class="header"><h1>Welcome to Sell Up!</h1></div>
        <div class="content">
          <p>Hi ${data.storeOwnerName},</p>
          <p>Your store <strong>${data.storeName}</strong> is now live!</p>
          <p>Your unique store URL: <strong>${data.storeUrl}</strong></p>
          <p>Start adding products and grow your business.</p>
          <a href="${data.dashboardUrl}" class="button">Go to Dashboard</a>
        </div>
      `;

    case EmailTemplate.PASSWORD_RESET:
      return `
        <div class="header"><h1>Reset Your Password</h1></div>
        <div class="content">
          <p>Hi ${data.email},</p>
          <p>You requested to reset your password. Click the button below to proceed:</p>
          <a href="${data.resetUrl}" class="button">Reset Password</a>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `;

    case EmailTemplate.EMAIL_VERIFICATION:
      return `
        <div class="header"><h1>Verify Your Email</h1></div>
        <div class="content">
          <p>Hi ${data.email},</p>
          <p>Please verify your email address to complete your Sell Up account setup:</p>
          <a href="${data.verificationUrl}" class="button">Verify Email</a>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This link expires in 24 hours.
          </p>
        </div>
      `;

    case EmailTemplate.VERIFICATION_CODE:
      return `
        <div class="header"><h1>Verify Your Email</h1></div>
        <div class="content">
          <p>Hi${data.name ? ` ${data.name}` : ""},</p>
          <p>Use the code below to verify your Sell Up account:</p>
          <div style="text-align: center; margin: 28px 0;">
            <span style="display: inline-block; font-size: 40px; font-weight: 700; letter-spacing: 14px; color: #111; background: #ffffff; border: 2px dashed #25D366; border-radius: 12px; padding: 16px 8px 16px 22px;">${data.code}</span>
          </div>
          <p style="color: #666; font-size: 13px;">
            This code expires in ${data.expiresInMinutes || 10} minutes.
            If you didn't create a Sell Up account, you can safely ignore this email.
          </p>
        </div>
      `;

    case EmailTemplate.SUPPORT_REPLY:
      return `
        <div class="header"><h1>Support ticket update</h1></div>
        <div class="content">
          <p>Hi ${escapeHtml(String(data.customerName || "there"))},</p>
          <p>Our support team replied to your ticket: <strong>${escapeHtml(String(data.subject || "Support request"))}</strong></p>
          <div class="card"><p>${escapeHtml(String(data.reply || "")).replace(/\n/g, "<br />")}</p></div>
          <p>Sign in to your Sell Up account to continue the conversation.</p>
        </div>
      `;

    case EmailTemplate.BILLING_PAST_DUE:
      return `
        <div class="header"><h1>Subscription payment due</h1></div>
        <div class="content">
          <p>Hi ${escapeHtml(String(data.customerName || "there"))},</p>
          <p>The billing period for <strong>${escapeHtml(String(data.storeName || "your store"))}</strong> has ended, and its subscription is now past due.</p>
          ${data.paymentUrl ? `<p><a class="button" href="${escapeHtml(String(data.paymentUrl))}">Retry payment</a></p>` : ""}
          ${data.attempt ? `<p>This is renewal attempt ${escapeHtml(String(data.attempt))}.</p>` : ""}
          <p>Please review your subscription and contact Sell Up support if you need help restoring service.</p>
        </div>
      `;

    case EmailTemplate.ANNOUNCEMENT:
      return `
        <div class="header"><h1>${escapeHtml(String(data.title || "Sell Up announcement"))}</h1></div>
        <div class="content">
          <p>${escapeHtml(String(data.message || "")).replace(/\n/g, "<br />")}</p>
          ${data.preferencesUrl ? `<p><a href="${escapeHtml(String(data.preferencesUrl))}">Manage notification preferences</a></p>` : ""}
        </div>
      `;

    default:
      return `<div class="content"><p>Email template not found.</p></div>`;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);
}

/**
 * Helper to capitalize status
 */
function capitalizeStatus(status: string): string {
  return status
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Get message for order status
 */
function getStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    pending: "Your order has been received and is awaiting confirmation.",
    confirmed: "Your order has been confirmed and is being prepared.",
    preparing: "Your order is being prepared for shipment.",
    ready: "Your order is ready for pickup or shipment.",
    completed: "Your order has been completed. Thank you for shopping with us!",
    cancelled: "Your order has been cancelled. Please contact the store for details.",
  };
  return messages[status] || "Your order status has been updated.";
}

/**
 * Send order confirmation email
 */
export async function sendOrderConfirmationEmail(
  customerEmail: string,
  orderNumber: string,
  orderTotal: string,
  storeName: string,
  customerName?: string
): Promise<boolean> {
  return sendEmail({
    to: customerEmail,
    subject: `Order Confirmed: #${orderNumber}`,
    template: EmailTemplate.ORDER_CONFIRMATION,
    data: {
      orderNumber,
      total: orderTotal,
      storeName,
      customerName: customerName || "Customer",
    },
  });
}

/**
 * Send order status update email
 */
export async function sendOrderStatusEmail(
  customerEmail: string,
  orderNumber: string,
  status: string,
  storeName: string,
  customerName?: string
): Promise<boolean> {
  return sendEmail({
    to: customerEmail,
    subject: `Order #${orderNumber} - Status Update`,
    template: EmailTemplate.ORDER_STATUS_UPDATE,
    data: {
      orderNumber,
      status,
      storeName,
      customerName: customerName || "Customer",
    }
  });
}

  /**
 * Send customer welcome email
 */
export async function sendCustomerWelcomeEmail(
  customerEmail: string,
  customerName: string,
  storeName: string,
  storeUrl: string
): Promise<boolean> {
  return sendEmail({
    to: customerEmail,
    subject: `Welcome to ${storeName}!`,
    template: EmailTemplate.CUSTOMER_WELCOME,
    data: {
      customerName,
      storeName,
      storeUrl,
    },
  });
}

/**
 * Send store welcome email
 */
export async function sendStoreWelcomeEmail(
  storeOwnerEmail: string,
  storeOwnerName: string,
  storeName: string,
  storeUrl: string,
  dashboardUrl: string
): Promise<boolean> {
  return sendEmail({
    to: storeOwnerEmail,
    subject: `Welcome to Sell Up - Your store is live!`,
    template: EmailTemplate.STORE_WELCOME,
    data: {
      storeOwnerName,
      storeName,
      storeUrl,
      dashboardUrl,
    },
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: `Reset Your Sell Up Password`,
    template: EmailTemplate.PASSWORD_RESET,
    data: {
      email,
      resetUrl,
    },
  });
}

/**
 * Send email verification email
 */
export async function sendEmailVerificationEmail(
  email: string,
  verificationUrl: string
): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: `Verify Your Sell Up Email`,
    template: EmailTemplate.EMAIL_VERIFICATION,
    data: {
      email,
      verificationUrl,
    },
  });
}

/**
 * Send the 6-digit signup verification code (no link / no URL).
 */
export async function sendVerificationCodeEmail(
  email: string,
  code: string,
  name?: string
): Promise<boolean> {
  return sendEmail({
    to: email,
    // Keep the code out of the subject — inbox previews leak it, and codes in
    // subjects are a known spam-filter trigger.
    subject: `Your Sell Up verification code`,
    template: EmailTemplate.VERIFICATION_CODE,
    data: {
      code,
      name,
      expiresInMinutes: 10,
    },
  });
}

/**
 * Email template renderer
 */
export function renderEmailTemplate(
  template: EmailTemplate,
  data: Record<string, any>
): string {
  const templates: Record<EmailTemplate, (data: any) => string> = {
    [EmailTemplate.ORDER_CONFIRMATION]: (data) =>
      `Your order #${data.orderNumber} has been confirmed. Total: ₦${data.orderTotal}`,
    [EmailTemplate.ORDER_STATUS_UPDATE]: (data) =>
      `Your order #${data.orderNumber} status is now: ${data.status}`,
    [EmailTemplate.CUSTOMER_WELCOME]: (data) =>
      `Welcome to ${data.storeName}!`,
    [EmailTemplate.STORE_WELCOME]: (data) =>
      `Welcome to Sell Up, ${data.storeName}! Your store is ready at ${data.storeUrl}`,
    [EmailTemplate.PASSWORD_RESET]: (data) =>
      `Click here to reset your password: ${data.resetLink}`,
    [EmailTemplate.EMAIL_VERIFICATION]: (data) =>
      `Verify your email: ${data.verificationLink}`,
    [EmailTemplate.VERIFICATION_CODE]: (data) =>
      `Your Sell Up verification code: ${data.code}`,
    [EmailTemplate.SUPPORT_REPLY]: (data) =>
      `Our support team replied to "${data.subject}".`,
    [EmailTemplate.BILLING_PAST_DUE]: (data) =>
      data.paymentUrl
        ? `The subscription for ${data.storeName} is past due. Retry payment: ${data.paymentUrl}`
        : `The subscription for ${data.storeName} is past due.`,
    [EmailTemplate.ANNOUNCEMENT]: (data) =>
      `${data.title}: ${data.message}`,
  };

const renderer = templates[template];
  return renderer ? renderer(data) : "Email template not found";
}
