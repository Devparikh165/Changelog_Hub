import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { AuthCard } from "@/pages/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

type State = { kind: "pending" } | { kind: "ok"; message: string } | { kind: "error"; message: string };

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>(
    token ? { kind: "pending" } : { kind: "error", message: "This link is missing its token." },
  );
  const started = useRef(false); // tokens are single-use; StrictMode would otherwise send it twice

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api<{ message: string }>("/api/v1/auth/verify-email", { method: "POST", body: { token } })
      .then((r) => setState({ kind: "ok", message: r.message }))
      .catch((e: Error) => setState({ kind: "error", message: e.message }));
  }, [token]);

  if (state.kind === "pending") {
    return (
      <AuthCard title="Confirming your email">
        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <Spinner className="size-4" /> One moment…
        </div>
      </AuthCard>
    );
  }

  const ok = state.kind === "ok";
  return (
    <AuthCard title={ok ? "Email confirmed" : "Link didn't work"}>
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-2.5 text-sm">
          {ok ? (
            <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
          ) : (
            <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          )}
          <span>
            {state.message}
            {!ok && " You can request a new link from the sign-in page."}
          </span>
        </p>
        <Button render={<Link to="/login" />}>{ok ? "Sign in" : "Go to sign in"}</Button>
      </div>
    </AuthCard>
  );
}
