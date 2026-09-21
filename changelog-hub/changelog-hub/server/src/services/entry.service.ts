import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isValidObjectId, type PipelineStage, Types } from "mongoose";
import {
  CATEGORY_TAGS,
  type Category,
  type EntryStatus,
  type ReactionKey,
} from "../config/constants.js";
import { env } from "../config/env.js";
import { apiError, notFound } from "../lib/http-error.js";
import { absoluteUrl, escapeRegex, plainSummary, renderMarkdownHtml, slugify } from "../lib/text.js";
import { sniffImage } from "../middleware/upload.js";
import { Entry, Reaction } from "../models/entry.model.js";
import { User } from "../models/user.model.js";
import type { AuthUser } from "../types/express.js";
import { type EntryOut, type RawEntry, toEntryOut } from "./serializers.js";

/* ── Visibility & search ───────────────────────────────────────────────── */

/** Published AND its publish time has arrived. A future `publishedAt` works as scheduling. */
export const visibleFilter = () => ({ status: "published" as const, publishedAt: { $ne: null, $lte: new Date() } });

/** Every whitespace-separated term (max 8) must appear in the title or the body, case-insensitively. */
function searchFilter(q: string | undefined): Record<string, unknown> {
  const terms = q?.trim().split(/\s+/).filter(Boolean).slice(0, 8) ?? [];
  if (!terms.length) return {};
  return {
    $and: terms.map((term) => {
      const pattern = new RegExp(escapeRegex(term), "i");
      return { $or: [{ title: pattern }, { contentMarkdown: pattern }] };
    }),
  };
}

const toObjectId = (id: string) => (isValidObjectId(id) && /^[a-f\d]{24}$/i.test(id) ? new Types.ObjectId(id) : null);

/* ── Reactions ─────────────────────────────────────────────────────────── */

const emptyCounts = (): Record<ReactionKey, number> => ({ heart: 0, tada: 0, rocket: 0 });

async function reactionSummary(entryIds: Types.ObjectId[], viewer?: AuthUser) {
  const counts = new Map<string, Record<ReactionKey, number>>();
  const mine = new Map<string, ReactionKey[]>();
  if (!entryIds.length) return { counts, mine };

  const [rows, own] = await Promise.all([
    Reaction.aggregate<{ _id: { entry: Types.ObjectId; emoji: ReactionKey }; n: number }>([
      { $match: { entry: { $in: entryIds } } },
      { $group: { _id: { entry: "$entry", emoji: "$emoji" }, n: { $sum: 1 } } },
    ]),
    viewer ? Reaction.find({ entry: { $in: entryIds }, user: viewer._id }).select("entry emoji").lean() : [],
  ]);
  for (const row of rows) {
    const key = String(row._id.entry);
    const c = counts.get(key) ?? emptyCounts();
    c[row._id.emoji] = row.n;
    counts.set(key, c);
  }
  for (const r of own) {
    const key = String(r.entry);
    mine.set(key, [...(mine.get(key) ?? []), r.emoji as ReactionKey].sort());
  }
  return { counts, mine };
}

async function serialize(entries: RawEntry[], viewer?: AuthUser): Promise<EntryOut[]> {
  const ids = entries.map((e) => new Types.ObjectId(String(e._id)));
  const { counts, mine } = await reactionSummary(ids, viewer);
  return entries.map((e) =>
    toEntryOut(e, counts.get(String(e._id)) ?? emptyCounts(), mine.get(String(e._id)) ?? []),
  );
}

