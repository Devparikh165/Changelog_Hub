import type { Request, Response } from "express";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { notFound } from "../lib/http-error.js";
import { parse } from "../middleware/validate.js";
import { OutboxEmail } from "../models/auth-tokens.model.js";
import { mailboxQuery } from "../validation/schemas.js";

export function health(_req: Request, res: Response) {
  const up = mongoose.connection.readyState === 1;
  res.status(up ? 200 : 503).json({ status: up ? "ok" : "degraded", database: up ? "up" : "down" });
}

/** Simulated inbox. Disabled when NODE_ENV=production or EMAIL_SIMULATION=false. */
export async function mailbox(req: Request, res: Response) {
  if (!env.devToolsEnabled) throw notFound("Not found");
  const { email, limit } = parse(mailboxQuery, req.query, "query");
  const mail = await OutboxEmail.find(email ? { toEmail: email } : {})
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();
  res.json(
    mail.map((m) => ({
      id: String(m._id),
      toEmail: m.toEmail,
      subject: m.subject,
      body: m.body,
      actionUrl: m.actionUrl,
      createdAt: m.createdAt,
    })),
  );
}
