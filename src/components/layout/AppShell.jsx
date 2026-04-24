import { Link, useLocation } from "react-router-dom";
import { FolderKanban, LayoutDashboard, ClipboardPenLine } from "lucide-react";

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
      {label}
    </Link>
  );
}

export default function AppShell({ children }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <FolderKanban className="h-5 w-5" />
            </div>

            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight text-slate-900">
                Gantt Planner
              </div>
              <div className="text-xs text-slate-500">
                Portfolio, planning, and schedule control
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
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

      <main className="mx-auto max-w-[1600px] px-4 py-5">
        {children}
      </main>
    </div>
  );
}