import { EllipsisIcon, EyeIcon, FilePenIcon, PlusIcon, SendIcon, Trash2Icon, UndoIcon } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { CategoryBadge } from "@/components/app/category-badge";
import { DeleteEntryDialog } from "@/components/app/delete-entry-dialog";
import { SearchField } from "@/components/app/search-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import { toastManager } from "@/components/ui/toast";
import { entryState, useAdminEntries, useSetPublished } from "@/features/admin";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatDate, timeAgo } from "@/lib/format";
import type { Entry, EntryStatus } from "@/lib/types";

const STATE_BADGE = {
  draft: { label: "Draft", variant: "outline" },
  scheduled: { label: "Scheduled", variant: "info" },
  live: { label: "Live", variant: "success" },
} as const;

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<EntryStatus | null>(null);
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim(), 300);
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<Entry | null>(null);

  const list = useAdminEntries({ status, q, page });
  const setPublished = useSetPublished();
  const counts = list.data?.counts;

  const togglePublish = (entry: Entry) => {
    const publish = entry.status === "draft";
    setPublished.mutate(
      { id: entry.id, publish },
      {
        onSuccess: () => toastManager.add({ title: publish ? "Published" : "Moved to drafts", description: entry.title, type: "success" }),
        onError: (err) => toastManager.add({ title: "Couldn't update status", description: err.message, type: "error" }),
      },
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading font-semibold text-3xl tracking-tight">Publishing studio</h1>
          <p className="mt-1.5 text-muted-foreground">Write, schedule and publish product updates.</p>
        </div>
        <Button render={<Link to="/admin/new" />}>
          <PlusIcon />
          New update
        </Button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          onValueChange={(v) => {
            setStatus(v === "all" ? null : (v as EntryStatus));
            setPage(1);
          }}
          value={status ?? "all"}
        >
          <TabsList>
            <TabsTab value="all">All {counts && <Count n={counts.all} />}</TabsTab>
            <TabsTab value="draft">Drafts {counts && <Count n={counts.draft} />}</TabsTab>
            <TabsTab value="published">Published {counts && <Count n={counts.published} />}</TabsTab>
          </TabsList>
        </Tabs>
        <SearchField
          className="sm:max-w-64"
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search titles and content"
          value={search}
        />
      </div>

      {list.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton className="h-14 rounded-lg" key={i} />
          ))}
        </div>
      ) : list.isError ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Updates didn't load</EmptyTitle>
            <EmptyDescription>{list.error.message}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : list.data.items.length === 0 ? (
        <Empty className="rounded-xl border border-dashed">
          <EmptyHeader>
            <EmptyTitle>{q || status ? "No updates match" : "No updates yet"}</EmptyTitle>
            <EmptyDescription>
              {q || status ? "Try a different filter or search." : "Write your first release note to fill the timeline."}
            </EmptyDescription>
          </EmptyHeader>
          {!q && !status && (
            <EmptyContent>
              <Button render={<Link to="/admin/new" />} size="sm">
                <PlusIcon />
                New update
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <>
          <Table className={list.isPlaceholderData ? "opacity-60" : undefined} variant="card">
            <TableHeader>
              <TableRow>
                <TableHead>Update</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Published</TableHead>
                <TableHead className="text-end">Reactions</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.items.map((entry) => {
                const state = STATE_BADGE[entryState(entry)];
                const reactions = Object.values(entry.reactions).reduce((a, b) => a + b, 0);
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="max-w-72">
                      <Link className="block truncate font-medium hover:underline" to={`/admin/${entry.id}/edit`}>
                        {entry.title}
                      </Link>
                      <span className="block truncate font-mono text-muted-foreground text-xs">/{entry.slug}</span>
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={entry.category} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={state.variant}>{state.label}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {entry.publishedAt ? (
                        <span title={formatDate(entry.publishedAt)}>{formatDate(entry.publishedAt)}</span>
                      ) : (
                        <span>Edited {timeAgo(entry.updatedAt)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{reactions}</TableCell>
                    <TableCell>
                      <Menu>
                        <MenuTrigger render={<Button aria-label={`Actions for ${entry.title}`} size="icon-sm" variant="ghost" />}>
                          <EllipsisIcon />
                        </MenuTrigger>
                        <MenuPopup align="end">
                          <MenuItem onClick={() => navigate(`/admin/${entry.id}/edit`)}>
                            <FilePenIcon />
                            Edit
                          </MenuItem>
                          {entryState(entry) === "live" && (
                            <MenuItem onClick={() => navigate(`/updates/${entry.slug}`)}>
                              <EyeIcon />
                              View on timeline
                            </MenuItem>
                          )}
                          <MenuItem onClick={() => togglePublish(entry)}>
                            {entry.status === "draft" ? <SendIcon /> : <UndoIcon />}
                            {entry.status === "draft" ? "Publish now" : "Move to drafts"}
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem onClick={() => setToDelete(entry)} variant="destructive">
                            <Trash2Icon />
                            Delete
                          </MenuItem>
                        </MenuPopup>
                      </Menu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {(page > 1 || list.data.hasMore) && (
            <div className="mt-4 flex items-center justify-end gap-2">
              <span className="me-2 text-muted-foreground text-sm">Page {page}</span>
              <Button disabled={page === 1} onClick={() => setPage((p) => p - 1)} size="sm" variant="outline">
                Previous
              </Button>
              <Button disabled={!list.data.hasMore} onClick={() => setPage((p) => p + 1)} size="sm" variant="outline">
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <DeleteEntryDialog entry={toDelete} onOpenChange={(open) => !open && setToDelete(null)} />
    </div>
  );
}

function Count({ n }: { n: number }) {
  return <span className="text-muted-foreground tabular-nums">{n}</span>;
}
