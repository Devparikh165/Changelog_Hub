import type { NextFunction, Request, Response } from "express";
import { ACCESS_COOKIE } from "../lib/cookies.js";
import { apiError } from "../lib/http-error.js";
import { User } from "../models/user.model.js";
import { verifyAccessToken } from "../services/token.service.js";

/** Browsers use the httpOnly cookie; API tools (Postman, curl) may send a Bearer header instead. */
function extractAccessToken(req: Request): string | undefined {
  const cookie: unknown = req.cookies?.[ACCESS_COOKIE];
  if (typeof cookie === "string" && cookie) return cookie;
  const header = req.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() || undefined : undefined;
}

/**
 * Attaches `req.user` when an access token is present. Anonymous requests continue, but a
 * token that is present and expired/invalid is rejected (401 token_expired / invalid_token /
 * token_revoked), so the client knows to refresh instead of silently becoming anonymous.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractAccessToken(req);
  if (!token) return next();

  const claims = verifyAccessToken(token);
  const user = await User.findById(claims.sub).lean();
  if (!user) throw apiError(401, "invalid_token", "Account no longer exists");
  if (user.tokenVersion !== claims.tv) throw apiError(401, "token_revoked", "Session ended after a password change");

  req.user = {
    _id: user._id,
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    isVerified: user.isVerified,
    lastViewedChangelogAt: user.lastViewedChangelogAt ?? null,
    createdAt: user.createdAt,
  };
  next();
}

export function requireUser(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw apiError(401, "not_authenticated", "Sign in to continue");
  next();
}

export function requireVerified(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw apiError(401, "not_authenticated", "Sign in to continue");
  if (!req.user.isVerified) throw apiError(403, "email_not_verified", "Verify your email address first");
  next();
}

/** Role-based access control for the publishing studio. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw apiError(401, "not_authenticated", "Sign in to continue");
  if (req.user.role !== "admin") throw apiError(403, "forbidden", "Admin access required");
  next();
}
