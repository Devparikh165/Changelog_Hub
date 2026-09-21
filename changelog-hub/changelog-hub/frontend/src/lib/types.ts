export type Category = "new" | "improved" | "fixed";
export type EntryStatus = "draft" | "published";
export type ReactionKey = "heart" | "tada" | "rocket";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  isVerified: boolean;
  lastViewedChangelogDate: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  accessTokenExpiresAt: string;
}

export interface Entry {
  id: string;
  title: string;
  slug: string;
  contentMarkdown: string;
  category: Category;
  coverImage: string | null;
  status: EntryStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string } | null;
  reactions: Record<ReactionKey, number>;
  viewerReactions: ReactionKey[];
}

export interface EntryPage {
  items: Entry[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface AdminEntryPage extends EntryPage {
  counts: { all: number; draft: number; published: number };
}

export interface EntryInput {
  title: string;
  slug?: string | null;
  contentMarkdown: string;
  category: Category;
  coverImage: string | null;
  status: EntryStatus;
  publishedAt: string | null;
}

export interface UnreadState {
  unread: number;
  lastViewedChangelogDate: string | null;
  latestPublishedAt: string | null;
}

export interface ReactionResult {
  entryId: string;
  reactions: Record<ReactionKey, number>;
  viewerReactions: ReactionKey[];
}

export interface OutboxEmail {
  id: string;
  toEmail: string;
  subject: string;
  body: string;
  actionUrl: string | null;
  createdAt: string;
}
