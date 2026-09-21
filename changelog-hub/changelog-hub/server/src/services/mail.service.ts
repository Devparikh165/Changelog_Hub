import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { OutboxEmail } from "../models/auth-tokens.model.js";

/**
 * Email delivery simulation. Nothing leaves the machine: each message is stored in the
 * `outboxemails` collection and logged to the console, and the web app's /dev/mailbox page
 * reads it, so reviewers can click verification and reset links without SMTP credentials.
 * Swap the body of `sendEmail` for a real provider (SES, Resend, SMTP) in production.
 */
export async function sendEmail(message: { to: string; subject: string; body: string; actionUrl?: string }) {
  if (!env.EMAIL_SIMULATION) {
    logger.warn(`EMAIL_SIMULATION=false and no email provider is configured; "${message.subject}" was not sent.`);
    return;
  }
  await OutboxEmail.create({
    toEmail: message.to,
    subject: message.subject,
    body: message.body,
    actionUrl: message.actionUrl ?? null,
  });
  logger.info(`📧 [simulated] to=${message.to} subject="${message.subject}" link=${message.actionUrl ?? "-"}`);
}

export function sendVerificationEmail(to: string, name: string, rawToken: string) {
  return sendEmail({
    to,
    subject: "Confirm your email address",
    body:
      `Hi ${name},\n\nConfirm your email to start reacting to product updates.\n` +
      `This link expires in ${env.EMAIL_VERIFICATION_TTL_HOURS} hours.`,
    actionUrl: `${env.FRONTEND_URL}/verify-email?token=${rawToken}`,
  });
}

export function sendPasswordResetEmail(to: string, name: string, rawToken: string) {
  return sendEmail({
    to,
    subject: "Reset your password",
    body:
      `Hi ${name},\n\nUse the link below to choose a new password. ` +
      `It expires in ${env.PASSWORD_RESET_TTL_MINUTES} minutes and works once.\n` +
      "If you didn't ask for this, you can ignore this email.",
    actionUrl: `${env.FRONTEND_URL}/reset-password?token=${rawToken}`,
  });
}
