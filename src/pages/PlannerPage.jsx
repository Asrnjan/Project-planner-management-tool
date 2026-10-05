import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRightLeft,
  BarChart3,
  CalendarDays,
  CalendarRange,
  CircleUserRound,
  FileText,
  FolderKanban,
  KanbanSquare,
  LayoutGrid,
  ListPlus,
  ListTodo,
  Pencil,
  Sparkles,
  Table2,
  Users,
} from "lucide-react";

import { usePlannerStore } from "../store/usePlannerStore";
import { useUiStore } from "../ui/uiStore";
import { notify } from "../ui/feedback";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Modal,
  ProgressBar,
  cx,
  inputClass,
} from "../ui/primitives";

import PlannerRiskSummary from "../components/planner/PlannerRiskSummary";
import CollapsibleCard from "../components/common/AppCollapsibleCard";
import SprintForm from "../components/sprints/SprintForm";
import SprintList from "../components/sprints/SprintList";
import ProjectForm from "../components/projects/ProjectForm";
import AiInsightCard from "../components/ai/AiInsightCard";

import {
  getDependencyConflicts,
  getDependencyGraphStarter,
  getTaskRelationships,
  getProjectRiskSummary,
  recalculateMsProjectSchedule,
} from "../utils/planner";
import { HEALTH_TONE, computeProjectMetrics, computeWorkload, todayIso } from "../domain/analytics";
import { isDoneStatus } from "../domain/vocabulary";

const PlannerScheduleTable = lazy(() => import("../components/planner/PlannerScheduleTable"));
const PlannerScheduleAssistPanel = lazy(() => import("../components/planner/PlannerScheduleAssistPanel"));
const PlannerBoardView = lazy(() => import("../components/planner/PlannerBoardView"));
const PlannerTimelineView = lazy(() => import("../components/gantt/TimelineView"));
const PlannerResourcesView = lazy(() => import("../components/planner/PlannerResourcesView"));
const PlannerRelationshipPanel = lazy(() => import("../components/planner/PlannerRelationshipPanel"));
const ProjectDocumentsView = lazy(() => import("../components/documents/ProjectDocumentsView"));
const WeeklyCeoReportView = lazy(() => import("../components/reports/WeeklyCeoReportView"));
const PlannerReportsView = lazy(() => import("../components/planner/PlannerReportsView"));
const PlannerBaselinePanel = lazy(() => import("../components/planner/PlannerBaselinePanel"));
const PlannerDependencyGraphStarter = lazy(() => import("../components/planner/PlannerDependencyGraphStarter"));
const PlannerDependencyGraphVisual = lazy(() => import("../components/planner/PlannerDependencyGraphVisual"));

export const PLANNER_TABS = [
  { key: "overview", label: "Overview", icon: LayoutGrid, hint: "Project summary, health, milestones and Claude's briefing." },
  { key: "schedule", label: "Schedule", icon: Table2, hint: "Edit tasks like a spreadsheet: dates, owners, subtasks and dependencies. Changes save when you leave a cell." },
  { key: "board", label: "Board", icon: KanbanSquare, hint: "Drag cards between columns to change their status." },
  { key: "timeline", label: "Timeline", icon: CalendarRange, hint: "Gantt chart of every dated task. Drag bars to reschedule." },
  { key: "sprints", label: "Sprints", icon: ListTodo, hint: "Time-boxed iterations. Create sprints, then assign tasks to them in the Schedule." },
  { key: "resources", label: "People", icon: Users, hint: "Who is working on what, and how tasks depend on each other." },
  { key: "documents", label: "Documents", icon: FileText, hint: "Keep links to charters, specs and sign-offs with the project." },
  { key: "reports", label: "Reports", icon: BarChart3, hint: "Weekly status reports (Claude can draft them), baselines and dependency analysis." },
];

function TabLoading() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      Loading...
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className={cx("text-lg font-semibold tracking-tight", tone || "text-slate-900")}>{value}</div>
    </div>
  );
}

function SelectProjectNotice({ what }) {
  return (
    <EmptyState
      icon={FolderKanban}
      title="Pick a project first"
      description={`${what} belong to a single project. Choose one from "Project" at the top of the page.`}
    />
  );
}

