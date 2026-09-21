import { Schema, model } from "mongoose";
import { TOKEN_PURPOSES } from "../config/constants.js";

/**
 * Email-verification and password-reset links. Only the SHA-256 hash is stored, so a
 * database leak doesn't hand out working links. Expired rows are removed by MongoDB.
 */
const oneTimeTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    purpose: { type: String, enum: TOKEN_PURPOSES, required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
// Keep used/expired links a day for debugging, then let MongoDB delete them.
oneTimeTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export const OneTimeToken = model("OneTimeToken", oneTimeTokenSchema);

/**
 * One document per issued refresh token (`_id` is the JWT's `jti`). Tokens from one login
 * share a `family`. Presenting a token that was already rotated means it leaked, so the
 * whole family is revoked (reuse detection).
 */
const refreshTokenSchema = new Schema(
  {
    _id: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    /** Set when this token was exchanged for a new pair (normal rotation). */
    rotatedAt: { type: Date, default: null },
    /** Set when the session was ended on purpose: logout, password reset or detected reuse. */
    revokedAt: { type: Date, default: null },
    replacedBy: { type: String, default: null },
    userAgent: { type: String, default: null, maxlength: 255 },
  },
  { timestamps: true },
);
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model("RefreshToken", refreshTokenSchema);

/** Simulated mail delivery: emails land here (and in the console) instead of an SMTP server. */
const outboxEmailSchema = new Schema(
  {
    toEmail: { type: String, required: true, lowercase: true, index: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    actionUrl: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
outboxEmailSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const OutboxEmail = model("OutboxEmail", outboxEmailSchema);
