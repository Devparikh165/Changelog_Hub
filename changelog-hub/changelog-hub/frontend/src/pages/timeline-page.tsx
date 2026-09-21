import { SearchXIcon, SparklesIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { EntryArticle, EntryArticleSkeletonRows } from "@/components/app/entry-article";
import { SearchField } from "@/components/app/search-field";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTimeline } from "@/features/changelog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { CATEGORIES, CATEGORY_META, PRODUCT_NAME, isCategory } from "@/lib/content";
import { cn } from "@/lib/utils";

export function TimelinePage() {
  const [params, setParams] = useSearchParams();
  const category = isCategory(params.get("category")) ? (params.get("category") as (typeof CATEGORIES)[number]) : null;

  // The input updates instantly; the query (and URL) follow 300 ms later.
  const [search, setSearch] = useState(params.get("q") ?? "");
  const q = useDebouncedValue(search.trim(), 300);

  const urlQ = params.get("q") ?? "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: only sync when the debounced value changes
  useEffect(() => {
    if (urlQ === q) return; // avoids a replace-navigation loop
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (q) next.set("q", q);
        else next.delete("q");
        return next;
      },
      { replace: true },
    );
  }, [q]);

  const setCategory = (value: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === "all") next.delete("category");
        else next.set("category", value);
        return next;
      },
      { replace: true },
    );
  };

  const timeline = useTimeline({ category, q });
  const entries = timeline.data?.pages.flatMap((p) => p.items) ?? [];
  const total = timeline.data?.pages[0]?.total ?? 0;
  const filtered = Boolean(category || q);

  // Infinite scroll, with the button as a keyboard-friendly fallback.
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = timeline;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const clearFilters = () => {
    setSearch("");
    setParams({}, { replace: true });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pt-12 pb-20 sm:px-6 sm:pt-16">
      <div className="md:ps-[calc(7.5rem+2.5rem)]">
        <h1 className="text-balance font-heading font-semibold text-4xl tracking-tight sm:text-5xl">
          What's new in {PRODUCT_NAME}
        </h1>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">
          Every feature we add, improvement we make, and bug we fix, newest first.
        </p>
      </div>

      <div className="sticky top-14 z-20 mt-10 mb-10 border-b bg-background/85 py-3 backdrop-blur-md md:ps-[calc(7.5rem+2.5rem)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ToggleGroup
            aria-label="Filter by category"
            className="flex-wrap"
            onValueChange={(v) => v[0] && setCategory(String(v[0]))}
            size="sm"
            value={[category ?? "all"]}
            variant="outline"
          >
            <ToggleGroupItem className="rounded-full px-3" value="all">
              All
            </ToggleGroupItem>
            {CATEGORIES.map((c) => (
              <ToggleGroupItem className="gap-1.5 rounded-full px-3" key={c} title={CATEGORY_META[c].description} value={c}>
                <span aria-hidden="true" className={cn("size-2 rounded-full", CATEGORY_META[c].dot)} />
                {CATEGORY_META[c].tag}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <SearchField
            className="sm:max-w-64"
            onChange={setSearch}
            pending={timeline.isFetching && !timeline.isFetchingNextPage && search.trim() !== ""}
            value={search}
          />
        </div>
        <p aria-live="polite" className="sr-only">
          {timeline.isSuccess ? `${total} ${total === 1 ? "update" : "updates"} found` : ""}
        </p>
      </div>

      {timeline.isPending ? (
        <EntryArticleSkeletonRows />
      ) : timeline.isError ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Updates didn't load</EmptyTitle>
            <EmptyDescription>{timeline.error.message}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => timeline.refetch()} size="sm" variant="outline">
              Try again
            </Button>
          </EmptyContent>
        </Empty>
      ) : entries.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">{filtered ? <SearchXIcon /> : <SparklesIcon />}</EmptyMedia>
            <EmptyTitle>{filtered ? "No updates match" : "Nothing published yet"}</EmptyTitle>
            <EmptyDescription>
              {filtered
                ? q
                  ? `Nothing mentions “${q}”${category ? ` in ${CATEGORY_META[category].tag}` : ""}. Try a different word.`
                  : "Try another category."
                : "Published releases will appear here."}
            </EmptyDescription>
          </EmptyHeader>
          {filtered && (
            <EmptyContent>
              <Button onClick={clearFilters} size="sm" variant="outline">
                Clear filters
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <>
          {filtered && (
            <p className="-mt-4 mb-8 text-muted-foreground text-sm md:ps-[calc(7.5rem+2.5rem)]">
              {total} {total === 1 ? "update" : "updates"}
              {q && <> matching “{q}”</>}
            </p>
          )}
          <ol className={cn("transition-opacity", timeline.isPlaceholderData && "opacity-60")}>
            {entries.map((entry) => (
              <li key={entry.id}>
                <EntryArticle entry={entry} />
              </li>
            ))}
          </ol>
          <div ref={sentinel} />
          {hasNextPage && (
            <div className="flex justify-center md:ps-[calc(7.5rem+2.5rem)]">
              <Button loading={isFetchingNextPage} onClick={() => fetchNextPage()} variant="outline">
                Load older updates
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
