import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createBrowserRouter } from "react-router";
import { AuthProvider } from "@/auth/auth-context";
import { GuestOnly, RequireAdmin } from "@/auth/guards";
import { RootLayout } from "@/components/app/root-layout";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api";
import { ForgotPasswordPage } from "@/pages/auth/forgot-password-page";
import { LoginPage } from "@/pages/auth/login-page";
import { ResetPasswordPage } from "@/pages/auth/reset-password-page";
import { SignupPage } from "@/pages/auth/signup-page";
import { VerifyEmailPage } from "@/pages/auth/verify-email-page";
import { DevMailboxPage } from "@/pages/dev-mailbox-page";
import { EmbedPage } from "@/pages/embed-page";
import { EntryPage } from "@/pages/entry-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { TimelinePage } from "@/pages/timeline-page";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Client errors (4xx) won't fix themselves; only retry network/server failures.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

function Providers() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <ToastProvider>
            <Outlet />
          </ToastProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export const router = createBrowserRouter([
  {
    element: <Providers />,
    children: [
      { path: "embed", element: <EmbedPage /> },
      {
        element: <RootLayout />,
        children: [
          { index: true, element: <TimelinePage /> },
          { path: "updates/:slug", element: <EntryPage /> },
          { path: "login", element: <GuestOnly><LoginPage /></GuestOnly> },
          { path: "signup", element: <GuestOnly><SignupPage /></GuestOnly> },
          { path: "forgot-password", element: <GuestOnly><ForgotPasswordPage /></GuestOnly> },
          { path: "verify-email", element: <VerifyEmailPage /> },
          { path: "reset-password", element: <ResetPasswordPage /> },
          { path: "dev/mailbox", element: <DevMailboxPage /> },
          {
            path: "admin",
            element: (
              <RequireAdmin>
                <Outlet />
              </RequireAdmin>
            ),
            children: [
              // The studio is split into its own chunk; timeline visitors never download it.
              {
                index: true,
                lazy: async () => ({ Component: (await import("@/pages/admin/admin-dashboard-page")).AdminDashboardPage }),
              },
              {
                path: "new",
                lazy: async () => ({ Component: (await import("@/pages/admin/entry-editor-page")).EntryEditorPage }),
              },
              {
                path: ":id/edit",
                lazy: async () => ({ Component: (await import("@/pages/admin/entry-editor-page")).EntryEditorPage }),
              },
            ],
          },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
