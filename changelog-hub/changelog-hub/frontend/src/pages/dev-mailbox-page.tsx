import { useQuery } from "@tanstack/react-query";
import { InboxIcon, RefreshCwIcon } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardPanel } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { OutboxEmail } from "@/lib/types";

/** Turns the absolute link from the email into an in-app route when it points at this site. */
function toAppPath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

export function DevMailboxPage() {
  const [params, setParams] = useSearchParams();
  const email = params.get("email") ?? "";
  const mail = useQuery({
    queryKey: ["dev-mailbox", email],
    queryFn: ({ signal }) => api<OutboxEmail[]>("/api/v1/dev/mailbox", { query: { email, limit: 30 }, signal }),
    refetchInterval: 5_000,
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading font-semibold text-3xl tracking-tight">Dev inbox</h1>
          <p className="mt-2 text-muted-foreground">
            Emails are simulated in development. Verification and reset messages land here instead of a real inbox.
          </p>
        </div>
        <Button loading={mail.isFetching && !mail.isPending} onClick={() => mail.refetch()} size="sm" variant="outline">
          <RefreshCwIcon />
          Refresh
        </Button>
      </div>

      {email && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Showing mail for</span>
          <Badge variant="secondary">{email}</Badge>
          <Button onClick={() => setParams({})} size="xs" variant="link">
            Show all
          </Button>
        </div>
      )}

      {mail.isPending ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton className="h-28 rounded-xl" key={i} />
          ))}
        </div>
      ) : mail.isError ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Inbox unavailable</EmptyTitle>
            <EmptyDescription>
              {mail.error.message}. The dev inbox is off when ENVIRONMENT=production or EMAIL_SIMULATION=false.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : mail.data.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InboxIcon />
            </EmptyMedia>
            <EmptyTitle>No emails yet</EmptyTitle>
            <EmptyDescription>
              <Link className="underline underline-offset-4" to="/signup">
                Create an account
              </Link>{" "}
              or request a password reset and the message will show up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="space-y-3">
          {mail.data.map((m) => (
            <li key={m.id}>
              <Card>
                <CardPanel className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{m.subject}</p>
                    <time className="text-muted-foreground text-xs" dateTime={m.createdAt}>
                      {timeAgo(m.createdAt)}
                    </time>
                  </div>
                  <p className="text-muted-foreground text-xs">To {m.toEmail}</p>
                  <p className="whitespace-pre-line text-sm">{m.body}</p>
                  {m.actionUrl && (
                    <Button className="mt-1" render={<Link to={toAppPath(m.actionUrl)} />} size="sm">
                      {m.subject.startsWith("Reset") ? "Reset password" : "Confirm email"}
                    </Button>
                  )}
                </CardPanel>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
