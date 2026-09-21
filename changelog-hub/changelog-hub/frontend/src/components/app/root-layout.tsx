import { Outlet } from "react-router";
import { SiteHeader } from "@/components/app/site-header";
import { API_URL } from "@/lib/api";
import { PRODUCT_NAME } from "@/lib/content";

export function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        className="sr-only rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50"
        href="#main"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main className="flex-1" id="main">
        <Outlet />
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-muted-foreground text-sm sm:px-6">
          <span>{PRODUCT_NAME} product updates</span>
          <a className="hover:text-foreground" href={`${API_URL}/api/v1/changelog/feed`}>
            JSON feed
          </a>
        </div>
      </footer>
    </div>
  );
}