export interface EntryPage {
  items: EntryOut[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/* ── Public timeline ───────────────────────────────────────────────────── */

export async function listPublic(
  query: { category?: Category; q?: string; page: number; pageSize: number },
  viewer?: AuthUser,
): Promise<EntryPage> {
  const filter = { ...visibleFilter(), ...(query.category && { category: query.category }), ...searchFilter(query.q) };
  const [rows, total] = await Promise.all([
    Entry.find(filter)
      .sort({ publishedAt: -1, _id: 1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .populate("author", "name")
      .lean(),
    Entry.countDocuments(filter),
  ]);
  return {
    items: await serialize(rows as unknown as RawEntry[], viewer),
    total,
    page: query.page,
    pageSize: query.pageSize,
    hasMore: query.page * query.pageSize < total,
  };
}

export async function getPublicBySlug(slug: string, viewer?: AuthUser): Promise<EntryOut> {
  const entry = await Entry.findOne({ slug, ...visibleFilter() }).populate("author", "name").lean();
  if (!entry) throw notFound();
  return (await serialize([entry as unknown as RawEntry], viewer))[0]!;
}

/**
 * Toggle: the first call adds the viewer's reaction, the second removes it. A unique
 * (entry, user, emoji) index guarantees one reaction of each kind per person, even when
 * two rapid clicks race each other.
 */
export async function toggleReaction(entryId: string, emoji: ReactionKey, viewer: AuthUser) {
  const id = toObjectId(entryId);
  if (!id || !(await Entry.exists({ _id: id, ...visibleFilter() }))) throw notFound();

  const removed = await Reaction.deleteOne({ entry: id, user: viewer._id, emoji });
  if (removed.deletedCount === 0) {
    try {
      await Reaction.create({ entry: id, user: viewer._id, emoji });
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err; // lost a race: it's already there
    }
  }
  const { counts, mine } = await reactionSummary([id], viewer);
  return {
    entryId: String(id),
    reactions: counts.get(String(id)) ?? emptyCounts(),
    viewerReactions: mine.get(String(id)) ?? [],
  };
}

/* ── Unread algorithm ──────────────────────────────────────────────────── */

/**
 * unread = visible entries whose publishedAt is strictly after `since`.
 * Someone who has never opened the drawer (since = null) sees every release as unread.
 */
export async function countUnread(since: Date | null) {
  const visible = visibleFilter();
  const [unread, latest] = await Promise.all([
    Entry.countDocuments(since ? { ...visible, publishedAt: { ...visible.publishedAt, $gt: since } } : visible),
    Entry.findOne(visible).sort({ publishedAt: -1 }).select("publishedAt").lean(),
  ]);
  return { unread, latestPublishedAt: latest?.publishedAt ?? null };
}

export async function markAllRead(viewer: AuthUser) {
  const now = new Date();
  await User.updateOne({ _id: viewer._id }, { $set: { lastViewedChangelogAt: now } });
  const { latestPublishedAt } = await countUnread(now);
  return { unread: 0, lastViewedChangelogDate: now, latestPublishedAt };
}

/* ── JSON Feed 1.1 ─────────────────────────────────────────────────────── */

export async function buildFeed(query: { category?: Category; limit: number }) {
  const rows = await Entry.find({ ...visibleFilter(), ...(query.category && { category: query.category }) })
    .sort({ publishedAt: -1 })
    .limit(query.limit)
    .lean();
  const { counts } = await reactionSummary(rows.map((e) => e._id));
  return {
    version: "https://jsonfeed.org/version/1.1",
    title: `${env.APP_NAME} — Product updates`,
    home_page_url: `${env.FRONTEND_URL}/`,
    feed_url: `${env.PUBLIC_API_URL}/api/v1/changelog/feed`,
    description: "New features, improvements and fixes.",
    items: rows.map((e) => ({
      id: String(e._id),
      url: `${env.FRONTEND_URL}/updates/${e.slug}`,
      title: e.title,
      content_html: renderMarkdownHtml(e.contentMarkdown ?? ""),
      content_text: e.contentMarkdown ?? "",
      summary: plainSummary(e.contentMarkdown ?? ""),
      image: absoluteUrl(e.coverImage),
      date_published: e.publishedAt?.toISOString() ?? null,
      date_modified: e.updatedAt.toISOString(),
      tags: [CATEGORY_TAGS[e.category]],
      _changelog: { slug: e.slug, category: e.category, reactions: counts.get(String(e._id)) ?? emptyCounts() },
    })),
  };
}

/* ── Admin studio ──────────────────────────────────────────────────────── */

async function uniqueSlug(base: string, excludeId?: Types.ObjectId): Promise<string> {
  let candidate = base;
  for (let n = 2; await Entry.exists({ slug: candidate, ...(excludeId && { _id: { $ne: excludeId } }) }); n++) {
    candidate = `${base}-${n}`;
  }
  return candidate;
}

async function assertSlugFree(slug: string, excludeId?: Types.ObjectId): Promise<void> {
  if (await Entry.exists({ slug, ...(excludeId && { _id: { $ne: excludeId } }) })) {
    throw apiError(409, "slug_taken", "Another update already uses this slug");
  }
}

async function loadEntry(id: string) {
  const oid = toObjectId(id);
  const entry = oid ? await Entry.findById(oid) : null;
  if (!entry) throw notFound();
  return entry;
}

async function adminOut(id: Types.ObjectId, admin: AuthUser): Promise<EntryOut> {
  const entry = await Entry.findById(id).populate("author", "name").lean();
  if (!entry) throw notFound();
  return (await serialize([entry as unknown as RawEntry], admin))[0]!;
}

export async function listAll(
  query: { status?: EntryStatus; category?: Category; q?: string; page: number; pageSize: number },
  admin: AuthUser,
) {
  const match = {
    ...(query.status && { status: query.status }),
    ...(query.category && { category: query.category }),
    ...searchFilter(query.q),
  };
  // Drafts first (most recently edited), then published, newest first.
  const stages: PipelineStage[] = [
    { $match: match },
    {
      $addFields: {
        _isPublished: { $eq: ["$status", "published"] },
        _sortDate: { $ifNull: ["$publishedAt", "$updatedAt"] },
      },
    },
    { $sort: { _isPublished: 1, _sortDate: -1, _id: 1 } },
    {
      $facet: {
        items: [
          { $skip: (query.page - 1) * query.pageSize },
          { $limit: query.pageSize },
          {
            $lookup: {
              from: User.collection.name,
              localField: "author",
              foreignField: "_id",
              as: "author",
              pipeline: [{ $project: { name: 1 } }],
            },
          },
          { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
        ],
        total: [{ $count: "n" }],
      },
    },
  ];
  const [[result], byStatus] = await Promise.all([
    Entry.aggregate<{ items: RawEntry[]; total: { n: number }[] }>(stages),
    Entry.aggregate<{ _id: EntryStatus; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const total = result?.total[0]?.n ?? 0;
  const counts = { all: 0, draft: 0, published: 0 };
  for (const row of byStatus) {
    counts[row._id] = row.n;
    counts.all += row.n;
  }
  return {
    items: await serialize(result?.items ?? [], admin),
    total,
    page: query.page,
    pageSize: query.pageSize,
    hasMore: query.page * query.pageSize < total,
    counts,
  };
}

export interface EntryInput {
  title?: string;
  slug?: string | null;
  contentMarkdown?: string;
  category?: Category;
  coverImage?: string | null;
  status?: EntryStatus;
  publishedAt?: Date | null;
}

/** Publishing without a date means "now". A future date schedules the release. */
function applyPublishRules(entry: { status: string; publishedAt?: Date | null }) {
  if (entry.status === "published" && !entry.publishedAt) entry.publishedAt = new Date();
}

export async function createEntry(input: Required<Pick<EntryInput, "title">> & EntryInput, admin: AuthUser) {
  let slug: string;
  if (input.slug) {
    await assertSlugFree(input.slug);
    slug = input.slug;
  } else {
    slug = await uniqueSlug(slugify(input.title));
  }
  const doc = {
    title: input.title,
    slug,
    contentMarkdown: input.contentMarkdown ?? "",
    category: input.category ?? "new",
    coverImage: input.coverImage ?? null,
    status: input.status ?? "draft",
    publishedAt: input.publishedAt ?? null,
    author: admin._id,
  };
  applyPublishRules(doc);
  const entry = await Entry.create(doc);
  return adminOut(entry._id, admin);
}

export async function getEntry(id: string, admin: AuthUser) {
  return adminOut((await loadEntry(id))._id, admin);
}

export async function updateEntry(id: string, changes: EntryInput, admin: AuthUser) {
  const entry = await loadEntry(id);

  if ("slug" in changes) {
    if (changes.slug) {
      await assertSlugFree(changes.slug, entry._id);
      entry.slug = changes.slug;
    } else {
      // An explicit null/empty slug means "regenerate it from the title".
      entry.slug = await uniqueSlug(slugify(changes.title ?? entry.title), entry._id);
    }
  }
  if (changes.title !== undefined) entry.title = changes.title;
  if (changes.contentMarkdown !== undefined) entry.contentMarkdown = changes.contentMarkdown;
  if (changes.category !== undefined) entry.category = changes.category;
  if (changes.status !== undefined) entry.status = changes.status;
  // These two can be cleared explicitly with null.
  if ("coverImage" in changes) entry.coverImage = changes.coverImage ?? null;
  if ("publishedAt" in changes) entry.publishedAt = changes.publishedAt ?? null;

  applyPublishRules(entry);
  await entry.save();
  return adminOut(entry._id, admin);
}

export async function setPublished(id: string, publish: boolean, admin: AuthUser) {
  const entry = await loadEntry(id);
  entry.status = publish ? "published" : "draft";
  applyPublishRules(entry);
  await entry.save();
  return adminOut(entry._id, admin);
}

export async function deleteEntry(id: string) {
  const entry = await loadEntry(id);
  await Promise.all([entry.deleteOne(), Reaction.deleteMany({ entry: entry._id })]);
}

/** Saves an uploaded image after checking its real type from the file's bytes. */
export async function saveUpload(file: Express.Multer.File | undefined) {
  if (!file) throw apiError(422, "file_required", "Attach an image in the 'file' field");
  const sniffed = sniffImage(file.buffer);
  if (!sniffed) throw apiError(415, "unsupported_media_type", "Upload a PNG, JPEG, GIF or WebP image");
  const name = `${randomUUID().replace(/-/g, "")}${sniffed.ext}`;
  const dir = path.resolve(env.UPLOAD_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), file.buffer);
  return { url: `/uploads/${name}`, size: file.size, contentType: sniffed.mime };
}

