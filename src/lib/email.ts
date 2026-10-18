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
 */
function buildEmailContent(
  template: EmailTemplate,
  data: Record<string, any>
): string {
  const brandColor = "#25D366";

  const baseTemplate = `
    <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${brandColor}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background-color: ${brandColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Brand logo: PNG-rendered from the Cloudinary SVG so every
               client (Gmail blocks SVG) can display it. Sits on an explicit
               dark chip so it stays readable whether the client renders
               light or dark mode. -->
          <div style="text-align:center;margin:0 0 16px;">
            <span style="display:inline-block;background-color:#0b1210;padding:14px 22px;border-radius:14px;">
              <img src="https://res.cloudinary.com/dmuewlavb/image/upload/f_png,q_auto,w_360/v1791708791/sellup-logo-dark_cahmgj.svg" alt="Sell Up" width="150" height="40" style="display:block;height:40px;width:auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />
            </span>
          </div>
          ${buildTemplateBody(template, data)}
          <div class="footer">
            <p>© 2026 Sell Up. All rights reserved.</p>
            <p>Create your online store in minutes. Receive orders on WhatsApp.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return baseTemplate;
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

    default:
      return `<div class="content"><p>Email template not found.</p></div>`;
  }
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
    },
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
  };

const renderer = templates[template];
  return renderer ? renderer(data) : "Email template not found";
}
