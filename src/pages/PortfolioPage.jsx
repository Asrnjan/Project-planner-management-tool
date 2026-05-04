import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BriefcaseBusiness,
  CalendarDays,
  ClipboardPenLine,
  Filter,
  FolderOpen,
  ListChecks,
  Plus,
  Search,
  SlidersHorizontal,
  TrendingUp,
  UserCircle,
} from "lucide-react";

import CentralizedManagerReportButton from "../components/CentralizedManagerReportButton";
import ProjectForm from "../components/projects/ProjectForm";
import CollapsibleCard from "../components/common/AppCollapsibleCard";
import { usePlannerStore } from "../store/usePlannerStore";

function PortfolioStatCard({ title, value, icon: Icon, subtitle }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </div>

      {subtitle ? (
        <div className="mt-1 text-[11px] text-slate-500">{subtitle}</div>
      ) : null}
    </div>
  );
}

function getProjectTaskSummary(project, tasks) {
  const projectTasks = tasks.filter((task) => task.projectId === project.id);

  const completed = projectTasks.filter((task) =>
    ["Done", "Completed", "Closed"].includes(task.status)
  ).length;

  const inProgress = projectTasks.filter((task) =>
    ["In Progress", "Ongoing"].includes(task.status)
  ).length;

  const blocked = projectTasks.filter((task) =>
    ["Blocked", "On Hold"].includes(task.status)
  ).length;

  const milestones = projectTasks.filter((task) => task.isMilestone).length;

  const progress = projectTasks.length
    ? Math.round((completed / projectTasks.length) * 100)
    : 0;

  return {
    total: projectTasks.length,
    completed,
    inProgress,
    blocked,
    milestones,
    progress,
  };
}

function statusClass(status) {
  if (status === "Completed") return "bg-emerald-100 text-emerald-700";
  if (status === "On Hold") return "bg-amber-100 text-amber-700";
  return "bg-blue-100 text-blue-700";
}

