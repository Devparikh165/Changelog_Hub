import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Types } from "mongoose";
import type { Role } from "../config/constants.js";
import { env } from "../config/env.js";
import { setAuthCookies } from "../lib/cookies.js";
import { apiError } from "../lib/http-error.js";
import { RefreshToken } from "../models/auth-tokens.model.js";
import { User, type UserDocument } from "../models/user.model.js";

const ISSUER = "changelog-hub";
const ALGORITHM = "HS256" as const;

export interface AccessClaims {
  sub: string;
  role: Role;
  tv: number;
}

type TokenSubject = { _id: Types.ObjectId; role: Role; tokenVersion: number };

function describeJwtError(err: unknown, kind: "Access" | "Refresh"): never {
  if (err instanceof jwt.TokenExpiredError) throw apiError(401, "token_expired", `${kind} token has expired`);
  throw apiError(401, "invalid_token", `${kind} token is invalid`);
}

export function createAccessToken(user: TokenSubject): { token: string; expiresAt: Date } {
  const ttl = env.ACCESS_TOKEN_TTL_MINUTES * 60;
  const token = jwt.sign({ role: user.role, tv: user.tokenVersion }, env.JWT_ACCESS_SECRET, {
    algorithm: ALGORITHM,
    subject: String(user._id),
    issuer: ISSUER,
    audience: "access",
    jwtid: randomUUID(),
    expiresIn: ttl,
  });
  return { token, expiresAt: new Date(Date.now() + ttl * 1000) };
}

export function verifyAccessToken(token: string): AccessClaims {
  let claims: jwt.JwtPayload;
  try {
    // Separate secret + audience: a refresh token can never be used as an access token.
    claims = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: "access",
    }) as jwt.JwtPayload;
  } catch (err) {
    describeJwtError(err, "Access");
  }
  if (typeof claims.sub !== "string" || typeof claims.tv !== "number") {
    throw apiError(401, "invalid_token", "Access token is invalid");
  }
  return { sub: claims.sub, role: claims.role as Role, tv: claims.tv };
}

function verifyRefreshToken(token: string): jwt.JwtPayload & { jti: string; sub: string } {
  let claims: jwt.JwtPayload;
  try {
    claims = jwt.verify(token, env.JWT_REFRESH_SECRET, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: "refresh",
    }) as jwt.JwtPayload;
  } catch (err) {
    describeJwtError(err, "Refresh");
  }
  if (typeof claims.jti !== "string" || typeof claims.sub !== "string") {
    throw apiError(401, "invalid_token", "Refresh token is invalid");
  }
  return claims as jwt.JwtPayload & { jti: string; sub: string };
}

/**
 * Issues an access + refresh pair in `family`, stores the refresh token's jti and sets
 * the cookies. Returns the new jti so the caller can link the token it replaced.
 */
export async function startSession(
  req: Request,
  res: Response,
  user: UserDocument | (TokenSubject & { _id: Types.ObjectId }),
  family: string,
): Promise<{ accessExpiresAt: Date; jti: string }> {
  const access = createAccessToken(user);
  const jti = randomUUID();
  const ttl = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;
  await RefreshToken.create({
    _id: jti,
    user: user._id,
    family,
    expiresAt: new Date(Date.now() + ttl * 1000),
    userAgent: (req.get("user-agent") ?? "").slice(0, 255) || null,
  });
  const refresh = jwt.sign({ fam: family }, env.JWT_REFRESH_SECRET, {
    algorithm: ALGORITHM,
    subject: String(user._id),
    issuer: ISSUER,
    audience: "refresh",
    jwtid: jti,
    expiresIn: ttl,
  });
  setAuthCookies(res, access.token, refresh);
  return { accessExpiresAt: access.expiresAt, jti };
}

export const newFamily = () => randomUUID();

export async function revokeFamily(family: string): Promise<void> {
  await RefreshToken.updateMany({ family, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export async function revokeAllForUser(userId: Types.ObjectId): Promise<void> {
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

/**
 * Refresh-token rotation with reuse detection.
 *
 * Each call revokes the presented refresh token and issues a new pair in the same family.
 * If a token that was already rotated shows up again it has probably leaked, so the whole
 * family is revoked and everyone holding it must sign in again. Two tabs refreshing at the
 * same moment look exactly like that, so a just-rotated token is honoured for
 * REFRESH_REUSE_GRACE_SECONDS while its family is still alive.
 */
export async function rotateSession(
  raw: string | undefined,
  req: Request,
  res: Response,
): Promise<{ user: UserDocument; accessExpiresAt: Date }> {
  if (!raw) throw apiError(401, "not_authenticated", "No active session");

  let claims: ReturnType<typeof verifyRefreshToken>;
  try {
    claims = verifyRefreshToken(raw);
  } catch (err) {
    const code = (err as { code?: string }).code ?? "invalid_token";
    throw apiError(401, code, "Session expired. Sign in again");
  }

  const stored = await RefreshToken.findById(claims.jti);
  if (!stored || String(stored.user) !== claims.sub) {
    throw apiError(401, "invalid_token", "Session not found. Sign in again");
  }
  const now = new Date();
  if (stored.expiresAt < now) throw apiError(401, "token_expired", "Session expired. Sign in again");
  if (stored.revokedAt) {
    // Logged out, reset, or already caught being replayed: this family is dead for good.
    throw apiError(401, "refresh_reuse_detected", "Session was revoked for your security. Sign in again");
  }

  const user = await User.findById(stored.user);
  if (!user) throw apiError(401, "invalid_token", "Account no longer exists");

  // Claim the token atomically: of two concurrent requests, exactly one rotates it.
  const claimed = await RefreshToken.findOneAndUpdate(
    { _id: claims.jti, rotatedAt: null, revokedAt: null },
    { $set: { rotatedAt: now } },
    { returnDocument: "after" },
  );

  if (!claimed) {
    const current = await RefreshToken.findById(claims.jti).lean();
    const rotatedMsAgo = current?.rotatedAt ? now.getTime() - current.rotatedAt.getTime() : Number.POSITIVE_INFINITY;
    if (!current?.revokedAt && rotatedMsAgo <= env.REFRESH_REUSE_GRACE_SECONDS * 1000) {
      // Benign race: another tab rotated this token a moment ago.
      const session = await startSession(req, res, user, stored.family);
      return { user, accessExpiresAt: session.accessExpiresAt };
    }
    await revokeFamily(stored.family);
    throw apiError(401, "refresh_reuse_detected", "Session was revoked for your security. Sign in again");
  }

  const session = await startSession(req, res, user, stored.family);
  await RefreshToken.updateOne({ _id: claims.jti }, { $set: { replacedBy: session.jti } });
  return { user, accessExpiresAt: session.accessExpiresAt };
}

/** Logout: revoke the whole family of the presented token. Never throws. */
export async function endSession(raw: string | undefined): Promise<void> {
  if (!raw) return;
  try {
    const decoded = jwt.decode(raw) as jwt.JwtPayload | null;
    if (!decoded?.jti) return;
    // Signature still checked (expired tokens are fine: they can still name their family).
    jwt.verify(raw, env.JWT_REFRESH_SECRET, { algorithms: [ALGORITHM], ignoreExpiration: true, audience: "refresh" });
    const stored = await RefreshToken.findById(decoded.jti).lean();
    if (stored) await revokeFamily(stored.family);
  } catch {
    /* logging out with a broken token is still a logout */
  }
}
