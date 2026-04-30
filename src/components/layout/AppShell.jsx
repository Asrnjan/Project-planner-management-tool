import { Link, useLocation } from "react-router-dom";
import {
  ClipboardPenLine,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  UserCircle,
} from "lucide-react";

function NavItem({ to, icon: Icon, label, active }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}

export default function AppShell({ children, session, onLogout }) {
  const location = useLocation();

  const userEmail = session?.user?.email || "Signed in user";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <FolderKanban className="h-5 w-5" />
            </div>

            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold tracking-tight text-slate-900">
                Project Planner & Tracker
              </div>
              <div className="truncate text-xs text-slate-500">
                Portfolio, planning, cloud sync, and schedule control
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <nav className="hidden items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm md:flex">
              <NavItem
                to="/"
                icon={LayoutDashboard}
                label="Portfolio"
                active={location.pathname === "/"}
              />
              <NavItem
                to="/planner"
                icon={ClipboardPenLine}
                label="Planner"
                active={location.pathname === "/planner"}
              />
            </nav>

            <div className="hidden max-w-[220px] items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 lg:flex">
              <UserCircle className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="truncate">{userEmail}</span>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white px-4 py-2 md:hidden">
          <nav className="mx-auto flex max-w-[1600px] items-center gap-2">
            <NavItem
              to="/"
              icon={LayoutDashboard}
              label="Portfolio"
              active={location.pathname === "/"}
            />
            <NavItem
              to="/planner"
              icon={ClipboardPenLine}
              label="Planner"
              active={location.pathname === "/planner"}
            />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-5">{children}</main>
    </div>
  );
}