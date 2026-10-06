import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  ArrowRightLeft,
  CircleHelp,
  ClipboardList,
  Clock,
  Eye,
  FolderKanban,
  HardDrive,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import { cx } from "../../ui/primitives";
import { ROLE_LABEL } from "../../domain/permissions";
import { useAccess, useAccessStore } from "../../store/useAccessStore";
import { useUiStore } from "../../ui/uiStore";
import { usePlannerStore } from "../../store/usePlannerStore";
import CommandPalette from "./CommandPalette";
import NewProjectDialog from "../projects/NewProjectDialog";
import QuickTaskDialog from "../tasks/QuickTaskDialog";

export const NAV_ITEMS = [
  {
    to: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "All projects, health and what needs attention",
  },
  {
    to: "/planner",
    label: "Planner",
    icon: ClipboardList,
    description: "Tasks, timeline, board, sprints and reports",
  },
  {
    to: "/assistant",
    label: "Ask Claude",
    icon: Sparkles,
    description: "AI insights, risk analysis and report drafts",
    requires: ["ai.use"],
  },
  {
    to: "/timesheet",
    label: "Timesheet",
    icon: Clock,
    description: "Clock in, track time on your tasks, submit and approve",
    requires: ["timesheet.log", "timesheet.view_all", "timesheet.approve"],
  },
  {
    to: "/data",
    label: "Import & Export",
    icon: ArrowRightLeft,
    description: "Bring data in from any tool, back up or export",
  },
  {
    to: "/admin",
    label: "Admin",
    icon: ShieldCheck,
    description: "Users, roles and permissions, rules and the activity log",
    requires: ["admin.users", "admin.roles_rules", "admin.audit"],
  },
  {
    to: "/help",
    label: "Help & Guide",
    icon: CircleHelp,
    description: "How everything works, in plain language",
  },
];

/** Navigation items the current person may open. */
export function useNavItems() {
  const { permissions } = useAccess();
  return NAV_ITEMS.filter((item) => !item.requires || item.requires.some((key) => permissions[key]));
}

function PreviewBanner() {
  const { previewing } = useAccess();
  const setPreview = useAccessStore((state) => state.setPreview);
  if (!previewing) return null;
  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-100 px-4 py-2 text-sm text-amber-900" role="status" data-testid="preview-banner">
      <Eye className="h-4 w-4" aria-hidden />
      <span>
        Previewing as <strong>{previewing.displayName || previewing.email}</strong> ({ROLE_LABEL[previewing.role]}). You see
        and can do only what they can.
      </span>
      <button type="button" onClick={() => setPreview("")} className="font-semibold underline underline-offset-2">
        Exit preview
      </button>
    </div>
  );
}

function SidebarContent({ onNavigate, localMode, canSignIn, userEmail, onLogout }) {
  const openNewProject = useUiStore((state) => state.openNewProject);
  const openCommandPalette = useUiStore((state) => state.openCommandPalette);
  const navItems = useNavItems();
  const { permissions } = useAccess();

  return (
    <div className="flex h-full flex-col">
      <Link to="/" onClick={onNavigate} className="flex items-center gap-2.5 px-4 pb-4 pt-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
          <FolderKanban className="h-5 w-5" aria-hidden />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-slate-900">Project Planner</div>
          <div className="text-[11px] text-slate-500">Plan · Track · Report</div>
        </div>
      </Link>

      <div className="space-y-2 px-3">
        {permissions["projects.create"] ? (
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              openNewProject();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" aria-hidden /> New project
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            openCommandPalette();
          }}
          className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-medium">
            Ctrl K
          </kbd>
        </button>
      </div>

      <nav aria-label="Main" className="mt-4 min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={onNavigate}
            className={({ isActive }) =>
              cx(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cx(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-indigo-600" : item.to === "/assistant" ? "text-violet-600" : "text-slate-400"
                  )}
                  aria-hidden
                />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Always visible: the menu above scrolls on short screens. */}
      <div className="shrink-0 border-t border-slate-200 p-3">
        {localMode ? (
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <div className="flex items-center gap-1.5 font-semibold">
              <HardDrive className="h-3.5 w-3.5" aria-hidden /> Saved in this browser
            </div>
            <p className="mt-0.5 text-amber-800">Back up regularly from Import &amp; Export.</p>
            {canSignIn ? (
              <button
                type="button"
                onClick={onLogout}
                className="mt-1 inline-flex items-center gap-1 font-semibold text-amber-900 underline-offset-2 hover:underline"
              >
                <LogIn className="h-3.5 w-3.5" aria-hidden /> Sign in to sync
              </button>
            ) : null}
          </div>
        ) : (
          <AccountMenu userEmail={userEmail} onLogout={onLogout} />
        )}
      </div>
    </div>
  );
}

