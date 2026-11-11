/**
 * WhatsApp service for Sell Up
 * Sends WhatsApp messages to merchants and customers.
 *
 * Requires the following environment variables:
 *   - WHATSAPP_API_URL (e.g. https://api.example.com/v1/messages)
 *   - WHATSAPP_API_KEY
 *   - WHATSAPP_FROM_NUMBER (your WhatsApp business number)
 */

export interface WhatsAppMessage {
  to: string;
  message: string;
}

/**
 * Send a WhatsApp message. In development without API config, logs to console.
 * Failures are non-fatal — they never break the order flow.
 */
export async function sendWhatsApp(message: WhatsAppMessage): Promise<boolean> {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiKey = process.env.WHATSAPP_API_KEY;
  const fromNumber = process.env.WHATSAPP_FROM_NUMBER;

  if (!apiUrl || !apiKey || !fromNumber) {
    if (process.env.NODE_ENV === "production") {
      console.error("WhatsApp API not configured");
    } else {
      console.log(`[WHATSAPP] (Development Mode) Would send to ${message.to}:`, {
        from: fromNumber || "<not configured>",
        message: message.message,
      });
    }
    return false;
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromNumber,
        to: message.to,
        body: message.message,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("WhatsApp API error:", errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send WhatsApp:", error);
    return false;
  }
}
