import { XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/auth/auth-context";
import { DrawerList } from "@/components/app/whats-new-drawer";
import { Button } from "@/components/ui/button";
import { lastViewedFor, useLatestEntries, useMarkAllRead, useUnreadCount } from "@/features/changelog";
import { PRODUCT_NAME } from "@/lib/content";

/**
 * Runs inside the iframe that public/widget.js injects on third-party sites.
 * Talks to the host page with postMessage:
 *   iframe → host  { type: "changelog:unread", count }   { type: "changelog:close" }
 *   host → iframe  { type: "changelog:open" }
 */
export function EmbedPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [seenBefore, setSeenBefore] = useState<string | null>(null);
  const unread = useUnreadCount();
  const latest = useLatestEntries(open);
  const markRead = useMarkAllRead();
  const { mutate: markAllRead } = markRead;

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
  }, []);

  useEffect(() => {
    if (unread.data) window.parent.postMessage({ type: "changelog:unread", count: unread.data.unread }, "*");
  }, [unread.data]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window.parent || e.data?.type !== "changelog:open") return;
      setSeenBefore(lastViewedFor(user));
      setOpen(true);
      markAllRead();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [user, markAllRead]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        window.parent.postMessage({ type: "changelog:close" }, "*");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    window.parent.postMessage({ type: "changelog:close" }, "*");
  };

  if (!open) return null;
  return (
    <div aria-label="What's new" className="flex h-dvh flex-col bg-popover text-popover-foreground" role="dialog">
      <div className="flex items-start justify-between gap-4 border-b px-6 py-5">
        <div>
          <h1 className="font-heading font-semibold text-xl">What's new</h1>
          <p className="mt-1 text-muted-foreground text-sm">The latest changes to {PRODUCT_NAME}.</p>
        </div>
        <Button aria-label="Close" autoFocus onClick={close} size="icon" variant="ghost">
          <XIcon />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DrawerList embedded entries={latest.data?.items} loading={latest.isPending} seenBefore={seenBefore} />
      </div>
      <div className="border-t bg-muted/72 px-6 py-3">
        <Button className="w-full" render={<a href="/" rel="noopener" target="_blank" />} size="sm" variant="outline">
          See all updates
        </Button>
      </div>
    </div>
  );
}
