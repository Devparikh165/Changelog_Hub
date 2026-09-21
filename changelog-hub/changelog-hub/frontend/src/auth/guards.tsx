import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "@/auth/auth-context";
import { Spinner } from "@/components/ui/spinner";

function FullPageSpinner() {
  return (
    <div className="grid min-h-[60vh] place-items-center" aria-busy="true">
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  );
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <FullPageSpinner />;
  if (!user) return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  if (user.role !== "admin") return <Navigate replace to="/" />;
  return children;
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  if (status === "loading") return <FullPageSpinner />;
  if (user) return <Navigate replace to={user.role === "admin" ? "/admin" : "/"} />;
  return children;
}
