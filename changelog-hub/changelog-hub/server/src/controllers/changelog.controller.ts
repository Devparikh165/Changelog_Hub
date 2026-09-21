import type { Request, Response } from "express";
import { parse } from "../middleware/validate.js";
import * as entries from "../services/entry.service.js";
import { feedQuery, reactionSchema, timelineQuery, unreadQuery } from "../validation/schemas.js";

/** Public reverse-chronological timeline, with category filter, keyword search and paging. */
export async function list(req: Request, res: Response) {
  res.json(await entries.listPublic(parse(timelineQuery, req.query, "query"), req.user));
}

/**
 * Read-only syndication feed in JSON Feed 1.1 format (https://jsonfeed.org/version/1.1).
 * Anonymous, cacheable and CORS-open so any site or integration can consume it.
 */
export async function feed(req: Request, res: Response) {
  const body = await entries.buildFeed(parse(feedQuery, req.query, "query"));
  res.set({ "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=60" });
  res.removeHeader("Access-Control-Allow-Credentials");
  res.json(body);
}

/**
 * Signed-in users are tracked server-side through lastViewedChangelogDate. Anonymous
 * embeds pass their own `since` (kept in the browser's localStorage).
 */
export async function unreadCount(req: Request, res: Response) {
  const { since } = parse(unreadQuery, req.query, "query");
  const reference = req.user ? req.user.lastViewedChangelogAt : (since ?? null);
  const { unread, latestPublishedAt } = await entries.countUnread(reference);
  res.json({ unread, lastViewedChangelogDate: reference, latestPublishedAt });
}

/** Opening the drawer calls this: everything published up to now becomes read. */
export async function markRead(req: Request, res: Response) {
  res.json(await entries.markAllRead(req.user!));
}

export async function getBySlug(req: Request, res: Response) {
  res.json(await entries.getPublicBySlug(String(req.params.slug), req.user));
}

export async function react(req: Request, res: Response) {
  const { reaction } = parse(reactionSchema, req.body, "body");
  res.json(await entries.toggleReaction(String(req.params.id), reaction, req.user!));
}
