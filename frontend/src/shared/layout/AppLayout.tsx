import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
import { getMe, type UserRole } from "@/features/auth/api";
import { tokenStorage } from "@/shared/api/client";
import { BrandMark } from "@/shared/ui/brand-mark";
import { Button } from "@/shared/ui/button";
import { ModeToggle } from "@/shared/ui/mode-toggle";

const SEEKER_ROLES: UserRole[] = ["job_seeker", "mix"];

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  roles?: UserRole[];
  section: "Workspace" | "Network" | "Account";
}

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, section: "Workspace" },
  { to: "/vacancies", label: "Vacancies", icon: Briefcase, roles: SEEKER_ROLES, section: "Workspace" },
  { to: "/applications", label: "Applications", icon: Send, roles: SEEKER_ROLES, section: "Workspace" },
  { to: "/interviews", label: "Interviews", icon: CalendarClock, roles: SEEKER_ROLES, section: "Workspace" },
  { to: "/tasks", label: "Tasks", icon: CheckSquare, section: "Workspace" },
  { to: "/companies", label: "Companies", icon: Building2, section: "Network" },
  { to: "/contacts", label: "Contacts", icon: Users, section: "Network" },
  { to: "/cv-library", label: "CV Library", icon: FileText, roles: SEEKER_ROLES, section: "Network" },
  { to: "/analytics", label: "Analytics", icon: ChartNoAxesColumn, roles: SEEKER_ROLES, section: "Network" },
  { to: "/settings", label: "Settings", icon: Settings, section: "Account" },
];

function isItemActive(pathname: string, item: NavItem) {
  return item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function AppLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: user } = useQuery({ queryKey: ["auth", "me"], queryFn: getMe });
  const sections: NavItem["section"][] = ["Workspace", "Network", "Account"];

  const visibleItems = navItems.filter(
    (item) => !item.roles || !user?.role || item.roles.includes(user.role),
  );

  const logout = () => {
    tokenStorage.clear();
    navigate("/login", { replace: true });
  };

  return (
    <Sidebar.Provider className="min-h-svh" defaultOpen collapsible="icon" peekable>
      <Sidebar className="h-svh self-start" contentClassName="h-svh">
        <Sidebar.Header className="h-16">
          <div className="flex min-w-0 items-center gap-2.5 px-1">
            <BrandMark className="size-8" />
            <div className="min-w-0 group-data-[state=collapsed]/sidebar:hidden">
              <p className="truncate text-sm font-semibold text-kumo-strong">Niti</p>
              <p className="truncate text-xs text-kumo-subtle">Career workspace</p>
            </div>
          </div>
        </Sidebar.Header>

        <Sidebar.Content>
          {sections.map((section) => {
            const items = visibleItems.filter((item) => item.section === section);
            if (items.length === 0) return null;

            return (
              <Sidebar.Group key={section}>
                <Sidebar.GroupLabel>{section}</Sidebar.GroupLabel>
                <Sidebar.Menu>
                  {items.map((item) => (
                    <Sidebar.MenuButton
                      key={item.to}
                      href={item.to}
                      icon={item.icon}
                      active={isItemActive(pathname, item)}
                      tooltip={item.label}
                    >
                      {item.label}
                    </Sidebar.MenuButton>
                  ))}
                </Sidebar.Menu>
              </Sidebar.Group>
            );
          })}
        </Sidebar.Content>

        <Sidebar.Footer className="h-auto min-h-12 flex-col items-stretch gap-2 whitespace-normal px-3 py-3 group-data-[state=collapsed]/sidebar:px-[11px]">
          <div className="flex min-w-0 items-center gap-2 group-data-[state=collapsed]/sidebar:hidden">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-kumo-tint text-xs font-semibold text-kumo-strong">
              {(user?.full_name || user?.email || "U").trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-kumo-strong">
                {user?.full_name ?? "Your account"}
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
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-kumo-hairline bg-kumo-canvas/90 px-4 backdrop-blur-lg md:hidden">
          <div className="flex items-center gap-2">
            <Sidebar.Trigger />
            <BrandMark className="size-7" />
            <span className="text-sm font-semibold text-kumo-strong">Niti</span>
          </div>
          <ModeToggle />
        </header>

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
            <Outlet />
          </div>
        </main>
      </div>
    </Sidebar.Provider>
  );
}
