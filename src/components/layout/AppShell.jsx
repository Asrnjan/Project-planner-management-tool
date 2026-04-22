import { Link, useLocation } from "react-router-dom";
import { FolderKanban, LayoutDashboard, ClipboardPenLine } from "lucide-react";

export default function AppShell({ children }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-900 p-2 text-white">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Gantt Planner</h1>
              <p className="text-xs text-slate-500">
                Multi-project sprint and timeline tracker
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              to="/"
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                location.pathname === "/"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Portfolio
            </Link>

            <Link
              to="/planner"
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                location.pathname === "/planner"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              <ClipboardPenLine className="h-4 w-4" />
              Planner
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}