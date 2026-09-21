import { useNavigate } from "react-router";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { toastManager } from "@/components/ui/toast";
import { useToggleReaction } from "@/features/changelog";
import { ApiError } from "@/lib/api";
import { REACTIONS } from "@/lib/content";
import type { Entry } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ReactionBar({ entry, className }: { entry: Entry; className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toggle = useToggleReaction();

  const onClick = (reaction: (typeof REACTIONS)[number]["key"]) => {
    if (!user) {
      toastManager.add({
        title: "Sign in to react",
        description: "Reactions are counted once per person.",
        type: "info",
        actionProps: { children: "Sign in", onClick: () => navigate("/login") },
      });
      return;
    }
    toggle.mutate(
      { entryId: entry.id, reaction },
      {
        onError: (err) =>
          toastManager.add({
            title: "Reaction not saved",
            description: err instanceof ApiError ? err.message : "Try again in a moment.",
            type: "error",
          }),
      },
    );
  };

  return (
    <div aria-label="Reactions" className={cn("flex flex-wrap items-center gap-1.5", className)} role="group">
      {REACTIONS.map(({ key, emoji, label }) => {
        const active = entry.viewerReactions.includes(key);
        const count = entry.reactions[key] ?? 0;
        return (
          <Button
            aria-label={`${label}: ${count}`}
            aria-pressed={active}
            className={cn(
              "rounded-full tabular-nums",
              active && "border-foreground/20 bg-accent dark:bg-input/64",
            )}
            key={key}
            onClick={() => onClick(key)}
            size="sm"
            title={label}
            variant="outline"
          >
            <span aria-hidden="true" className={cn("text-sm leading-none transition-transform", active && "scale-110")}>
              {emoji}
            </span>
            <span className={cn("min-w-3 text-xs", active ? "text-foreground" : "text-muted-foreground")}>{count}</span>
          </Button>
        );
      })}
    </div>
  );
}
