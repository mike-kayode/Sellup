interface CloudflareRetryResponse {
  success?: boolean;
  result?: {
    ssl?: {
      status?: unknown;
    };
  };
}

export async function retryCloudflareTlsValidation(hostnameId: string): Promise<string> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!token || !zoneId) throw new Error("CLOUDFLARE_NOT_CONFIGURED");
  if (!/^[a-zA-Z0-9_-]{1,255}$/.test(hostnameId) || !/^[a-f0-9]{32}$/.test(zoneId)) {
    throw new Error("CLOUDFLARE_CONFIGURATION_INVALID");
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames/${encodeURIComponent(hostnameId)}/ssl/retry_validation`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    },
  );
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== "object" || !("success" in payload) || payload.success !== true) {
    throw new Error("CLOUDFLARE_TLS_RETRY_FAILED");
  }

  const result = payload as CloudflareRetryResponse;
  const status = result.result?.ssl?.status;
  return typeof status === "string" ? status.slice(0, 50) : "pending_validation";
}
