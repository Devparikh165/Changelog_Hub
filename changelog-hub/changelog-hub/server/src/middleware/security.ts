import type { NextFunction, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";
import { apiError } from "../lib/http-error.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const trustedOrigins = new Set([
  ...env.CORS_ORIGINS,
  env.PUBLIC_API_URL, // Swagger UI served by the API itself
  `http://localhost:${env.PORT}`,
  `http://127.0.0.1:${env.PORT}`,
]);

/**
 * CSRF defence in depth. Auth rides on cookies, so a state-changing request coming from
 * another website must never be honoured. SameSite=Lax cookies already block most of this;
 * checking Origin also covers same-site subdomains and older browsers. Requests with no
 * Origin (curl, Postman, server-to-server) don't carry another site's cookies, so they pass.
 */
export function originGuard(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get("origin");
  if (!origin || trustedOrigins.has(origin) || isLocalDevOrigin(origin)) return next();
  throw apiError(403, "bad_origin", "Cross-site request blocked");
}

/** In development, any localhost port is fine (Vite moves to 5174 when 5173 is busy). */
function isLocalDevOrigin(origin: string): boolean {
  return !env.isProduction && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

/** API responses carry per-user data; never let a proxy or the browser cache them. */
export function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.set("Cache-Control", "no-store");
  next();
}

/**
 * Brute-force protection: RATE_LIMIT_ATTEMPTS requests per RATE_LIMIT_WINDOW_SECONDS per IP,
 * counted separately for each endpoint it's attached to (login, signup, reset…).
 */
export function authRateLimit() {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_SECONDS * 1000,
    limit: env.RATE_LIMIT_ATTEMPTS,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => !env.RATE_LIMIT_ENABLED,
    handler: (req, res) => {
      const info = (req as typeof req & { rateLimit?: { resetTime?: Date } }).rateLimit;
      const reset = info?.resetTime?.getTime() ?? Date.now() + env.RATE_LIMIT_WINDOW_SECONDS * 1000;
      const retry = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      res.status(429).json({ detail: { code: "rate_limited", message: `Too many attempts. Try again in ${retry} seconds` } });
    },
  });
}
