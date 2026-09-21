import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "@/auth/auth-context";
import { api } from "@/lib/api";
import type { Category, Entry, EntryPage, ReactionKey, ReactionResult, UnreadState } from "@/lib/types";

const PAGE_SIZE = 8;
const ANON_LAST_VIEWED_KEY = "changelog:lastViewedAt";

export const changelogKeys = {
  all: ["changelog"] as const,
  list: (filters: { category: Category | null; q: string }) => ["changelog", "list", filters] as const,
  latest: () => ["changelog", "latest"] as const,
  entry: (slug: string) => ["changelog", "entry", slug] as const,
  unread: (who: string) => ["unread", who] as const,
};

// ------------------------------------------------------------------ timeline
export function useTimeline(filters: { category: Category | null; q: string }) {
  return useInfiniteQuery({
    queryKey: changelogKeys.list(filters),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      api<EntryPage>("/api/v1/changelog", {
        query: { page: pageParam, pageSize: PAGE_SIZE, category: filters.category, q: filters.q },
        signal,
      }),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: (prev) => prev, // keep results on screen while a new search loads
  });
}

export function useLatestEntries(enabled: boolean) {
  return useQuery({
    queryKey: changelogKeys.latest(),
    queryFn: ({ signal }) => api<EntryPage>("/api/v1/changelog", { query: { pageSize: 15 }, signal }),
    enabled,
  });
}

export function useEntry(slug: string) {
  return useQuery({
    queryKey: changelogKeys.entry(slug),
    queryFn: ({ signal }) => api<Entry>(`/api/v1/changelog/${encodeURIComponent(slug)}`, { signal }),
    retry: (count, err) => (err as { status?: number }).status !== 404 && count < 2,
  });
}

// ------------------------------------------------------------------ reactions
type Cached = Entry | EntryPage | InfiniteData<EntryPage> | undefined;

function patchEntry(data: Cached, entryId: string, patch: (e: Entry) => Entry): Cached {
  if (!data) return data;
  if ("pages" in data) {
    return { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.map((e) => (e.id === entryId ? patch(e) : e)) })) };
  }
  if ("items" in data) {
    return { ...data, items: data.items.map((e) => (e.id === entryId ? patch(e) : e)) };
  }
  return data.id === entryId ? patch(data) : data;
}

function patchEverywhere(qc: QueryClient, entryId: string, patch: (e: Entry) => Entry) {
  qc.setQueriesData<Cached>({ queryKey: changelogKeys.all }, (old) => patchEntry(old, entryId, patch));
}

export function useToggleReaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, reaction }: { entryId: string; reaction: ReactionKey }) =>
      api<ReactionResult>(`/api/v1/changelog/${entryId}/reactions`, { method: "POST", body: { reaction } }),
    // Optimistic: flip the reaction immediately, reconcile with the server's counts after.
    onMutate: async ({ entryId, reaction }) => {
      await qc.cancelQueries({ queryKey: changelogKeys.all });
      const snapshot = qc.getQueriesData<Cached>({ queryKey: changelogKeys.all });
      patchEverywhere(qc, entryId, (e) => {
        const had = e.viewerReactions.includes(reaction);
        return {
          ...e,
          reactions: { ...e.reactions, [reaction]: Math.max(0, (e.reactions[reaction] ?? 0) + (had ? -1 : 1)) },
          viewerReactions: had ? e.viewerReactions.filter((r) => r !== reaction) : [...e.viewerReactions, reaction],
        };
      });
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSuccess: (res) => {
      patchEverywhere(qc, res.entryId, (e) => ({ ...e, reactions: res.reactions, viewerReactions: res.viewerReactions }));
    },
  });
}

// ------------------------------------------------------------------ unread tracker
function readAnonLastViewed(): string | null {
  try {
    return localStorage.getItem(ANON_LAST_VIEWED_KEY);
  } catch {
    return null;
  }
}

export function useUnreadCount() {
  const { user, status } = useAuth();
  const who = user?.id ?? "anon";
  return useQuery({
    queryKey: changelogKeys.unread(who),
    queryFn: ({ signal }) =>
      api<UnreadState>("/api/v1/changelog/unread-count", {
        query: user ? undefined : { since: readAnonLastViewed() },
        signal,
      }),
    enabled: status !== "loading",
    refetchInterval: 60_000, // "live" badge: new releases appear within a minute
    refetchOnWindowFocus: true,
  });
}

/**
 * Opening the drawer marks everything read. Returns the *previous* last-viewed date so
 * the drawer can still highlight which items were new for this visit.
 */
export function useMarkAllRead() {
  const qc = useQueryClient();
  const { user, setUser } = useAuth();
  const who = user?.id ?? "anon";

  return useMutation({
    mutationFn: async (): Promise<UnreadState> => {
      if (!user) {
        const now = new Date().toISOString();
        try {
          localStorage.setItem(ANON_LAST_VIEWED_KEY, now);
        } catch {
          /* private mode: the badge will simply reappear next visit */
        }
        return { unread: 0, lastViewedChangelogDate: now, latestPublishedAt: null };
      }
      return api<UnreadState>("/api/v1/changelog/mark-read", { method: "POST" });
    },
    onMutate: () => {
      const previous = qc.getQueryData<UnreadState>(changelogKeys.unread(who));
      qc.setQueryData<UnreadState>(changelogKeys.unread(who), (old) =>
        old ? { ...old, unread: 0 } : { unread: 0, lastViewedChangelogDate: null, latestPublishedAt: null },
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(changelogKeys.unread(who), ctx.previous);
    },
    onSuccess: (res) => {
      qc.setQueryData<UnreadState>(changelogKeys.unread(who), (old) => ({ ...res, latestPublishedAt: old?.latestPublishedAt ?? res.latestPublishedAt }));
      if (user) setUser((u) => ({ ...u, lastViewedChangelogDate: res.lastViewedChangelogDate }));
    },
  });
}

export function lastViewedFor(user: { lastViewedChangelogDate: string | null } | null): string | null {
  return user ? user.lastViewedChangelogDate : readAnonLastViewed();
}
