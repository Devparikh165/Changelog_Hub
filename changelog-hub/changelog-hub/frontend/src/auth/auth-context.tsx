import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AUTH_EVENTS, ApiError, api, refreshSession } from "@/lib/api";
import type { AuthResponse, User } from "@/lib/types";

type Status = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  user: User | null;
  status: Status;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (updater: (u: User) => User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Rotate one minute before the 15-minute access token expires, so users rarely hit a 401 at all.
const REFRESH_LEAD_MS = 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const timer = useRef<number | undefined>(undefined);

  const schedule = useCallback((expiresAt: string | null) => {
    window.clearTimeout(timer.current);
    if (!expiresAt) return;
    const wait = Math.max(new Date(expiresAt).getTime() - Date.now() - REFRESH_LEAD_MS, 5_000);
    timer.current = window.setTimeout(() => void refreshSession(), wait);
  }, []);

  const applySession = useCallback(
    (data: AuthResponse) => {
      setUserState(data.user);
      setStatus("authenticated");
      schedule(data.accessTokenExpiresAt);
    },
    [schedule],
  );

  const clearSession = useCallback(() => {
    window.clearTimeout(timer.current);
    setUserState(null);
    setStatus("anonymous");
    // Per-user data (reactions, unread count) must not leak into the anonymous view.
    queryClient.invalidateQueries();
  }, [queryClient]);

  // Bootstrap: try the access cookie, fall back to a refresh.
  useEffect(() => {
    let cancelled = false;
    if (!document.cookie.split("; ").some((c) => c.startsWith("session_hint="))) {
      setStatus("anonymous");
      return;
    }
    (async () => {
      try {
        const me = await api<User>("/api/v1/auth/me");
        if (cancelled) return;
        setUserState(me);
        setStatus("authenticated");
        // The current cookie's expiry isn't readable (httpOnly). Rotate soon; any 401 before then
        // is handled reactively by the API client.
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void refreshSession(), 4 * 60_000);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          const ok = await refreshSession(); // success is applied through the event listener
          if (!ok && !cancelled) setStatus("anonymous");
        } else {
          setStatus("anonymous");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onRefreshed = (e: Event) => applySession((e as CustomEvent<AuthResponse>).detail);
    const onEnded = () => clearSession();
    window.addEventListener(AUTH_EVENTS.refreshed, onRefreshed);
    window.addEventListener(AUTH_EVENTS.ended, onEnded);
    return () => {
      window.removeEventListener(AUTH_EVENTS.refreshed, onRefreshed);
      window.removeEventListener(AUTH_EVENTS.ended, onEnded);
      window.clearTimeout(timer.current);
    };
  }, [applySession, clearSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api<AuthResponse>("/api/v1/auth/login", { method: "POST", body: { email, password } });
      applySession(data);
      await queryClient.invalidateQueries();
      return data.user;
    },
    [applySession, queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await api("/api/v1/auth/logout", { method: "POST" });
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const setUser = useCallback((updater: (u: User) => User) => {
    setUserState((u) => (u ? updater(u) : u));
  }, []);

  const value = useMemo(
    () => ({ user, status, login, logout, setUser }),
    [user, status, login, logout, setUser],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
