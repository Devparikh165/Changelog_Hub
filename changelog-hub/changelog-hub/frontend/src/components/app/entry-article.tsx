import { LinkIcon } from "lucide-react";
import { Link } from "react-router";
import { CategoryBadge } from "@/components/app/category-badge";
import { Markdown } from "@/components/app/markdown";
import { ReactionBar } from "@/components/app/reaction-bar";
import { Button } from "@/components/ui/button";
import { toastManager } from "@/components/ui/toast";
import { assetUrl } from "@/lib/api";
import { CATEGORY_META } from "@/lib/content";
import { dateParts, formatDate, timeAgo } from "@/lib/format";
import type { Entry } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  entry: Entry;
  /** Timeline items link their title; the detail page doesn't. */
  linkTitle?: boolean;
  /** The editor preview has no real id to react to. */
  preview?: boolean;
  headingLevel?: "h1" | "h2";
  /** "rail" = timeline with date column; "stacked" = single column (editor preview). */
  layout?: "rail" | "stacked";
}

/**
 * One release on the timeline: a sticky date rail on the left, a category-colored node on
 * the spine, and the release body on the right. On small screens the date moves above the title.
 */
export function EntryArticle({
  entry,
  linkTitle = true,
  preview = false,
  headingLevel = "h2",
  layout = "rail",
}: Props) {
  const rail = layout === "rail";
  const date = entry.publishedAt ?? entry.updatedAt;
  const parts = dateParts(date);
  const Heading = headingLevel;

  const copyLink = async () => {
    const url = `${window.location.origin}/updates/${entry.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toastManager.add({ title: "Link copied", type: "success" });
    } catch {
      toastManager.add({ title: "Couldn't copy the link", description: url, type: "error" });
    }
  };

  return (
    <article
      aria-labelledby={`title-${entry.id}`}
      className={cn("grid gap-x-10", rail && "md:grid-cols-[7.5rem_minmax(0,1fr)]")}
    >
      <div className={cn("max-md:hidden", !rail && "hidden")}>
        <time className="sticky top-24 block text-end" dateTime={date}>
          <span className="block font-heading font-semibold text-3xl leading-none tracking-tight">
            {parts.month} {parts.day}
          </span>
          <span className="mt-1.5 block text-muted-foreground text-sm tabular-nums">{parts.year}</span>
        </time>
      </div>

      <div className={cn("relative", rail && "pb-14 md:border-s md:ps-10")}>
        <span
          aria-hidden="true"
          className={cn(
            "-start-[7px] absolute top-2 hidden size-3.5 rounded-full ring-4 ring-background",
            rail && "md:block",
            CATEGORY_META[entry.category].dot,
          )}
        />
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <CategoryBadge category={entry.category} />
          <time className={cn("text-muted-foreground text-sm", rail && "md:hidden")} dateTime={date}>
            {formatDate(date)}
          </time>
          {rail && <span className="text-muted-foreground text-sm max-md:hidden">{timeAgo(date)}</span>}
        </div>

        <Heading
          className="text-balance font-heading font-semibold text-2xl tracking-tight sm:text-[1.75rem] sm:leading-tight"
          id={`title-${entry.id}`}
        >
          {linkTitle ? (
            <Link className="outline-none hover:underline hover:decoration-2 hover:underline-offset-4 focus-visible:underline" to={`/updates/${entry.slug}`}>
              {entry.title}
            </Link>
          ) : (
            entry.title
          )}
        </Heading>

        {entry.coverImage && (
          <img
            alt=""
            className="mt-5 aspect-[16/9] w-full rounded-xl border object-cover"
            decoding="async"
            loading="lazy"
            src={assetUrl(entry.coverImage)}
          />
        )}

        <Markdown className="mt-5 max-w-[68ch]">{entry.contentMarkdown || "_Nothing written yet._"}</Markdown>

        {!preview && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <ReactionBar entry={entry} />
            <Button aria-label="Copy link to this update" onClick={copyLink} size="sm" variant="ghost">
              <LinkIcon />
              Copy link
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

export function EntryArticleSkeletonRows({ rows = 2 }: { rows?: number }) {
  return (
    <div aria-busy="true" className="space-y-14">
      {Array.from({ length: rows }, (_, i) => (
        <div className="grid gap-x-10 md:grid-cols-[7.5rem_minmax(0,1fr)]" key={i}>
          <div className="max-md:hidden">
            <div className="ms-auto h-7 w-20 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="space-y-3 md:border-s md:ps-10">
            <div className="h-5 w-16 animate-pulse rounded-md bg-muted" />
            <div className="h-7 w-2/3 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
