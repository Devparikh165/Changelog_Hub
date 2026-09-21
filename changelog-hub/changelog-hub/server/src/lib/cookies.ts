import type { CookieOptions, Response } from "express";
import { env } from "../config/env.js";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";
/** The refresh cookie is only ever sent to the auth endpoints, never to content APIs. */
export const REFRESH_COOKIE_PATH = "/api/v1/auth";
/**
 * Readable by JavaScript and carries no secret: it only tells the SPA "a session probably
 * exists", so anonymous visitors don't fire /me and /refresh requests that are sure to 401.
 */
export const SESSION_HINT_COOKIE = "session_hint";

const base = (): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAMESITE,
  domain: env.COOKIE_DOMAIN,
});

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  const refreshMs = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60_000;
  // The JWT inside expires after 15 minutes; the cookie deliberately lives as long as the
  // session. An expired token then still reaches the API, which answers `401 token_expired`
  // so the client rotates, instead of the request silently arriving anonymous.
  res.cookie(ACCESS_COOKIE, accessToken, { ...base(), path: "/", maxAge: refreshMs });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...base(), path: REFRESH_COOKIE_PATH, maxAge: refreshMs });
  res.cookie(SESSION_HINT_COOKIE, "1", { ...base(), httpOnly: false, path: "/", maxAge: refreshMs });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...base(), path: "/" });
  res.clearCookie(REFRESH_COOKIE, { ...base(), path: REFRESH_COOKIE_PATH });
  res.clearCookie(SESSION_HINT_COOKIE, { ...base(), httpOnly: false, path: "/" });
}
