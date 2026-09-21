import { z } from "zod";
import { CATEGORIES, ENTRY_STATUSES, REACTION_KEYS } from "../config/constants.js";

/* ── Auth ──────────────────────────────────────────────────────────────── */

const email = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address" }).max(254));

const password = z
  .string({ error: "Password is required" })
  .min(8, { error: "Password must be at least 8 characters" })
  .refine((v) => Buffer.byteLength(v) <= 72, { error: "Password must be at most 72 bytes" })
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), {
    error: "Password must contain at least one letter and one number",
  });

export const signupSchema = z.object({
  name: z.string({ error: "Name is required" }).trim().min(1, { error: "Name is required" }).max(80),
  email,
  password,
});

export const loginSchema = z.object({
  email,
  password: z.string({ error: "Password is required" }).min(1, { error: "Password is required" }).max(128),
});

export const emailSchema = z.object({ email });
export const tokenSchema = z.object({ token: z.string({ error: "Token is required" }).min(10).max(200) });
export const resetPasswordSchema = z.object({ token: z.string().min(10).max(200), password });

/* ── Changelog ─────────────────────────────────────────────────────────── */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Accepts any ISO-8601 date-time (with Z or an offset); turns it into a Date. */
const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { error: "Enter a valid date and time" })
  .transform((v) => new Date(v));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

const title = z.string({ error: "Title is required" }).trim().min(1, { error: "Title is required" }).max(160);

const slug = optionalText(180).refine((v) => v === null || SLUG_RE.test(v), {
  error: "Slug may only contain lowercase letters, numbers and single hyphens",
});

const coverImage = optionalText(500).refine(
  (v) => v === null || v.startsWith("/uploads/") || v.startsWith("https://") || v.startsWith("http://"),
  { error: "Cover image must be an uploaded file or an http(s) URL" },
);

export const entryCreateSchema = z.object({
  title,
  slug: slug.optional(),
  contentMarkdown: z.string().max(100_000).default(""),
  category: z.enum(CATEGORIES).default("new"),
  coverImage: coverImage.optional(),
  status: z.enum(ENTRY_STATUSES).default("draft"),
  publishedAt: isoDate.nullish(),
});

/** PATCH: only the keys that are present change; `slug`, `coverImage` and `publishedAt` may be null. */
export const entryUpdateSchema = z.object({
  title: title.optional(),
  slug: slug.optional(),
  contentMarkdown: z.string().max(100_000).optional(),
  category: z.enum(CATEGORIES).optional(),
  coverImage: coverImage.optional(),
  status: z.enum(ENTRY_STATUSES).optional(),
  publishedAt: isoDate.nullish(),
});

const page = z.coerce.number().int().min(1).default(1);

export const timelineQuery = z.object({
  category: z.enum(CATEGORIES).optional(),
  q: z.string().trim().max(100).optional(),
  page,
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const adminListQuery = z.object({
  status: z.enum(ENTRY_STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
  q: z.string().trim().max(100).optional(),
  page,
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const feedQuery = z.object({
  category: z.enum(CATEGORIES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const unreadQuery = z.object({ since: isoDate.optional() });

export const reactionSchema = z.object({
  reaction: z.enum(REACTION_KEYS, { error: "Reaction must be one of heart, tada, rocket" }),
});

export const mailboxQuery = z.object({
  email: z.string().trim().toLowerCase().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
