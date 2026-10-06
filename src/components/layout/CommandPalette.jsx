import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRightLeft,
  CircleHelp,
  ClipboardList,
  Clock,
  FolderKanban,
  KanbanSquare,
  LayoutDashboard,
  ListPlus,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  CalendarRange,
} from "lucide-react";

import { usePlannerStore } from "../../store/usePlannerStore";
import { useUiStore } from "../../ui/uiStore";
import { cx } from "../../ui/primitives";
import { canAccessProject } from "../../domain/permissions";
import { useAccess } from "../../store/useAccessStore";

function useCommands(query) {
  const navigate = useNavigate();
  const allProjects = usePlannerStore((state) => state.projects);
  const allTasks = usePlannerStore((state) => state.tasks);
  const access = useAccess();
  const openNewProject = useUiStore((state) => state.openNewProject);
  const openQuickTask = useUiStore((state) => state.openQuickTask);

  return useMemo(() => {
    const visible = (projectId) => access.unrestricted || canAccessProject(access.member, projectId);
    const projects = allProjects.filter((project) => visible(project.id));
    const tasks = allTasks.filter((task) => visible(task.projectId));
    const can = (permission) => Boolean(access.permissions[permission]);
    const base = [
      { id: "nav-dashboard", group: "Go to", label: "Dashboard", icon: LayoutDashboard, run: () => navigate("/") },
      { id: "nav-planner", group: "Go to", label: "Planner", icon: ClipboardList, run: () => navigate("/planner") },
      { id: "nav-timeline", group: "Go to", label: "Timeline (Gantt chart)", icon: CalendarRange, run: () => navigate("/planner?tab=timeline") },
      { id: "nav-board", group: "Go to", label: "Board (Kanban)", icon: KanbanSquare, run: () => navigate("/planner?tab=board") },
      can("ai.use") ? { id: "nav-claude", group: "Go to", label: "Ask Claude", icon: Sparkles, run: () => navigate("/assistant") } : null,
      can("timesheet.log") || can("timesheet.approve") || can("timesheet.view_all")
        ? { id: "nav-timesheet", group: "Go to", label: "Timesheet", icon: Clock, keywords: "time clock hours", run: () => navigate("/timesheet") }
        : null,
      { id: "nav-data", group: "Go to", label: "Import & Export", icon: ArrowRightLeft, run: () => navigate("/data") },
      can("admin.users") || can("admin.roles_rules") || can("admin.audit")
        ? { id: "nav-admin", group: "Go to", label: "Admin: users, roles and rules", icon: ShieldCheck, keywords: "permissions access", run: () => navigate("/admin") }
        : null,
      { id: "nav-help", group: "Go to", label: "Help & Guide", icon: CircleHelp, run: () => navigate("/help") },
      can("projects.create") ? { id: "act-project", group: "Actions", label: "Create a new project", icon: Plus, keywords: "add", run: openNewProject } : null,
      can("tasks.create") ? { id: "act-task", group: "Actions", label: "Add a task", icon: ListPlus, keywords: "new create", run: () => openQuickTask("") } : null,
      can("data.import")
        ? { id: "act-import", group: "Actions", label: "Import a file (Excel, CSV, Jira, MS Project...)", icon: ArrowRightLeft, keywords: "upload", run: () => navigate("/data") }
        : null,
      can("ai.use") ? { id: "act-analyze", group: "Actions", label: "Analyse my portfolio with Claude", icon: Sparkles, keywords: "ai insights risk", run: () => navigate("/assistant") } : null,
    ].filter(Boolean);

    const projectCommands = projects.map((project) => ({
      id: `project-${project.id}`,
      group: "Projects",
      label: project.name,
      hint: project.status,
      icon: FolderKanban,
      run: () => navigate(`/planner?projectId=${encodeURIComponent(project.id)}&tab=overview`),
    }));

    const q = query.trim().toLowerCase();
    if (!q) return [...base, ...projectCommands.slice(0, 6)];

    const projectNames = Object.fromEntries(projects.map((p) => [p.id, p.name]));
    const taskCommands = tasks
      .filter((task) => task.title.toLowerCase().includes(q))
      .slice(0, 8)
      .map((task) => ({
        id: `task-${task.id}`,
        group: "Tasks",
        label: task.title,
        hint: projectNames[task.projectId] || "",
        icon: ClipboardList,
        run: () =>
          navigate(
            `/planner?projectId=${encodeURIComponent(task.projectId)}&tab=schedule&taskId=${encodeURIComponent(task.id)}`
          ),
      }));

    const matches = (command) =>
      `${command.label} ${command.keywords || ""} ${command.hint || ""}`
        .toLowerCase()
        .includes(q);

    return [...base.filter(matches), ...projectCommands.filter(matches), ...taskCommands];
  }, [query, allProjects, allTasks, access, navigate, openNewProject, openQuickTask]);
}

function PaletteBody({ onClose }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const commands = useCommands(query);
  const safeIndex = Math.min(activeIndex, Math.max(0, commands.length - 1));

  function runCommand(command) {
    onClose();
    command?.run();
  }

  function onKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, commands.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      runCommand(commands[safeIndex]);
    } else if (event.key === "Escape") {
      onClose();
    }
  }

  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
        className="relative w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search className="h-4 w-4 text-slate-400" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search projects, tasks, pages or actions..."
            className="h-14 flex-1 bg-transparent text-sm outline-none"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-results"
            aria-activedescendant={commands[safeIndex] ? `cmd-${commands[safeIndex].id}` : undefined}
          />
          <kbd className="rounded border border-slate-200 px-1.5 text-[10px] text-slate-500">Esc</kbd>
        </div>

        <ul id="command-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {commands.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-slate-500">
              Nothing matches "{query}".
            </li>
          ) : (
            commands.map((command, index) => {
              const showGroup = command.group !== lastGroup;
              lastGroup = command.group;
              const Icon = command.icon;
              return (
                <li key={command.id} role="presentation">
                  {showGroup ? (
                    <div className="px-3 pb-1 pt-2 text-xs font-semibold text-slate-400">
                      {command.group}
                    </div>
                  ) : null}
                  <button
                    id={`cmd-${command.id}`}
                    type="button"
                    role="option"
                    aria-selected={index === safeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => runCommand(command)}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm",
                      index === safeIndex ? "bg-indigo-50 text-indigo-900" : "text-slate-700"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{command.label}</span>
                    {command.hint ? (
                      <span className="truncate text-xs text-slate-400">{command.hint}</span>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

export default function CommandPalette() {
  const open = useUiStore((state) => state.commandPaletteOpen);
  const close = useUiStore((state) => state.closeCommandPalette);

  if (!open) return null;
  return <PaletteBody onClose={close} />;
}
