import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Types } from "mongoose";
import type { TokenPurpose } from "../config/constants.js";
import { env } from "../config/env.js";
import { apiError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";
import { OneTimeToken } from "../models/auth-tokens.model.js";
import { User, type UserDocument } from "../models/user.model.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "./mail.service.js";
import { revokeAllForUser } from "./token.service.js";

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export const hashPassword = (password: string) => bcrypt.hash(password, env.BCRYPT_ROUNDS);

// A real hash of a random string. Compared against when the email is unknown, so a failed
// login takes the same time either way and timing can't reveal which emails are registered.
let dummyHash: string | undefined;
const getDummyHash = async () => (dummyHash ??= await hashPassword(randomBytes(16).toString("hex")));

const TTL_MS: Record<TokenPurpose, () => number> = {
  verify_email: () => env.EMAIL_VERIFICATION_TTL_HOURS * 60 * 60_000,
  reset_password: () => env.PASSWORD_RESET_TTL_MINUTES * 60_000,
};

/** Issues a single-use link token. Only the newest link of each kind works. */
async function issueOneTimeToken(userId: Types.ObjectId, purpose: TokenPurpose): Promise<string> {
  await OneTimeToken.updateMany({ user: userId, purpose, usedAt: null }, { $set: { usedAt: new Date() } });
  const raw = randomBytes(32).toString("base64url");
  await OneTimeToken.create({
    user: userId,
    purpose,
    tokenHash: sha256(raw),
    expiresAt: new Date(Date.now() + TTL_MS[purpose]()),
  });
  return raw;
}

/** Validates and burns a link token in one atomic step, so it can never be used twice. */
async function consumeOneTimeToken(raw: string, purpose: TokenPurpose): Promise<UserDocument> {
  const tokenHash = sha256(raw);
  const token = await OneTimeToken.findOne({ tokenHash, purpose }).lean();
  if (!token || token.usedAt) throw apiError(400, "invalid_token", "This link is invalid or has already been used");
  if (token.expiresAt < new Date()) throw apiError(400, "token_expired", "This link has expired. Request a new one");

  const claimed = await OneTimeToken.findOneAndUpdate(
    { tokenHash, purpose, usedAt: null },
    { $set: { usedAt: new Date() } },
  );
  if (!claimed) throw apiError(400, "invalid_token", "This link is invalid or has already been used");

  const user = await User.findById(token.user);
  if (!user) throw apiError(400, "invalid_token", "This link is invalid or has already been used");
  return user;
}

export async function signup(input: { name: string; email: string; password: string }) {
  if (await User.exists({ email: input.email })) {
    throw apiError(409, "email_taken", "An account with this email already exists");
  }
  const user = await User.create({ name: input.name, email: input.email, passwordHash: await hashPassword(input.password) });
  const raw = await issueOneTimeToken(user._id, "verify_email");
  await sendVerificationEmail(user.email, user.name, raw);
  return { message: "Account created. Check your inbox to verify your email." };
}

export async function verifyEmail(raw: string) {
  const user = await consumeOneTimeToken(raw, "verify_email");
  user.isVerified = true;
  await user.save();
  return { message: "Email verified. You can sign in now." };
}

export async function resendVerification(email: string) {
  const user = await User.findOne({ email });
  if (user && !user.isVerified) {
    const raw = await issueOneTimeToken(user._id, "verify_email");
    await sendVerificationEmail(user.email, user.name, raw);
  }
  // Same answer either way, so the endpoint can't be used to discover accounts.
  return { message: "If that account needs verification, a new link is on its way." };
}

export async function checkCredentials(email: string, password: string): Promise<UserDocument> {
  const user = await User.findOne({ email }).select("+passwordHash");
  // Always run bcrypt so response time doesn't reveal whether the email exists.
  const valid = await bcrypt.compare(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !valid) throw apiError(401, "invalid_credentials", "Email or password is incorrect");
  if (!user.isVerified) throw apiError(403, "email_not_verified", "Verify your email before signing in");
  return user;
}

export async function forgotPassword(email: string) {
  const user = await User.findOne({ email });
  if (user) {
    const raw = await issueOneTimeToken(user._id, "reset_password");
    await sendPasswordResetEmail(user.email, user.name, raw);
  }
  return { message: "If an account exists for that email, a reset link is on its way." };
}

export async function resetPassword(raw: string, password: string) {
  const user = await consumeOneTimeToken(raw, "reset_password");
  user.passwordHash = await hashPassword(password);
  user.tokenVersion += 1; // every access token already issued stops working
  user.isVerified = true; // receiving the email proves they own the address
  await user.save();
  await revokeAllForUser(user._id); // and every refresh token
  return { message: "Password updated. Sign in with your new password." };
}

/** Bootstraps the first admin from ADMIN_EMAIL / ADMIN_PASSWORD (startup and seed). */
export async function ensureAdmin(): Promise<void> {
  const email = env.ADMIN_EMAIL.trim().toLowerCase();
  if (!email || !env.ADMIN_PASSWORD) return;
  if (await User.exists({ email })) return;
  await User.create({
    email,
    name: env.ADMIN_NAME,
    passwordHash: await hashPassword(env.ADMIN_PASSWORD),
    role: "admin",
    isVerified: true,
  });
  logger.info(`Created admin account ${email}`);
}
