import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  CircleUserRound,
  FileText,
  FolderKanban,
  KanbanSquare,
  ListTodo,
  Milestone,
} from "lucide-react";

import { usePlannerStore } from "../store/usePlannerStore";

import PlannerScheduleTable from "../components/planner/PlannerScheduleTable";
import PlannerBoardView from "../components/planner/PlannerBoardView";
import PlannerTimelineView from "../components/gantt/TimelineView";
import PlannerTabs from "../components/planner/PlannerTabs";
import PlannerResourcesView from "../components/planner/PlannerResourcesView";
import PlannerReportsView from "../components/planner/PlannerReportsView";
import PlannerScheduleAssistPanel from "../components/planner/PlannerScheduleAssistPanel";
import PlannerProjectFilter from "../components/planner/PlannerProjectFilter";
import PlannerDependencyGraphStarter from "../components/planner/PlannerDependencyGraphStarter";
import PlannerRelationshipPanel from "../components/planner/PlannerRelationshipPanel";
import PlannerRiskSummary from "../components/planner/PlannerRiskSummary";
import PlannerBaselinePanel from "../components/planner/PlannerBaselinePanel";
import PlannerDependencyGraphVisual from "../components/planner/PlannerDependencyGraphVisual";
import PlannerUnifiedDataTools from "../components/planner/PlannerUnifiedDataTools";

import WeeklyCeoReportView from "../components/reports/WeeklyCeoReportView";
import ProjectDocumentsView from "../components/documents/ProjectDocumentsView";

import CollapsibleCard from "../components/common/AppCollapsibleCard";
import SprintForm from "../components/sprints/SprintForm";
import SprintList from "../components/sprints/SprintList";

import { summarizeProject } from "../utils/calculations";
import {
  getDependencyConflicts,
  getDependencyGraphStarter,
  getTaskRelationships,
  getProjectRiskSummary,
  recalculateMsProjectSchedule,
} from "../utils/planner";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "schedule", label: "Schedule" },
  { key: "board", label: "Board" },
  { key: "timeline", label: "Timeline" },
  { key: "sprints", label: "Sprints" },
  { key: "resources", label: "Resources" },
  { key: "documents", label: "Documents" },
  { key: "reports", label: "Reports" },
];

const emptyProjectEditForm = {
  name: "",
  owner: "",
  status: "Active",
  startDate: "",
  targetEndDate: "",
  description: "",
};

function getFormattedNow() {
  return new Date().toLocaleString();
}

function MetricCard({ label, value, subtitle }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
        {value}
      </div>

      {subtitle ? (
        <div className="mt-0.5 text-[11px] text-slate-500">{subtitle}</div>
      ) : null}
    </div>
  );
}

function CompactStat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </div>

      <div className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
        {value}
      </div>
    </div>
  );
}

function SaveStatusCard({ lastUpdatedAt }) {
  return (
    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <div className="text-sm font-semibold text-emerald-900">
            All changes are saved automatically
          </div>

          <div className="mt-1 text-xs leading-5 text-emerald-700">
            Project, task, sprint, report, and document changes are saved in the
            background.
          </div>

          <div className="mt-2 text-[11px] font-medium text-emerald-700">
            Last activity: {lastUpdatedAt}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyProjectNotice() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        <ListTodo className="h-3.5 w-3.5" />
        Sprints
      </div>

      <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
        Select a project to manage sprints
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        Sprint creation and sprint management work only for a single selected
        project.
      </p>
    </div>
  );
}

function ProjectEditForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  isSaving = false,
}) {
  function handleChange(event) {
    const { name, value } = event.target;

    onChange((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-blue-200 bg-blue-50 p-4"
    >
      <div className="mb-4">
        <h3 className="text-base font-semibold tracking-tight text-slate-900">
          Edit Project Details
        </h3>

        <p className="mt-1 text-xs text-slate-600">
          Update the imported or created project information here.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Project Name
          </label>

          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Project name"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Owner
          </label>

          <input
            name="owner"
            value={form.owner}
            onChange={handleChange}
            placeholder="Project owner"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Status
          </label>

          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400"
          >
            <option value="Planned">Planned</option>
            <option value="Active">Active</option>
            <option value="On Track">On Track</option>
            <option value="At Risk">At Risk</option>
            <option value="Delayed">Delayed</option>
            <option value="On Hold">On Hold</option>
            <option value="Completed">Completed</option>
            <option value="Archived">Archived</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Start Date
          </label>

          <input
            name="startDate"
            type="date"
            value={form.startDate}
            onChange={handleChange}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Target End Date
          </label>

          <input
            name="targetEndDate"
            type="date"
            value={form.targetEndDate}
            onChange={handleChange}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400"
          />
        </div>

        <div className="xl:col-span-2">
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Description
          </label>

          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Project description"
            className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={isSaving}
          className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save Project Details"}
        </button>
      </div>
    </form>
  );
}

export default function PlannerPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    tasks,
    projects,
    sprints,
    weeklyReports,
    projectDocuments,
    loadCloudReportsAndDocuments,

    addTask,
    updateTask,
    deleteTask,
    bulkReplaceTasks,

    plannerSettings,
    setSchedulingMode,

    baselineSnapshots,
    createBaselineSnapshot,
    importPlannerData,

    updateProject,

    addSprint,
    updateSprint,
    deleteSprint,

    addWeeklyReport,
    updateWeeklyReport,
    deleteWeeklyReport,

    addProjectDocument,
    updateProjectDocument,
    deleteProjectDocument,
  } = usePlannerStore();

  const projectIdFromUrl = searchParams.get("projectId") || "";
  const tabFromUrl = searchParams.get("tab") || "";

  const [activeTab, setActiveTab] = useState(tabFromUrl || "schedule");
  const [selectedProjectId, setSelectedProjectId] = useState(projectIdFromUrl);
  const [selectedRelationshipTaskId, setSelectedRelationshipTaskId] =
    useState("");
  const [focusedTaskId, setFocusedTaskId] = useState("");

  const [isProjectEditOpen, setIsProjectEditOpen] = useState(false);
  const [projectEditForm, setProjectEditForm] = useState(emptyProjectEditForm);
  const [projectEditSaving, setProjectEditSaving] = useState(false);

  const [statusMessage, setStatusMessage] = useState("");
  const [statusError, setStatusError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(getFormattedNow());

  useEffect(() => {
    loadCloudReportsAndDocuments()
      .then((result) => {
        console.log("Loaded reports/documents from Supabase:", result);
      })
      .catch((error) => {
        console.error("Failed to load reports/documents from Supabase:", error);
        setStatusError(error.message);
      });
  }, [loadCloudReportsAndDocuments]);

  useEffect(() => {
    setSelectedProjectId(projectIdFromUrl);
  }, [projectIdFromUrl]);

  useEffect(() => {
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);

    if (selectedProjectId) {
      next.set("projectId", selectedProjectId);
    } else {
      next.delete("projectId");
    }

    if (activeTab && activeTab !== "schedule") {
      next.set("tab", activeTab);
    } else {
      next.delete("tab");
    }

    const currentString = searchParams.toString();
    const nextString = next.toString();

    if (currentString !== nextString) {
      setSearchParams(next, { replace: true });
    }
  }, [selectedProjectId, activeTab, searchParams, setSearchParams]);

  const filteredTasks = useMemo(() => {
    if (!selectedProjectId) return tasks;
    return tasks.filter((task) => task.projectId === selectedProjectId);
  }, [tasks, selectedProjectId]);

  const filteredSprints = useMemo(() => {
    if (!selectedProjectId) return sprints;
    return sprints.filter((sprint) => sprint.projectId === selectedProjectId);
  }, [sprints, selectedProjectId]);

  const filteredWeeklyReports = useMemo(() => {
    if (!selectedProjectId) return weeklyReports;
    return weeklyReports.filter(
      (report) => report.projectId === selectedProjectId
    );
  }, [weeklyReports, selectedProjectId]);

  const filteredProjectDocuments = useMemo(() => {
    if (!selectedProjectId) return projectDocuments;
    return projectDocuments.filter(
      (document) => document.projectId === selectedProjectId
    );
  }, [projectDocuments, selectedProjectId]);

  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find((project) => project.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (!selectedProject) {
      setProjectEditForm(emptyProjectEditForm);
      setIsProjectEditOpen(false);
      return;
    }

    setProjectEditForm({
      name: selectedProject.name || "",
      owner: selectedProject.owner || "",
      status: selectedProject.status || "Active",
      startDate: selectedProject.startDate || "",
      targetEndDate: selectedProject.targetEndDate || "",
      description: selectedProject.description || "",
    });
  }, [selectedProject?.id]);

  useEffect(() => {
    setLastUpdatedAt(getFormattedNow());
  }, [projects, tasks, sprints, weeklyReports, projectDocuments]);

  const summary = summarizeProject(filteredTasks);

  const conflicts = useMemo(
    () => getDependencyConflicts(filteredTasks),
    [filteredTasks]
  );

  const dependencyGraph = useMemo(
    () => getDependencyGraphStarter(filteredTasks),
    [filteredTasks]
  );

  const relationship = useMemo(
    () => getTaskRelationships(selectedRelationshipTaskId, filteredTasks),
    [selectedRelationshipTaskId, filteredTasks]
  );

  const riskSummary = useMemo(
    () => getProjectRiskSummary(filteredTasks),
    [filteredTasks]
  );

  const schedulingMode = plannerSettings?.schedulingMode || "manual";

  const counts = useMemo(() => {
    const notStarted = filteredTasks.filter(
      (task) => task.status === "Not Started"
    ).length;

    const inProgress = filteredTasks.filter(
      (task) => task.status === "In Progress"
    ).length;

    const done = filteredTasks.filter((task) => task.status === "Done").length;

    const blocked = filteredTasks.filter(
      (task) => task.status === "Blocked"
    ).length;

    const owners = [
      ...new Set(filteredTasks.map((task) => task.owner).filter(Boolean)),
    ].length;

    const milestoneCount = filteredTasks.filter(
      (task) => task.isMilestone
    ).length;

    return {
      notStarted,
      inProgress,
      done,
      blocked,
      owners,
      milestoneCount,
    };
  }, [filteredTasks]);

  const exportData = useMemo(
    () => ({
      projects,
      tasks,
      plannerSettings,
      baselineSnapshots,
      sprints,
      weeklyReports,
      projectDocuments,
    }),
    [
      projects,
      tasks,
      plannerSettings,
      baselineSnapshots,
      sprints,
      weeklyReports,
      projectDocuments,
    ]
  );

  function mergeBackIntoAllTasks(updatedFilteredTasks) {
    if (!selectedProjectId) {
      bulkReplaceTasks(updatedFilteredTasks);
      return;
    }

    const updatedMap = Object.fromEntries(
      updatedFilteredTasks.map((task) => [task.id, task])
    );

    const merged = tasks.map((task) =>
      updatedMap[task.id] ? updatedMap[task.id] : task
    );

    bulkReplaceTasks(merged);
  }

  function handleRecalculateSchedule() {
    const recalculatedFiltered = recalculateMsProjectSchedule(
      filteredTasks.map((task) => ({
        ...task,
        isManualLocked:
          schedulingMode === "manual" ? Boolean(task.isManualLocked) : false,
      }))
    );

    mergeBackIntoAllTasks(recalculatedFiltered);
    setStatusMessage("Schedule recalculated and saved automatically.");
    setStatusError("");
  }

  function handleGridBulkUpdate(updatedFilteredTasks) {
    mergeBackIntoAllTasks(updatedFilteredTasks);
    setStatusMessage("Schedule changes saved automatically.");
    setStatusError("");
  }

  function handleChangeMode(mode) {
    setSchedulingMode(mode);
    setStatusMessage("Scheduling mode updated and saved automatically.");
    setStatusError("");
  }

  function handleSelectConflictTask(taskId) {
    setActiveTab("schedule");
    setFocusedTaskId(taskId);
  }

  async function handleProjectDetailsSave() {
    if (!selectedProject) {
      setStatusError("Please select a project before editing project details.");
      return;
    }

    if (!projectEditForm.name.trim()) {
      setStatusError("Project name cannot be empty.");
      return;
    }

    try {
      setProjectEditSaving(true);
      setStatusMessage("");
      setStatusError("");

      const updatedProject = {
        ...selectedProject,
        name: projectEditForm.name.trim(),
        owner: projectEditForm.owner.trim(),
        status: projectEditForm.status || "Active",
        startDate: projectEditForm.startDate || "",
        targetEndDate: projectEditForm.targetEndDate || "",
        description: projectEditForm.description.trim(),
        updatedAt: new Date().toISOString(),
      };

      updateProject(selectedProject.id, updatedProject);

      setLastUpdatedAt(getFormattedNow());
      setIsProjectEditOpen(false);
      setStatusMessage("Project details updated and saved automatically.");
    } catch (error) {
      setStatusError(error.message || "Failed to update project details.");
    } finally {
      setProjectEditSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              <FolderKanban className="h-3.5 w-3.5" />
              Planner Control Center
            </div>

            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              {selectedProject ? selectedProject.name : "Project Planner"}
            </h2>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              {selectedProject
                ? "Single workspace for project overview, schedule, execution, sprints, milestones, dependencies, documents, and reports."
                : "Manage schedule, execution, milestones, dependencies, documents, reports, and data exchange across all projects."}
            </p>

            <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  View
                </div>
                <div className="mt-1 truncate font-semibold text-slate-900">
                  {selectedProject ? selectedProject.name : "All Projects"}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Tasks
                </div>
                <div className="mt-1 font-semibold text-slate-900">
                  {filteredTasks.length}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Sprints
                </div>
                <div className="mt-1 font-semibold text-slate-900">
                  {filteredSprints.length}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Mode
                </div>
                <div className="mt-1 capitalize font-semibold text-slate-900">
                  {schedulingMode}
                </div>
              </div>
            </div>
          </div>

          <SaveStatusCard lastUpdatedAt={lastUpdatedAt} />
        </div>

        {statusMessage ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            {statusMessage}
          </div>
        ) : null}

        {statusError ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {statusError}
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 xl:grid-cols-[1fr_1.2fr]">
        <PlannerProjectFilter
          projects={projects}
          selectedProjectId={selectedProjectId}
          onChange={setSelectedProjectId}
        />

        <PlannerUnifiedDataTools
          exportData={exportData}
          onImportData={importPlannerData}
        />
      </section>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Planned" value={`${summary.plannedAvg}%`} />
        <MetricCard label="Actual" value={`${summary.actualAvg}%`} />
        <MetricCard label="Variance" value={`${summary.variance}%`} />
        <MetricCard label="In Progress" value={counts.inProgress} />
        <MetricCard
          label="Completed"
          value={counts.done}
          subtitle={`Blocked: ${counts.blocked}`}
        />
        <MetricCard label="Not Started" value={counts.notStarted} />
      </section>

      <PlannerRiskSummary summary={riskSummary} />

      <PlannerTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" && (
        <div className="space-y-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {selectedProject ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                        <FolderKanban className="h-5 w-5" />
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                          {selectedProject.name}
                        </h3>

                        <div className="mt-1 text-xs text-slate-500">
                          Project workspace overview
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                      {selectedProject.description || "No description added."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsProjectEditOpen((prev) => !prev)}
                    className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                  >
                    {isProjectEditOpen
                      ? "Close Edit"
                      : "Edit Project Details"}
                  </button>
                </div>

                {isProjectEditOpen ? (
                  <ProjectEditForm
                    form={projectEditForm}
                    onChange={setProjectEditForm}
                    onSubmit={handleProjectDetailsSave}
                    onCancel={() => {
                      setProjectEditForm({
                        name: selectedProject.name || "",
                        owner: selectedProject.owner || "",
                        status: selectedProject.status || "Active",
                        startDate: selectedProject.startDate || "",
                        targetEndDate: selectedProject.targetEndDate || "",
                        description: selectedProject.description || "",
                      });
                      setIsProjectEditOpen(false);
                    }}
                    isSaving={projectEditSaving}
                  />
                ) : null}

                <div className="grid gap-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                  <div className="inline-flex items-center gap-2">
                    <CircleUserRound className="h-4 w-4" />
                    <span className="font-medium text-slate-800">Owner:</span>
                    {selectedProject.owner || "Not assigned"}
                  </div>

                  <div className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <span className="font-medium text-slate-800">Start:</span>
                    {selectedProject.startDate || "-"}
                  </div>

                  <div className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <span className="font-medium text-slate-800">
                      Target End:
                    </span>
                    {selectedProject.targetEndDate || "-"}
                  </div>

                  <div className="inline-flex items-center gap-2">
                    <KanbanSquare className="h-4 w-4" />
                    <span className="font-medium text-slate-800">Status:</span>
                    {selectedProject.status || "Active"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-600">
                Select a project to see and edit its project-level overview
                here.
              </div>
            )}
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <CompactStat
              label="Sprints"
              value={filteredSprints.length}
              icon={ListTodo}
            />
            <CompactStat label="Not Started" value={counts.notStarted} />
            <CompactStat label="In Progress" value={counts.inProgress} />
            <CompactStat
              label="Done / Blocked"
              value={`${counts.done} / ${counts.blocked}`}
            />
            <CompactStat
              label="Milestones"
              value={counts.milestoneCount}
              icon={Milestone}
            />
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <CompactStat
              label="Project Documents"
              value={filteredProjectDocuments.length}
              icon={FileText}
            />
            <CompactStat
              label="Weekly Manager Reports"
              value={filteredWeeklyReports.length}
              icon={FileText}
            />
          </section>
        </div>
      )}

      {activeTab === "schedule" && (
        <div className="space-y-3">
          <PlannerScheduleAssistPanel
            tasks={filteredTasks}
            conflicts={conflicts}
            schedulingMode={schedulingMode}
            onChangeMode={handleChangeMode}
            onRecalculate={handleRecalculateSchedule}
            onSelectConflictTask={handleSelectConflictTask}
          />

          <PlannerScheduleTable
            tasks={filteredTasks}
            sprints={filteredSprints}
            onAddTask={addTask}
            onDeleteTask={deleteTask}
            onBulkUpdate={handleGridBulkUpdate}
            selectedProjectId={selectedProjectId}
            focusedTaskId={focusedTaskId}
            onRecalculate={handleRecalculateSchedule}
          />
        </div>
      )}

      {activeTab === "board" && (
        <PlannerBoardView tasks={filteredTasks} onUpdateTask={updateTask} />
      )}

      {activeTab === "timeline" && (
        <PlannerTimelineView tasks={filteredTasks} onUpdateTask={updateTask} />
      )}

      {activeTab === "sprints" && (
        <div className="space-y-3">
          {!selectedProjectId ? (
            <EmptyProjectNotice />
          ) : (
            <>
              <CollapsibleCard
                title="Create Sprint"
                subtitle="Open only when you want to add a new sprint."
                defaultOpen={false}
              >
                <SprintForm projectId={selectedProjectId} onSubmit={addSprint} />
              </CollapsibleCard>

              <SprintList
                sprints={filteredSprints}
                onDelete={deleteSprint}
                onUpdate={updateSprint}
              />
            </>
          )}
        </div>
      )}

      {activeTab === "resources" && (
        <div className="grid gap-3 xl:grid-cols-2">
          <PlannerResourcesView tasks={filteredTasks} />

          <PlannerRelationshipPanel
            tasks={filteredTasks}
            selectedTaskId={selectedRelationshipTaskId}
            onChangeTask={setSelectedRelationshipTaskId}
            relationship={relationship}
          />
        </div>
      )}

      {activeTab === "documents" && (
        <ProjectDocumentsView
          selectedProject={selectedProject}
          projectDocuments={filteredProjectDocuments}
          onAddDocument={addProjectDocument}
          onUpdateDocument={updateProjectDocument}
          onDeleteDocument={deleteProjectDocument}
        />
      )}

      {activeTab === "reports" && (
        <div className="space-y-3">
          <WeeklyCeoReportView
            selectedProject={selectedProject}
            tasks={filteredTasks}
            weeklyReports={filteredWeeklyReports}
            onAddReport={addWeeklyReport}
            onUpdateReport={updateWeeklyReport}
            onDeleteReport={deleteWeeklyReport}
          />

          <CollapsibleCard
            title="Baseline Snapshots"
            subtitle="Open to create or compare baselines."
            defaultOpen={false}
          >
            <PlannerBaselinePanel
              selectedProjectId={selectedProjectId}
              tasks={filteredTasks}
              snapshots={baselineSnapshots}
              onCreateSnapshot={createBaselineSnapshot}
            />
          </CollapsibleCard>

          <PlannerReportsView tasks={filteredTasks} />

          <div className="grid gap-3 xl:grid-cols-2">
            <PlannerDependencyGraphStarter graph={dependencyGraph} />
            <PlannerDependencyGraphVisual graph={dependencyGraph} />
          </div>
        </div>
      )}
    </div>
  );
}