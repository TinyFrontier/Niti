import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import {
  Briefcase,
  Building2,
  CalendarClock,
  ChartNoAxesColumn,
  CheckSquare,
  FileText,
  LayoutDashboard,
  LogOut,
  Send,
  Settings,
  Users,
} from "lucide-react";
import { getMe, logout as logoutRequest, type UserRole } from "@/features/auth/api";
import { BrandLogo } from "@/shared/ui/brand-logo";
import { BrandMark } from "@/shared/ui/brand-mark";
import { Button } from "@/shared/ui/button";
import { ModeToggle } from "@/shared/ui/mode-toggle";
import { GlobalSearch } from "@/shared/layout/GlobalSearch";

const SEEKER_ROLES: UserRole[] = ["job_seeker", "mix"];

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/vacancies", label: "Vacancies", icon: Briefcase, roles: SEEKER_ROLES },
  { to: "/applications", label: "Applications", icon: Send, roles: SEEKER_ROLES },
  { to: "/interviews", label: "Interviews", icon: CalendarClock, roles: SEEKER_ROLES },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/cv-library", label: "Documents", icon: FileText, roles: SEEKER_ROLES },
  { to: "/analytics", label: "Analytics", icon: ChartNoAxesColumn, roles: SEEKER_ROLES },
];

function isItemActive(pathname: string, item: NavItem) {
  return item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function AppLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const { data: user } = useQuery({ queryKey: ["auth", "me"], queryFn: getMe });
  const isDashboard = pathname === "/";

  const visibleItems = navItems.filter(
    (item) => !item.roles || !user?.role || item.roles.includes(user.role),
  );
  const displayName = user?.full_name?.trim() || user?.email || "Your account";
  const firstName = user?.full_name?.trim().split(/\s+/)[0] || user?.email?.split("@")[0] || "there";
  const initial = displayName.charAt(0).toUpperCase();

  const logout = async () => {
    try {
      await logoutRequest();
    } catch {
      // Session may already be gone — still clear local state and leave.
    }
    queryClient.clear();
    navigate("/login", { replace: true });
  };

  return (
    <Sidebar.Provider className="min-h-svh bg-kumo-canvas" defaultOpen collapsible="icon" peekable>
      <Sidebar
        className="h-svh self-start border-r border-kumo-hairline bg-kumo-base"
        contentClassName="h-svh"
      >
        <Sidebar.Header className="h-24 px-4">
          <BrandLogo className="h-8 group-data-[state=collapsed]/sidebar:hidden" />
          <BrandMark className="hidden size-8 group-data-[state=collapsed]/sidebar:inline-flex" />
        </Sidebar.Header>

        <Sidebar.Content className="px-2">
          <Sidebar.Group>
            <Sidebar.Menu className="gap-1">
              {visibleItems.map((item) => (
                <Sidebar.MenuButton
                  key={item.to}
                  href={item.to}
                  icon={item.icon}
                  active={isItemActive(pathname, item)}
                  tooltip={item.label}
                  className="min-h-11 rounded-xl px-3 text-sm"
                >
                  {item.label}
                </Sidebar.MenuButton>
              ))}
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>

        <Sidebar.Footer className="h-auto flex-col items-stretch gap-3 whitespace-normal border-t border-kumo-hairline px-3 py-4 group-data-[state=collapsed]/sidebar:px-[11px]">
          <Sidebar.Menu>
            <Sidebar.MenuButton
              href="/settings"
              icon={Settings}
              active={pathname.startsWith("/settings")}
              tooltip="Settings"
              className="min-h-10 rounded-xl px-3 text-sm"
            >
              Settings
            </Sidebar.MenuButton>
          </Sidebar.Menu>
          <div className="flex min-w-0 items-center gap-3 border-t border-kumo-hairline pt-4 group-data-[state=collapsed]/sidebar:hidden">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-xs font-semibold text-primary">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-kumo-strong">
                {displayName}
              </p>
              <p className="truncate text-xs text-kumo-subtle">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 group-data-[state=collapsed]/sidebar:flex-col">
            <Sidebar.Trigger />
            <div className="flex items-center gap-1 group-data-[state=collapsed]/sidebar:flex-col">
              <ModeToggle />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Log out"
                title="Log out"
                onClick={logout}
              >
                <LogOut />
              </Button>
            </div>
          </div>
        </Sidebar.Footer>
        <Sidebar.Rail />
      </Sidebar>

      <div className="flex min-h-svh min-w-0 flex-1 flex-col bg-kumo-canvas">
        <header className="sticky top-0 z-30 border-b border-kumo-hairline bg-kumo-canvas/92 backdrop-blur-xl">
          <div className="flex min-h-16 items-center gap-3 px-4 md:min-h-24 md:px-6 lg:px-10">
            <div className="flex items-center md:hidden">
              <Sidebar.Trigger />
              <BrandMark className="ml-2 size-7" />
            </div>
            {isDashboard ? (
              <div className="hidden min-w-[16rem] lg:block">
                <h1 className="text-2xl font-semibold tracking-tight text-kumo-strong">
                  {getGreeting()}, {firstName}
                </h1>
                <p className="mt-1 text-sm text-kumo-subtle">
                  Here&apos;s what needs your attention today.
                </p>
              </div>
            ) : (
              <div className="hidden min-w-[10rem] text-sm text-kumo-subtle lg:block">
                Career workspace
              </div>
            )}
            <GlobalSearch className="mx-auto max-w-[35rem] flex-1" />
            <div className="flex shrink-0 items-center gap-2">
              <ModeToggle />
              <div
                className="hidden size-10 items-center justify-center rounded-full bg-primary-subtle text-sm font-semibold text-primary sm:flex"
                title={displayName}
                role="img"
                aria-label={`Signed in as ${displayName}`}
              >
                {initial}
              </div>
            </div>
          </div>
          {isDashboard && (
            <div className="px-4 pb-3 lg:hidden">
              <p className="text-sm font-semibold text-kumo-strong">
                {getGreeting()}, {firstName}
              </p>
              <p className="mt-0.5 text-xs text-kumo-subtle">
                Here&apos;s what needs your attention today.
              </p>
            </div>
          )}
        </header>

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[90rem] px-4 py-5 sm:px-6 sm:py-7 lg:px-10 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </Sidebar.Provider>
  );
}