function OverviewTab({ project, metrics, tasks, onEdit, sprintCount, docCount, reportCount }) {
  const milestones = tasks
    .filter((task) => task.isMilestone)
    .sort((a, b) => String(a.plannedStart || a.plannedEnd).localeCompare(String(b.plannedStart || b.plannedEnd)));
  const workload = computeWorkload(tasks).slice(0, 6);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">{project.name}</h2>
                <Badge tone={HEALTH_TONE[metrics.health.level]}>{metrics.health.label}</Badge>
                <Badge>{project.status}</Badge>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                {project.description || "No description yet. Add one so everyone knows what this project delivers."}
              </p>
            </div>
            <Button icon={Pencil} onClick={onEdit}>
              Edit details
            </Button>
          </div>

          <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <CircleUserRound className="h-4 w-4 text-slate-400" /> {project.owner || "No owner"}
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-slate-400" /> {formatDate(project.startDate)} → {formatDate(project.targetEndDate)}
            </div>
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-slate-400" /> Forecast {formatDate(metrics.forecastFinish)}
              {metrics.slipDays > 0 ? <Badge tone="red">+{metrics.slipDays}d</Badge> : null}
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>{metrics.percentComplete}% of the work is done</span>
              <span>{metrics.percentPlanned}% should be done by today</span>
            </div>
            <ProgressBar value={metrics.percentComplete} label="Project progress" />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Tasks" value={metrics.total} />
            <Stat label="Done" value={metrics.done} tone="text-emerald-700" />
            <Stat label="Overdue" value={metrics.overdue} tone={metrics.overdue ? "text-red-600" : undefined} />
            <Stat label="Blocked" value={metrics.blocked} tone={metrics.blocked ? "text-amber-600" : undefined} />
            <Stat label="Due in 7 days" value={metrics.dueSoon} />
            <Stat label="Unassigned" value={metrics.unassigned} />
            <Stat label="Schedule index" value={metrics.spi ?? "—"} tone={metrics.spi !== null && metrics.spi < 0.92 ? "text-amber-600" : undefined} />
            <Stat label="Sprints · docs · reports" value={`${sprintCount} · ${docCount} · ${reportCount}`} />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Schedule index = work done ÷ work planned by today. 1.0 is on plan; below 0.9 is behind.
          </p>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader title="Milestones" subtitle="Key dates" />
            <ul className="space-y-1 px-5 py-3 text-sm">
              {milestones.length === 0 ? (
                <li className="text-slate-500">No milestones yet. Tick "Milestone" on a task in the Schedule.</li>
              ) : (
                milestones.slice(0, 8).map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-2">
                    <span className={cx("truncate", isDoneStatus(task.status) ? "text-slate-400 line-through" : "text-slate-800")}>
                      ◆ {task.title}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">{formatDate(task.plannedStart || task.plannedEnd)}</span>
                  </li>
                ))
              )}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Workload" subtitle="Open tasks per person" />
            <ul className="space-y-2 px-5 py-3 text-sm">
              {workload.length === 0 ? (
                <li className="text-slate-500">No open tasks.</li>
              ) : (
                workload.map((entry) => (
                  <li key={entry.owner} className="flex items-center justify-between gap-2">
                    <span className={cx("truncate", entry.owner === "Unassigned" ? "italic text-slate-400" : "text-slate-800")}>{entry.owner}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs">
                      <Badge>{entry.open} open</Badge>
                      {entry.overdue ? <Badge tone="red">{entry.overdue} late</Badge> : null}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </Card>
        </div>
      </div>
      <AiInsightCard scope="project" projectId={project.id} />
    </div>
  );
}

export default function PlannerPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const projects = usePlannerStore((state) => state.projects);
  const tasks = usePlannerStore((state) => state.tasks);
  const sprints = usePlannerStore((state) => state.sprints);
  const weeklyReports = usePlannerStore((state) => state.weeklyReports);
  const projectDocuments = usePlannerStore((state) => state.projectDocuments);
  const plannerSettings = usePlannerStore((state) => state.plannerSettings);
  const baselineSnapshots = usePlannerStore((state) => state.baselineSnapshots);
  const actions = usePlannerStore.getState();
  const loadCloudReportsAndDocuments = usePlannerStore((state) => state.loadCloudReportsAndDocuments);
  const openQuickTask = useUiStore((state) => state.openQuickTask);
  const openNewProject = useUiStore((state) => state.openNewProject);

  const requestedProjectId = searchParams.get("projectId") || "";
  const selectedProjectId = projects.some((project) => project.id === requestedProjectId) ? requestedProjectId : "";
  const tabParam = searchParams.get("tab") || "";
  const activeTab = PLANNER_TABS.some((tab) => tab.key === tabParam)
    ? tabParam
    : selectedProjectId
    ? "overview"
    : "schedule";
  const focusedTaskId = searchParams.get("taskId") || "";

  const [selectedRelationshipTaskId, setSelectedRelationshipTaskId] = useState("");
  const [editingProject, setEditingProject] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadCloudReportsAndDocuments().catch((error) => {
        console.error("Failed to load reports/documents:", error);
      });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [loadCloudReportsAndDocuments]);

  function updateParams(changes) {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setSearchParams(next, { replace: true });
  }

  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;

  const filteredTasks = useMemo(
    () => (selectedProjectId ? tasks.filter((task) => task.projectId === selectedProjectId) : tasks),
    [tasks, selectedProjectId]
  );
  const filteredSprints = useMemo(
    () => (selectedProjectId ? sprints.filter((sprint) => sprint.projectId === selectedProjectId) : sprints),
    [sprints, selectedProjectId]
  );
  const filteredWeeklyReports = useMemo(
    () => (selectedProjectId ? weeklyReports.filter((report) => report.projectId === selectedProjectId) : weeklyReports),
    [weeklyReports, selectedProjectId]
  );
  const filteredProjectDocuments = useMemo(
    () => (selectedProjectId ? projectDocuments.filter((doc) => doc.projectId === selectedProjectId) : projectDocuments),
    [projectDocuments, selectedProjectId]
  );

  const today = todayIso();
  const metrics = useMemo(
    () => (selectedProject ? computeProjectMetrics(selectedProject, tasks, today) : null),
    [selectedProject, tasks, today]
  );

  const schedulingMode = plannerSettings?.schedulingMode || "manual";

  const riskSummary = useMemo(
    () => (activeTab === "schedule" ? getProjectRiskSummary(filteredTasks) : null),
    [activeTab, filteredTasks]
  );
  const conflicts = useMemo(
    () => (activeTab === "schedule" ? getDependencyConflicts(filteredTasks) : []),
    [activeTab, filteredTasks]
  );
  const relationship = useMemo(
    () => (activeTab === "resources" ? getTaskRelationships(selectedRelationshipTaskId, filteredTasks) : null),
    [activeTab, selectedRelationshipTaskId, filteredTasks]
  );
  const dependencyGraph = useMemo(
    () =>
      activeTab === "reports"
        ? getDependencyGraphStarter(filteredTasks)
        : { nodes: [], edges: [], starters: [], missingDependencies: [] },
    [activeTab, filteredTasks]
  );

  function mergeBackIntoAllTasks(updatedFilteredTasks) {
    if (!selectedProjectId) {
      actions.bulkReplaceTasks(updatedFilteredTasks);
      return;
    }
    const updatedMap = Object.fromEntries(updatedFilteredTasks.map((task) => [task.id, task]));
    actions.bulkReplaceTasks(tasks.map((task) => updatedMap[task.id] || task));
  }

  function handleRecalculateSchedule() {
    const recalculated = recalculateMsProjectSchedule(
      filteredTasks.map((task) => ({
        ...task,
        isManualLocked: schedulingMode === "manual" ? Boolean(task.isManualLocked) : false,
      }))
    );
    mergeBackIntoAllTasks(recalculated);
    notify.success("Dates recalculated from durations and dependencies.");
  }

  const currentTab = PLANNER_TABS.find((tab) => tab.key === activeTab);

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="No projects yet"
        description="The planner shows the tasks of your projects. Create one, or import an existing plan."
      >
        <Button variant="primary" onClick={openNewProject}>Create a project</Button>
        <Link to="/data" className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Import a file
        </Link>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <label htmlFor="planner-project" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Project
          </label>
          <select
            id="planner-project"
            value={selectedProjectId}
            onChange={(event) => updateParams({ projectId: event.target.value, taskId: "" })}
            className={cx(inputClass, "h-11 w-full max-w-md text-base font-semibold")}
          >
            <option value="">All projects ({tasks.length} tasks)</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {metrics ? <Badge tone={HEALTH_TONE[metrics.health.level]}>{metrics.health.label}</Badge> : null}
          <span className="text-xs text-slate-500">Changes save automatically</span>
          <Link
            to={`/assistant${selectedProjectId ? `?projectId=${encodeURIComponent(selectedProjectId)}` : ""}`}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 text-sm font-semibold text-white shadow-sm hover:from-violet-700 hover:to-indigo-700"
          >
            <Sparkles className="h-4 w-4" /> Ask Claude
          </Link>
          <Link
            to="/data"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <ArrowRightLeft className="h-4 w-4" /> Import / Export
          </Link>
          <Button variant="primary" icon={ListPlus} onClick={() => openQuickTask(selectedProjectId)} data-testid="add-task">
            Add task
          </Button>
        </div>
      </div>

      <div className="sticky top-0 z-20 -mx-1 bg-slate-50/95 px-1 pb-1 pt-1 backdrop-blur lg:top-0">
        <nav aria-label="Planner views" className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          <div className="flex min-w-max gap-1" role="tablist">
            {PLANNER_TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => updateParams({ tab: tab.key, taskId: "" })}
                  className={cx(
                    "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
                    active ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <tab.icon className="h-4 w-4" aria-hidden />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>
        <p className="mt-2 px-1 text-xs text-slate-500" data-testid="tab-hint">
          {currentTab?.hint}
          {!selectedProjectId && ["schedule", "board", "timeline", "resources"].includes(activeTab)
            ? " Showing all projects; pick one above to focus."
            : ""}
        </p>
      </div>

      {activeTab === "overview" ? (
        selectedProject ? (
          <OverviewTab
            project={selectedProject}
            metrics={metrics}
            tasks={filteredTasks}
            onEdit={() => setEditingProject(true)}
            sprintCount={filteredSprints.length}
            docCount={filteredProjectDocuments.length}
            reportCount={filteredWeeklyReports.length}
          />
        ) : (
          <SelectProjectNotice what="Project overviews" />
        )
      ) : null}

      <Suspense fallback={<TabLoading />}>
        {activeTab === "schedule" ? (
          <div className="space-y-3">
            {riskSummary ? <PlannerRiskSummary summary={riskSummary} /> : null}
            <PlannerScheduleAssistPanel
              tasks={filteredTasks}
              conflicts={conflicts}
              schedulingMode={schedulingMode}
              onChangeMode={(mode) => {
                actions.setSchedulingMode(mode);
                notify.info(`Scheduling mode: ${mode}.`);
              }}
              onRecalculate={handleRecalculateSchedule}
              onSelectConflictTask={(taskId) => updateParams({ taskId })}
            />
            <PlannerScheduleTable
              tasks={filteredTasks}
              sprints={filteredSprints}
              onAddTask={actions.addTask}
              onUpdateTask={actions.updateTask}
              onDeleteTask={actions.deleteTask}
              onBulkUpdate={mergeBackIntoAllTasks}
              selectedProjectId={selectedProjectId}
              focusedTaskId={focusedTaskId}
              onRecalculate={handleRecalculateSchedule}
            />
          </div>
        ) : null}

        {activeTab === "board" ? <PlannerBoardView tasks={filteredTasks} onUpdateTask={actions.updateTask} /> : null}

        {activeTab === "timeline" ? <PlannerTimelineView tasks={filteredTasks} onUpdateTask={actions.updateTask} /> : null}

        {activeTab === "sprints" ? (
          selectedProjectId ? (
            <div className="space-y-3">
              <CollapsibleCard title="Create a sprint" subtitle="A sprint is a fixed period (often 2 weeks) with a goal." defaultOpen={filteredSprints.length === 0}>
                <SprintForm projectId={selectedProjectId} onSubmit={actions.addSprint} />
              </CollapsibleCard>
              <SprintList sprints={filteredSprints} onDelete={actions.deleteSprint} onUpdate={actions.updateSprint} />
            </div>
          ) : (
            <SelectProjectNotice what="Sprints" />
          )
        ) : null}

        {activeTab === "resources" ? (
          <div className="grid gap-3 xl:grid-cols-2">
            <PlannerResourcesView tasks={filteredTasks} />
            <PlannerRelationshipPanel
              tasks={filteredTasks}
              selectedTaskId={selectedRelationshipTaskId}
              onChangeTask={setSelectedRelationshipTaskId}
              relationship={relationship}
            />
          </div>
        ) : null}

        {activeTab === "documents" ? (
          <ProjectDocumentsView
            selectedProject={selectedProject}
            projectDocuments={filteredProjectDocuments}
            onAddDocument={actions.addProjectDocument}
            onUpdateDocument={actions.updateProjectDocument}
            onDeleteDocument={actions.deleteProjectDocument}
          />
        ) : null}

        {activeTab === "reports" ? (
          <div className="space-y-3">
            <WeeklyCeoReportView
              selectedProject={selectedProject}
              tasks={filteredTasks}
              weeklyReports={filteredWeeklyReports}
              onAddReport={actions.addWeeklyReport}
              onUpdateReport={actions.updateWeeklyReport}
              onDeleteReport={actions.deleteWeeklyReport}
            />
            <CollapsibleCard title="Baselines" subtitle="Save a snapshot of the plan, then compare how dates have moved since.">
              <PlannerBaselinePanel
                selectedProjectId={selectedProjectId}
                tasks={filteredTasks}
                snapshots={baselineSnapshots}
                onCreateSnapshot={actions.createBaselineSnapshot}
              />
            </CollapsibleCard>
            <PlannerReportsView tasks={filteredTasks} />
            <div className="grid gap-3 xl:grid-cols-2">
              <PlannerDependencyGraphStarter graph={dependencyGraph} />
              <PlannerDependencyGraphVisual graph={dependencyGraph} />
            </div>
          </div>
        ) : null}
      </Suspense>

      <Modal open={editingProject && Boolean(selectedProject)} onClose={() => setEditingProject(false)} title="Edit project">
        {selectedProject ? (
          <ProjectForm
            initialValue={selectedProject}
            submitLabel="Save changes"
            onCancel={() => setEditingProject(false)}
            onSubmit={(values) => {
              actions.updateProject(selectedProject.id, values);
              setEditingProject(false);
              notify.success("Project updated.");
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}
