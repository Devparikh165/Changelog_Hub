import type { AuthResponse } from "@/lib/types";

export const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

/** Resolve server-relative asset paths (e.g. /uploads/x.png) against the API origin. */
export function assetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return path.startsWith("/") ? `${API_URL}${path}` : path;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Field-level messages from 422 responses, keyed by camelCase field name. */
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, code: string, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query;
  formData?: FormData;
  signal?: AbortSignal;
  /** Internal: prevents infinite refresh loops. */
  retried?: boolean;
}

// Codes that mean "your access token is unusable, try rotating it".
const REFRESHABLE = new Set(["token_expired", "token_revoked", "invalid_token"]);

export const AUTH_EVENTS = {
  refreshed: "auth:refreshed",
  ended: "auth:ended",
} as const;

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Rotates the refresh token. Concurrent callers share one request, which matters:
 * two parallel rotations would trip the server's reuse detection and log the user out.
 */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch(`${API_URL}/api/v1/auth/refresh`, { method: "POST", credentials: "include" })
    .then(async (res) => {
      if (res.ok) {
        const data = (await res.json()) as AuthResponse;
        window.dispatchEvent(new CustomEvent(AUTH_EVENTS.refreshed, { detail: data }));
        return true;
      }
      window.dispatchEvent(new Event(AUTH_EVENTS.ended));
      return false;
    })
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

function buildUrl(path: string, query?: Query): string {
  const url = `${API_URL}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function toApiError(res: Response): Promise<ApiError> {
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* non-JSON error body */
  }
  const detail = (payload as { detail?: unknown } | null)?.detail;

  if (Array.isArray(detail)) {
    const fieldErrors: Record<string, string> = {};
    for (const item of detail as { loc?: (string | number)[]; msg?: string }[]) {
      const field = String(item.loc?.[item.loc.length - 1] ?? "form");
      fieldErrors[field] ??= (item.msg ?? "Invalid value").replace(/^Value error, /, "");
    }
    const first = Object.values(fieldErrors)[0] ?? "Check the highlighted fields";
    return new ApiError(res.status, "validation_error", first, fieldErrors);
  }
  if (detail && typeof detail === "object") {
    const d = detail as { code?: string; message?: string };
    return new ApiError(res.status, d.code ?? "error", d.message ?? res.statusText);
  }
  const fallback = res.status >= 500 ? "Something went wrong on the server. Try again." : res.statusText;
  return new ApiError(res.status, "error", typeof detail === "string" ? detail : fallback);
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, formData, signal, retried = false } = options;
  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      credentials: "include",
      signal,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "network_error", "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 401 && !retried && !path.startsWith("/api/v1/auth/")) {
    const error = await toApiError(res.clone());
    if (REFRESHABLE.has(error.code)) {
      // Whether or not refresh works, retry once: on failure the cookies are cleared
      // and public endpoints answer anonymously.
      await refreshSession();
      return api<T>(path, { ...options, retried: true });
    }
    throw error;
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
