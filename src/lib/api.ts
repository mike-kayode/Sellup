/**
 * Centralized API client for Sell Up.
 *
 * Handles the Supabase access token, base URL, headers, error normalization,
 * and simple request-state tracking. Do not scatter raw fetch() calls.
 *
 * The access token is read from the Supabase session (browser client) so the
 * backend can authenticate with the `Authorization: Bearer <token>` header.
 */
import { getSupabaseClient } from "@/lib/supabase/client";

export interface ApiError {
  message: string;
  status: number;
  code?: string;
  details?: unknown;
}

export interface ApiResult<T> {
  data: T | null;
  error: ApiError | null;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = "/api") {
    this.baseUrl = baseUrl;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    try {
      const supabase = getSupabaseClient();
      const session = supabase.auth.getSession();
      const {
        data: {
          session: currentSession,
        },
      } = await session;
      if (currentSession?.access_token) {
        headers.Authorization = `Bearer ${currentSession.access_token}`;
      }
    } catch {
      // No Supabase session available; proceed without auth header.
    }

    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<ApiResult<T>> {
    const url = `${this.baseUrl}${path}`;
    const headers = await this.authHeaders();

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      const contentType = response.headers.get("content-type") || "";
      let payload: any = null;
      if (contentType.includes("application/json")) {
        payload = await response.json();
      }

      if (!response.ok) {
        return {
          data: null,
          error: {
            message: payload?.error || payload?.message || "Request failed",
            status: response.status,
            code: payload?.code,
            details: payload?.details,
          },
        };
      }

      return { data: payload as T, error: null };
    } catch (err) {
      return {
        data: null,
        error: {
          message: err instanceof Error ? err.message : "Network error",
          status: 0,
        },
      };
    }
  }

  get<T>(path: string): Promise<ApiResult<T>> {
    return this.request<T>("GET", path);
  }

  post<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
    return this.request<T>("POST", path, body);
  }

  put<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
    return this.request<T>("PUT", path, body);
  }

  del<T>(path: string): Promise<ApiResult<T>> {
    return this.request<T>("DELETE", path);
  }
}

export const apiClient = new ApiClient();
