import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  CircleUserRound,
  Cloud,
  FileText,
  FolderKanban,
  KanbanSquare,
  ListTodo,
  Milestone,
  RefreshCw,
  Save,
  Trash2,
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

import {
  saveProject,
  loadProjects,
  deleteProject,
} from "../services/projectService";

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

function formatCloudDate(value) {
  if (!value) return "Not saved yet";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not saved yet";
  }

  return date.toLocaleString();
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

  const [cloudProjects, setCloudProjects] = useState([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudMessage, setCloudMessage] = useState("");
  const [cloudError, setCloudError] = useState("");
  const [activeCloudProjectId, setActiveCloudProjectId] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState("");

  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState("");
  const [showCloudBackups, setShowCloudBackups] = useState(false);

  const autoSaveTimerRef = useRef(null);
  const lastSavedSnapshotRef = useRef("");

  useEffect(() => {
    fetchCloudProjects();

    loadCloudReportsAndDocuments()
      .then((result) => {
        console.log("Loaded reports/documents from Supabase:", result);
      })
      .catch((error) => {
        console.error("Failed to load reports/documents from Supabase:", error);
        setCloudError(error.message);
      });
  }, []);

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

  const cloudSnapshot = useMemo(
    () =>
      JSON.stringify({
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

  useEffect(() => {
    if (!lastSavedSnapshotRef.current) {
      lastSavedSnapshotRef.current = cloudSnapshot;
      return;
    }

    if (cloudSnapshot !== lastSavedSnapshotRef.current) {
      setHasUnsavedChanges(true);
    }
  }, [cloudSnapshot]);

  useEffect(() => {
    if (!autoSaveEnabled) {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      return;
    }

    autoSaveTimerRef.current = setInterval(() => {
      if (!activeCloudProjectId) {
        setCloudError(
          "Auto Save needs an active cloud save. Please click Create Cloud Save once first."
        );
        return;
      }

      if (!hasUnsavedChanges) {
        return;
      }

      handleAutoSaveCloudProject();
    }, 60000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [autoSaveEnabled, activeCloudProjectId, hasUnsavedChanges, cloudSnapshot]);

  function getFreshPlannerData() {
    const fresh = usePlannerStore.getState();

    return {
      projects: Array.isArray(fresh.projects) ? fresh.projects : [],
      tasks: Array.isArray(fresh.tasks) ? fresh.tasks : [],
      sprints: Array.isArray(fresh.sprints) ? fresh.sprints : [],
      plannerSettings:
        fresh.plannerSettings && typeof fresh.plannerSettings === "object"
          ? fresh.plannerSettings
          : { schedulingMode: "manual" },
      baselineSnapshots: Array.isArray(fresh.baselineSnapshots)
        ? fresh.baselineSnapshots
        : [],
      weeklyReports: Array.isArray(fresh.weeklyReports)
        ? fresh.weeklyReports
        : [],
      projectDocuments: Array.isArray(fresh.projectDocuments)
        ? fresh.projectDocuments
        : [],
    };
  }

  function makeSnapshotFromFreshData(freshData) {
    return JSON.stringify({
      projects: freshData.projects,
      tasks: freshData.tasks,
      plannerSettings: freshData.plannerSettings,
      baselineSnapshots: freshData.baselineSnapshots,
      sprints: freshData.sprints,
      weeklyReports: freshData.weeklyReports,
      projectDocuments: freshData.projectDocuments,
    });
  }

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
  }

  function handleGridBulkUpdate(updatedFilteredTasks) {
    mergeBackIntoAllTasks(updatedFilteredTasks);
  }

  function handleChangeMode(mode) {
    setSchedulingMode(mode);
  }

  function handleSelectConflictTask(taskId) {
    setActiveTab("schedule");
    setFocusedTaskId(taskId);
  }

  async function fetchCloudProjects() {
    try {
      setCloudLoading(true);
      setCloudMessage("");
      setCloudError("");

      const data = await loadProjects();
      setCloudProjects(data || []);
    } catch (error) {
      setCloudError(error.message);
    } finally {
      setCloudLoading(false);
    }
  }

  async function handleSaveCloudProject() {
    try {
      setCloudLoading(true);
      setCloudMessage("");
      setCloudError("");

      const freshData = getFreshPlannerData();

      const projectName = selectedProject
        ? selectedProject.name
        : "Planner Workspace";

      const projectDescription = selectedProject
        ? selectedProject.description || ""
        : "All projects planner workspace";

      const savedAt = new Date().toISOString();

      const payload = {
        id: activeCloudProjectId || undefined,
        name: projectName,
        description: projectDescription,

        projects: freshData.projects,
        tasks: freshData.tasks,
        plannerSettings: freshData.plannerSettings,
        baselineSnapshots: freshData.baselineSnapshots,
        sprints: freshData.sprints,
        weeklyReports: freshData.weeklyReports,
        projectDocuments: freshData.projectDocuments,

        savedAt,
        saveType: selectedProject ? "single_project_view" : "full_workspace",
        selectedProjectId: selectedProjectId || "",
      };

      console.log("Saving to Supabase payload:", payload);
      console.log("Weekly Reports Count:", payload.weeklyReports.length);
      console.log("Project Documents Count:", payload.projectDocuments.length);

      const saved = await saveProject(payload);

      setActiveCloudProjectId(saved.id);
      setLastSavedAt(savedAt);
      setHasUnsavedChanges(false);
      lastSavedSnapshotRef.current = makeSnapshotFromFreshData(freshData);

      await fetchCloudProjects();

      setCloudMessage("Planner data saved successfully.");
    } catch (error) {
      setCloudError(error.message);
    } finally {
      setCloudLoading(false);
    }
  }

  async function handleAutoSaveCloudProject() {
    try {
      if (!activeCloudProjectId) {
        setCloudError(
          "Auto Save needs an active cloud save. Please click Create Cloud Save once first."
        );
        return;
      }

      if (!hasUnsavedChanges) {
        return;
      }

      setCloudError("");

      const freshData = getFreshPlannerData();

      const projectName = selectedProject
        ? selectedProject.name
        : "Planner Workspace";

      const projectDescription = selectedProject
        ? selectedProject.description || ""
        : "All projects planner workspace";

      const savedAt = new Date().toISOString();

      const payload = {
        id: activeCloudProjectId,
        name: projectName,
        description: projectDescription,

        projects: freshData.projects,
        tasks: freshData.tasks,
        plannerSettings: freshData.plannerSettings,
        baselineSnapshots: freshData.baselineSnapshots,
        sprints: freshData.sprints,
        weeklyReports: freshData.weeklyReports,
        projectDocuments: freshData.projectDocuments,

        savedAt,
        saveType: selectedProject ? "single_project_view" : "full_workspace",
        selectedProjectId: selectedProjectId || "",
        autoSaved: true,
      };

      console.log("Auto saving to Supabase payload:", payload);
      console.log("Weekly Reports Count:", payload.weeklyReports.length);
      console.log("Project Documents Count:", payload.projectDocuments.length);

      const saved = await saveProject(payload);

      setActiveCloudProjectId(saved.id);
      setLastSavedAt(savedAt);
      setLastAutoSavedAt(savedAt);
      setHasUnsavedChanges(false);
      lastSavedSnapshotRef.current = makeSnapshotFromFreshData(freshData);

      await fetchCloudProjects();

      setCloudMessage("Auto-saved successfully.");
    } catch (error) {
      setCloudError(error.message);
    }
  }

  async function handleOpenCloudProject(project) {
    const confirmed = window.confirm(
      "Loading this cloud backup will replace your current local planner data. Do you want to continue?"
    );

    if (!confirmed) return;

    try {
      setCloudLoading(true);
      setCloudMessage("");
      setCloudError("");

      if (!project.project_data) {
        throw new Error("This saved project does not contain project_data.");
      }

      const restoredData = {
        projects: project.project_data.projects || [],
        tasks: project.project_data.tasks || [],
        plannerSettings: project.project_data.plannerSettings || {},
        baselineSnapshots: project.project_data.baselineSnapshots || [],
        sprints: project.project_data.sprints || [],
        weeklyReports: project.project_data.weeklyReports || [],
        projectDocuments: project.project_data.projectDocuments || [],
      };

      importPlannerData(restoredData);

      await loadCloudReportsAndDocuments();

      setActiveCloudProjectId(project.id);

      const loadedSavedAt =
        project.project_data.savedAt ||
        project.updated_at ||
        project.created_at ||
        "";

      setLastSavedAt(loadedSavedAt);
      setLastAutoSavedAt("");
      setHasUnsavedChanges(false);

      lastSavedSnapshotRef.current = JSON.stringify(restoredData);

      if (project.project_data.selectedProjectId) {
        setSelectedProjectId(project.project_data.selectedProjectId);
      }

      setCloudMessage("Planner backup loaded successfully.");
    } catch (error) {
      setCloudError(error.message);
    } finally {
      setCloudLoading(false);
    }
  }

  async function handleDeleteCloudProject(projectId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this cloud backup? This cannot be undone."
    );

    if (!confirmed) return;

    try {
      setCloudLoading(true);
      setCloudMessage("");
      setCloudError("");

      await deleteProject(projectId);

      if (activeCloudProjectId === projectId) {
        setActiveCloudProjectId("");
        setLastSavedAt("");
        setLastAutoSavedAt("");
        setHasUnsavedChanges(false);
        setAutoSaveEnabled(false);
      }

      await fetchCloudProjects();

      setCloudMessage("Cloud backup deleted successfully.");
    } catch (error) {
      setCloudError(error.message);
    } finally {
      setCloudLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
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
                : "Manage schedule, execution, milestones, dependencies, documents, reports, data exchange, and cloud sync across all projects."}
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

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                <Cloud className="h-3.5 w-3.5" />
                Cloud Sync
              </div>

              <span
                className={
                  hasUnsavedChanges
                    ? "rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-800"
                    : "rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-800"
                }
              >
                {hasUnsavedChanges ? "Unsaved" : "Saved"}
              </span>
            </div>

            <div className="mt-3 grid gap-2 text-xs text-slate-600">
              <div className="flex items-center justify-between gap-3">
                <span>Auto Save</span>
                <span className="font-semibold text-slate-900">
                  {autoSaveEnabled ? "ON" : "OFF"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span>Last Saved</span>
                <span className="max-w-[180px] truncate font-semibold text-slate-900">
                  {formatCloudDate(lastSavedAt)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span>Last Auto Save</span>
                <span className="max-w-[180px] truncate font-semibold text-slate-900">
                  {formatCloudDate(lastAutoSavedAt)}
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveCloudProject}
                disabled={cloudLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" />
                {cloudLoading
                  ? "Saving..."
                  : activeCloudProjectId
                  ? "Save Now"
                  : "Create Save"}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!activeCloudProjectId && !autoSaveEnabled) {
                    setCloudError(
                      "Please click Create Save once before enabling Auto Save."
                    );
                    return;
                  }

                  setAutoSaveEnabled((prev) => !prev);
                  setCloudMessage(
                    autoSaveEnabled
                      ? "Auto Save turned off."
                      : "Auto Save turned on. Changes will save every 60 seconds."
                  );
                  setCloudError("");
                }}
                className={
                  autoSaveEnabled
                    ? "rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                    : "rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                }
              >
                {autoSaveEnabled ? "Auto Save ON" : "Auto Save OFF"}
              </button>

              <button
                type="button"
                onClick={() => setShowCloudBackups((prev) => !prev)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                {showCloudBackups ? "Hide Backups" : "Backups"}
              </button>
            </div>
          </div>
        </div>

        {cloudMessage ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            {cloudMessage}
          </div>
        ) : null}

        {cloudError ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {cloudError}
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
              <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
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

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {selectedProject.description || "No description added."}
                  </p>
                </div>

                <div className="grid gap-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
                  <div className="inline-flex items-center gap-2">
                    <CircleUserRound className="h-4 w-4" />
                    <span className="font-medium text-slate-800">Owner:</span>{" "}
                    {selectedProject.owner || "Not assigned"}
                  </div>

                  <div className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <span className="font-medium text-slate-800">Start:</span>{" "}
                    {selectedProject.startDate || "-"}
                  </div>

                  <div className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <span className="font-medium text-slate-800">
                      Target End:
                    </span>{" "}
                    {selectedProject.targetEndDate || "-"}
                  </div>

                  <div className="inline-flex items-center gap-2">
                    <KanbanSquare className="h-4 w-4" />
                    <span className="font-medium text-slate-800">Status:</span>{" "}
                    {selectedProject.status || "Active"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-600">
                Select a project to see its project-level overview here.
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