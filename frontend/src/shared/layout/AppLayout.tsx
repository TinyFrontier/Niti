import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  Building2,
  CalendarClock,
  ChartNoAxesColumn,
  CheckSquare,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Send,
  Settings,
  Users,
  X,
} from "lucide-react";
import { getMe, type UserRole } from "@/features/auth/api";
import { tokenStorage } from "@/shared/api/client";
import { cn } from "@/shared/lib/utils";
import { BrandMark } from "@/shared/ui/brand-mark";

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

interface SidebarContentProps {
  items: NavItem[];
  user?: { full_name?: string | null; email?: string };
  onLogout: () => void;
  onNavigate?: () => void;
}

function SidebarContent({ items, user, onLogout, onNavigate }: SidebarContentProps) {
  const sections: NavItem["section"][] = ["Workspace", "Network", "Account"];

  return (
    <>
      <div className="flex h-20 items-center gap-3 px-5">
        <BrandMark />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-[-0.01em]">Job Search</p>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-sidebar-muted">
            Career workspace
          </p>
        </div>
      </div>

      <nav aria-label="Main navigation" className="flex flex-1 flex-col overflow-y-auto px-3 pb-4">
        {sections.map((section) => {
          const sectionItems = items.filter((item) => item.section === section);
          if (sectionItems.length === 0) return null;

          return (
            <div key={section} className="mt-4 first:mt-1">
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted/70">
                {section}
              </p>
              <div className="flex flex-col gap-0.5">
                {sectionItems.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "group flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                        isActive && "bg-sidebar-accent text-sidebar-foreground shadow-xs",
                      )
                    }
                  >
                    <Icon className="size-4 shrink-0 opacity-80 transition-opacity group-hover:opacity-100" />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-foreground">
            {(user?.full_name || user?.email || "U").trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.full_name ?? "Your account"}</p>
            <p className="truncate text-xs text-sidebar-muted">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Log out"
            aria-label="Log out"
            className="rounded-md p-2 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </>
  );
}

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { data: user } = useQuery({ queryKey: ["auth", "me"], queryFn: getMe });

  useEffect(() => setMobileNavOpen(false), [location.pathname]);

  const visibleItems = navItems.filter(
    (item) => !item.roles || !user?.role || item.roles.includes(user.role),
  );

  const logout = () => {
    tokenStorage.clear();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <SidebarContent items={visibleItems} user={user} onLogout={logout} />
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 cursor-default bg-foreground/45 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative flex h-full w-[min(19rem,86vw)] flex-col bg-sidebar text-sidebar-foreground shadow-overlay">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileNavOpen(false)}
              className="absolute right-3 top-5 rounded-md p-2 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <X className="size-4" />
            </button>
            <SidebarContent
              items={visibleItems}
              user={user}
              onLogout={logout}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 flex-col md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-lg md:hidden">
          <div className="flex items-center gap-2.5">
            <BrandMark className="size-8" />
            <span className="text-sm font-semibold">Job Search</span>
          </div>
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
            className="flex size-10 items-center justify-center rounded-md border border-input bg-surface-raised shadow-xs"
          >
            <Menu className="size-4.5" />
          </button>
        </header>

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
