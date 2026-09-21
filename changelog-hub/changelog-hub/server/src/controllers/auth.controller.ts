import type { Request, Response } from "express";
import { REFRESH_COOKIE, clearAuthCookies } from "../lib/cookies.js";
import { HttpError, apiError } from "../lib/http-error.js";
import { parse } from "../middleware/validate.js";
import { User, type UserDocument } from "../models/user.model.js";
import * as auth from "../services/auth.service.js";
import { toUserOut } from "../services/serializers.js";
import { endSession, newFamily, rotateSession, startSession } from "../services/token.service.js";
import { emailSchema, loginSchema, resetPasswordSchema, signupSchema, tokenSchema } from "../validation/schemas.js";

/** Tokens only travel in httpOnly cookies. The body carries the user and the access expiry
 *  (so the SPA can schedule a silent refresh), never the tokens themselves. */
const sessionBody = (user: UserDocument, accessTokenExpiresAt: Date) => ({ user: toUserOut(user), accessTokenExpiresAt });

export async function signup(req: Request, res: Response) {
  res.status(201).json(await auth.signup(parse(signupSchema, req.body, "body")));
}

export async function verifyEmail(req: Request, res: Response) {
  res.json(await auth.verifyEmail(parse(tokenSchema, req.body, "body").token));
}

export async function resendVerification(req: Request, res: Response) {
  res.json(await auth.resendVerification(parse(emailSchema, req.body, "body").email));
}

export async function login(req: Request, res: Response) {
  const body = parse(loginSchema, req.body, "body");
  const user = await auth.checkCredentials(body.email, body.password);
  const session = await startSession(req, res, user, newFamily());
  res.json(sessionBody(user, session.accessExpiresAt));
}

export async function refresh(req: Request, res: Response) {
  try {
    const { user, accessExpiresAt } = await rotateSession(req.cookies?.[REFRESH_COOKIE], req, res);
    res.json(sessionBody(user, accessExpiresAt));
  } catch (err) {
    // A dead session shouldn't keep sending dead cookies.
    if (err instanceof HttpError && err.status === 401) clearAuthCookies(res);
    throw err;
  }
}

export async function logout(req: Request, res: Response) {
  await endSession(req.cookies?.[REFRESH_COOKIE]);
  clearAuthCookies(res);
  res.status(204).end();
}

export async function forgotPassword(req: Request, res: Response) {
  res.json(await auth.forgotPassword(parse(emailSchema, req.body, "body").email));
}

export async function resetPassword(req: Request, res: Response) {
  const body = parse(resetPasswordSchema, req.body, "body");
  res.json(await auth.resetPassword(body.token, body.password));
}

export async function me(req: Request, res: Response) {
  const user = req.user && (await User.findById(req.user._id).lean());
  if (!user) throw apiError(401, "not_authenticated", "Sign in to continue");
  res.json(toUserOut(user));
}
