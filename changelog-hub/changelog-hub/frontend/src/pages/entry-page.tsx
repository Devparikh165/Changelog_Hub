import { ArrowLeftIcon } from "lucide-react";
import { useEffect } from "react";
import { Link, useParams } from "react-router";
import { EntryArticle, EntryArticleSkeletonRows } from "@/components/app/entry-article";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useEntry } from "@/features/changelog";
import { PRODUCT_NAME } from "@/lib/content";

export function EntryPage() {
  const { slug = "" } = useParams();
  const entry = useEntry(slug);

  useEffect(() => {
    if (entry.data) document.title = `${entry.data.title} · ${PRODUCT_NAME} updates`;
    return () => {
      document.title = "What's new";
    };
  }, [entry.data]);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 pb-16 sm:px-6">
      <div className="mb-10 md:ps-[calc(7.5rem+2.5rem)]">
        <Button render={<Link to="/" />} size="sm" variant="ghost">
          <ArrowLeftIcon />
          All updates
        </Button>
      </div>
      {entry.isPending ? (
        <EntryArticleSkeletonRows rows={1} />
      ) : entry.isError ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{(entry.error as { status?: number }).status === 404 ? "Update not found" : "Update didn't load"}</EmptyTitle>
            <EmptyDescription>It may have been unpublished, or the link is mistyped.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button render={<Link to="/" />} size="sm" variant="outline">
              Browse all updates
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <EntryArticle entry={entry.data} headingLevel="h1" linkTitle={false} />
      )}
    </div>
  );
}
