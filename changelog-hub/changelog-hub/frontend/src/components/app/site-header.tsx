import { LayoutDashboardIcon, LogOutIcon, MailIcon } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router";
import { useAuth } from "@/auth/auth-context";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { WhatsNewDrawer } from "@/components/app/whats-new-drawer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { toastManager } from "@/components/ui/toast";
import { PRODUCT_NAME } from "@/lib/content";
import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link className={cn("group inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring", className)} to="/">
      <span aria-hidden="true" className="flex flex-col gap-[3px]">
        <span className="h-[3px] w-4 rounded-full bg-cat-new" />
        <span className="h-[3px] w-3 rounded-full bg-cat-improved" />
        <span className="h-[3px] w-3.5 rounded-full bg-cat-fixed" />
      </span>
      <span className="font-heading font-semibold text-lg tracking-tight">{PRODUCT_NAME}</span>
      <span className="text-muted-foreground text-sm">Updates</span>
    </Link>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-md px-2.5 py-1.5 text-sm transition-colors hover:text-foreground",
    isActive ? "text-foreground" : "text-muted-foreground",
  );

export function SiteHeader() {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    toastManager.add({ title: "Signed out", type: "success" });
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:px-6">
        <Wordmark />
        <nav aria-label="Main" className="ms-2 hidden items-center gap-1 sm:flex">
          <NavLink className={navClass} end to="/">
            Timeline
          </NavLink>
          {user?.role === "admin" && (
            <NavLink className={navClass} to="/admin">
              Studio
            </NavLink>
          )}
        </nav>

        <div className="ms-auto flex items-center gap-1">
          <ThemeToggle />
          <WhatsNewDrawer />
          {status === "loading" ? (
            <div className="size-8" />
          ) : user ? (
            <Menu>
              <MenuTrigger
                aria-label="Account menu"
                className="ms-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
                </Avatar>
              </MenuTrigger>
              <MenuPopup align="end">
                <MenuGroup>
                  <MenuGroupLabel>
                    <span className="block truncate font-medium text-foreground">{user.name}</span>
                    <span className="block truncate font-normal">{user.email}</span>
                  </MenuGroupLabel>
                </MenuGroup>
                <MenuSeparator />
                {user.role === "admin" && (
                  <MenuItem onClick={() => navigate("/admin")}>
                    <LayoutDashboardIcon />
                    Publishing studio
                  </MenuItem>
                )}
                <MenuItem onClick={onLogout}>
                  <LogOutIcon />
                  Sign out
                </MenuItem>
              </MenuPopup>
            </Menu>
          ) : (
            <>
              <Button className="max-sm:hidden" render={<Link to="/dev/mailbox" />} size="sm" variant="ghost">
                <MailIcon />
                Dev inbox
              </Button>
              <Button className="ms-1" render={<Link to="/login" />} size="sm">
                Sign in
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