function ProjectDashboardCard({ project, tasks, onDelete }) {
  const taskSummary = getProjectTaskSummary(project, tasks);

  function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${project.name}" and all related tasks? This cannot be undone.`
    );

    if (confirmed) {
      onDelete(project.id);
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold tracking-tight text-slate-900">
            {project.name}
          </h3>

          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
            {project.description || "No description added."}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClass(
            project.status
          )}`}
        >
          {project.status || "Active"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[11px]">
        <div className="rounded-2xl bg-slate-50 px-2 py-2">
          <div className="font-semibold text-slate-900">
            {taskSummary.total}
          </div>
          <div className="text-slate-500">Tasks</div>
        </div>

        <div className="rounded-2xl bg-slate-50 px-2 py-2">
          <div className="font-semibold text-slate-900">
            {taskSummary.inProgress}
          </div>
          <div className="text-slate-500">Active</div>
        </div>

        <div className="rounded-2xl bg-slate-50 px-2 py-2">
          <div className="font-semibold text-slate-900">
            {taskSummary.completed}
          </div>
          <div className="text-slate-500">Done</div>
        </div>

        <div className="rounded-2xl bg-slate-50 px-2 py-2">
          <div className="font-semibold text-slate-900">
            {taskSummary.blocked}
          </div>
          <div className="text-slate-500">Blocked</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
          <span>Completion</span>
          <span>{taskSummary.progress}%</span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-slate-900"
            style={{ width: `${taskSummary.progress}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
        <div className="inline-flex items-center gap-2">
          <UserCircle className="h-4 w-4 text-slate-400" />
          <span className="font-medium text-slate-800">Owner:</span>
          <span>{project.owner || "Not assigned"}</span>
        </div>

        <div className="inline-flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-400" />
          <span className="font-medium text-slate-800">Timeline:</span>
          <span>
            {project.startDate || "-"} to {project.targetEndDate || "-"}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={`/project/${project.id}`}
          className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Open Workspace
        </Link>

        <Link
          to={`/planner?projectId=${project.id}&tab=schedule`}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Open Schedule
        </Link>

        <Link
          to={`/planner?projectId=${project.id}&tab=timeline`}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Timeline
        </Link>

        <button
          type="button"
          onClick={handleDelete}
          className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const { projects, tasks, addProject, deleteProject } = usePlannerStore();

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("updated");

  const totalProjects = projects.length;
  const totalTasks = tasks.length;

  const completedTasks = tasks.filter((task) =>
    ["Done", "Completed", "Closed"].includes(task.status)
  ).length;

  const activeProjects = projects.filter(
    (project) => project.status === "Active"
  ).length;

  const overallCompletion = totalTasks
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  const filteredProjects = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    let result = projects.filter((project) => {
      const matchesSearch =
        !query ||
        project.name?.toLowerCase().includes(query) ||
        project.owner?.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "All" || project.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    if (sortBy === "name") {
      result = [...result].sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );
    }

    if (sortBy === "status") {
      result = [...result].sort((a, b) =>
        String(a.status || "").localeCompare(String(b.status || ""))
      );
    }

    if (sortBy === "startDate") {
      result = [...result].sort((a, b) =>
        String(a.startDate || "").localeCompare(String(b.startDate || ""))
      );
    }

    if (sortBy === "updated") {
      result = [...result].sort((a, b) =>
        String(b.updatedAt || b.createdAt || "").localeCompare(
          String(a.updatedAt || a.createdAt || "")
        )
      );
    }

    return result;
  }, [projects, searchText, statusFilter, sortBy]);

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              <BriefcaseBusiness className="h-3.5 w-3.5" />
              Portfolio Dashboard
            </div>

            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              Project Portfolio
            </h2>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Manage project workspaces, track progress, and open schedule,
              sprint, timeline, reporting, documentation, and centralized PPT
              views from one place.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CentralizedManagerReportButton />

            <Link
              to="/planner"
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <ClipboardPenLine className="h-4 w-4" />
              Open Planner
            </Link>

            <a
              href="#create-project"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              New Project
            </a>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <PortfolioStatCard
          title="Projects"
          value={totalProjects}
          icon={BriefcaseBusiness}
          subtitle={`${activeProjects} active`}
        />

        <PortfolioStatCard
          title="Active"
          value={activeProjects}
          icon={FolderOpen}
          subtitle="Currently running"
        />

        <PortfolioStatCard
          title="Tasks"
          value={totalTasks}
          icon={ListChecks}
          subtitle={`${completedTasks} completed`}
        />

        <PortfolioStatCard
          title="Completion"
          value={`${overallCompletion}%`}
          icon={TrendingUp}
          subtitle={totalTasks ? "Across all tasks" : "No tasks yet"}
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] xl:min-w-[720px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search project, owner, or description..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </div>

            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-8 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div className="relative">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-8 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
              >
                <option value="updated">Recently Updated</option>
                <option value="name">Project Name</option>
                <option value="status">Status</option>
                <option value="startDate">Start Date</option>
              </select>
            </div>
          </div>

          <div className="text-xs font-medium text-slate-500">
            Showing {filteredProjects.length} of {projects.length} projects
          </div>
        </div>
      </section>

      <div id="create-project">
        <CollapsibleCard
          title="Create Project"
          subtitle="Open only when you want to add a new project."
          defaultOpen={false}
        >
          <ProjectForm onSubmit={addProject} />
        </CollapsibleCard>
      </div>

      <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {filteredProjects.map((project) => (
          <ProjectDashboardCard
            key={project.id}
            project={project}
            tasks={tasks}
            onDelete={deleteProject}
          />
        ))}

        {filteredProjects.length === 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm lg:col-span-2 2xl:col-span-3">
            No matching projects found. Adjust your search/filter or create a
            new project.
          </div>
        )}
      </section>
    </div>
  );
}