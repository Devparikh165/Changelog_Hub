import { BellIcon, RssIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "@/auth/auth-context";
import { plainText } from "@/components/app/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { lastViewedFor, useLatestEntries, useMarkAllRead, useUnreadCount } from "@/features/changelog";
import { API_URL } from "@/lib/api";
import { CATEGORY_META, PRODUCT_NAME } from "@/lib/content";
import { timeAgo } from "@/lib/format";
import type { Entry } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  /** "header" = icon button in the nav; "floating" = round button pinned bottom-right. */
  placement?: "header" | "floating";
  /** Inside the iframe widget, links open the full site in a new tab. */
  embedded?: boolean;
}

export function WhatsNewDrawer({ placement = "header", embedded = false }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  // Snapshot of lastViewed *before* this opening, so new items stay highlighted while the drawer is open.
  const [seenBefore, setSeenBefore] = useState<string | null>(null);
  const unread = useUnreadCount();
  const latest = useLatestEntries(open);
  const markRead = useMarkAllRead();
  const count = unread.data?.unread ?? 0;

  const onOpenChange = (next: boolean) => {
    if (next) {
      setSeenBefore(lastViewedFor(user));
      markRead.mutate();
    }
    setOpen(next);
  };

  const label = count > 0 ? `What's new, ${count} unread` : "What's new";
  const badgeText = count > 9 ? "9+" : String(count);

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetTrigger
        aria-label={label}
        render={
          <Button
            className={cn(
              placement === "floating" &&
                "fixed end-5 bottom-5 z-40 rounded-full shadow-lg/10 sm:end-6 sm:bottom-6",
            )}
            size={placement === "floating" ? "icon-xl" : "icon"}
            variant={placement === "floating" ? "default" : "ghost"}
          />
        }
      >
        <BellIcon className={cn(count > 0 && "origin-top motion-safe:animate-[bell-nudge_1.2s_ease-in-out_1]")} />
        {count > 0 && (
          <Badge
            aria-hidden="true"
            className="-end-1 -top-1 pointer-events-none absolute rounded-full px-1 ring-2 ring-background"
            size="sm"
            variant="destructive"
          >
            {badgeText}
          </Badge>
        )}
      </SheetTrigger>

      <SheetPopup side="right" variant="inset">
        <SheetHeader>
          <SheetTitle>What's new</SheetTitle>
          <SheetDescription>The latest changes to {PRODUCT_NAME}.</SheetDescription>
        </SheetHeader>
        <SheetPanel className="p-0 in-[[data-slot=sheet-popup]:has([data-slot=sheet-header])]:pt-0">
          <DrawerList embedded={embedded} entries={latest.data?.items} loading={latest.isPending} seenBefore={seenBefore} />
        </SheetPanel>
        <SheetFooter className="sm:justify-between">
          <Button render={<a href={`${API_URL}/api/v1/changelog/feed`} rel="noopener" target="_blank" />} size="sm" variant="ghost">
            <RssIcon />
            JSON feed
          </Button>
          <Button
            onClick={() => setOpen(false)}
            render={embedded ? <a href="/" rel="noopener" target="_blank" /> : <Link to="/" />}
            size="sm"
            variant="outline"
          >
            See all updates
          </Button>
        </SheetFooter>
      </SheetPopup>
    </Sheet>
  );
}

export function DrawerList({
  entries,
  loading,
  seenBefore,
  embedded,
}: {
  entries: Entry[] | undefined;
  loading: boolean;
  seenBefore: string | null;
  embedded: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-5 px-6 py-2">
        {[0, 1, 2].map((i) => (
          <div className="space-y-2" key={i}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    );
  }
  if (!entries?.length) {
    return <p className="px-6 py-8 text-muted-foreground text-sm">No updates have been published yet.</p>;
  }
  return (
    <ol className="divide-y">
      {entries.map((entry) => {
        const isNew = !seenBefore || (entry.publishedAt !== null && entry.publishedAt > seenBefore);
        const meta = CATEGORY_META[entry.category];
        const href = `/updates/${entry.slug}`;
        return (
          <li className="relative" key={entry.id}>
            {isNew && <span aria-hidden="true" className="absolute inset-y-3 start-0 w-0.5 rounded-full bg-foreground" />}
            <Link
              className={cn(
                "block px-6 py-4 outline-none transition-colors hover:bg-accent focus-visible:bg-accent",
                isNew && "bg-muted/60",
              )}
              rel={embedded ? "noopener" : undefined}
              target={embedded ? "_blank" : undefined}
              to={href}
            >
              <div className="mb-1 flex items-center gap-2 text-xs">
                <span className={cn("size-2 rounded-full", meta.dot)} />
                <span className="font-medium text-foreground">{meta.label}</span>
                <span className="text-muted-foreground">{timeAgo(entry.publishedAt)}</span>
                {isNew && <span className="ms-auto font-medium text-foreground">Unread</span>}
              </div>
              <p className="font-medium font-heading text-base leading-snug">{entry.title}</p>
              <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">{plainText(entry.contentMarkdown)}</p>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
