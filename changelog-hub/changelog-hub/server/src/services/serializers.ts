import type { Types } from "mongoose";
import type { Category, EntryStatus, ReactionKey, Role } from "../config/constants.js";

/* Response shapes (camelCase). Internal fields (_id, __v, passwordHash, tokenVersion) never leave the server. */

type Id = Types.ObjectId | string;

export interface UserOut {
  id: string;
  email: string;
  name: string;
  role: Role;
  isVerified: boolean;
  lastViewedChangelogDate: Date | null;
  createdAt: Date;
}

export function toUserOut(user: {
  _id: Id;
  email: string;
  name: string;
  role: Role;
  isVerified: boolean;
  lastViewedChangelogAt?: Date | null;
  createdAt: Date;
}): UserOut {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    isVerified: user.isVerified,
    lastViewedChangelogDate: user.lastViewedChangelogAt ?? null,
    createdAt: user.createdAt,
  };
}

export interface EntryOut {
  id: string;
  title: string;
  slug: string;
  contentMarkdown: string;
  category: Category;
  coverImage: string | null;
  status: EntryStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string } | null;
  reactions: Record<ReactionKey, number>;
  viewerReactions: ReactionKey[];
}

export interface RawEntry {
  _id: Id;
  title: string;
  slug: string;
  contentMarkdown?: string | null;
  category: Category;
  coverImage?: string | null;
  status: EntryStatus;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author?: { _id: Id; name: string } | Id | null;
}

export function toEntryOut(
  entry: RawEntry,
  reactions: Record<ReactionKey, number>,
  viewerReactions: ReactionKey[],
): EntryOut {
  const author = entry.author && typeof entry.author === "object" && "name" in entry.author ? entry.author : null;
  return {
    id: String(entry._id),
    title: entry.title,
    slug: entry.slug,
    contentMarkdown: entry.contentMarkdown ?? "",
    category: entry.category,
    coverImage: entry.coverImage ?? null,
    status: entry.status,
    publishedAt: entry.publishedAt ?? null,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    author: author ? { id: String(author._id), name: author.name } : null,
    reactions,
    viewerReactions,
  };
}