function formatSignIn(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Your name and role; opens your account details and Sign out. */
function AccountMenu({ userEmail, onLogout }) {
  const { realMember } = useAccess();
  const projects = usePlannerStore((state) => state.projects);
  const [open, setOpen] = useState(false);
  const name = realMember?.displayName || userEmail.split("@")[0] || "Account";
  const projectNames = Array.isArray(realMember?.projectIds)
    ? projects.filter((project) => realMember.projectIds.includes(project.id)).map((project) => project.name)
    : null;

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="relative">
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-label="Your account"
            className="absolute bottom-full left-0 right-0 z-50 mb-2 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-xl"
            data-testid="account-menu"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold uppercase text-indigo-700">
                {name.slice(0, 1)}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-900">{name}</div>
                <div className="truncate text-xs text-slate-500">{userEmail}</div>
              </div>
            </div>
            <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Role</dt>
                <dd className="font-medium text-slate-800">{realMember ? ROLE_LABEL[realMember.role] : "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Projects</dt>
                <dd className="truncate text-right font-medium text-slate-800" title={projectNames?.join(", ")}>
                  {projectNames ? (projectNames.length ? projectNames.join(", ") : "None yet") : "All projects"}
                </dd>
              </div>
              {realMember?.lastSignInAt ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Signed in</dt>
                  <dd className="font-medium text-slate-800">{formatSignIn(realMember.lastSignInAt)}</dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-3 text-[11px] text-slate-400">
              {realMember?.role === "admin"
                ? "Change names and access in Admin → Users."
                : "Ask your administrator to change your name or access."}
            </p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          </div>
        </>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Your account and sign out"
        data-testid="account-button"
        className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left transition hover:bg-slate-100"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold uppercase text-indigo-700">
          {name.slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1 text-xs">
          <span className="block truncate font-medium text-slate-800">{name}</span>
          <span className="block truncate text-slate-500">{realMember ? ROLE_LABEL[realMember.role] : userEmail}</span>
        </span>
        <LogOut className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </button>
    </div>
  );
}

export default function AppShell({ children, session, localMode, canSignIn, onLogout }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const openCommandPalette = useUiStore((state) => state.openCommandPalette);
  const openNewProject = useUiStore((state) => state.openNewProject);

  const userEmail = session?.user?.email || "";
  const current = NAV_ITEMS.find((item) =>
    item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)
  );

  useEffect(() => {
    function onKeyDown(event) {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openCommandPalette();
        return;
      }

      if (!typing && !event.ctrlKey && !event.metaKey && !event.altKey && event.key === "/") {
        event.preventDefault();
        openCommandPalette();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openCommandPalette]);

  const sidebarProps = { localMode, canSignIn, userEmail, onLogout };
  const canCreateProjects = useAccess().permissions["projects.create"];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <SidebarContent {...sidebarProps} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent {...sidebarProps} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 truncate text-sm font-semibold">
            {current?.label || "Project Planner"}
          </div>
          <button
            type="button"
            onClick={openCommandPalette}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
          {canCreateProjects ? (
            <button
              type="button"
              onClick={openNewProject}
              className="rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-700"
              aria-label="New project"
            >
              <Plus className="h-5 w-5" />
            </button>
          ) : null}
        </header>

        <PreviewBanner />

        <main id="main" className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      <CommandPalette />
      <NewProjectDialog />
      <QuickTaskDialog />
    </div>
  );
}
