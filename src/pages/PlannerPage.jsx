import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  CircleUserRound,
  FolderKanban,
  KanbanSquare,
  ListTodo,
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
import PlannerDataTools from "../components/planner/PlannerDataTools";
import PlannerBaselinePanel from "../components/planner/PlannerBaselinePanel";
import PlannerDependencyGraphVisual from "../components/planner/PlannerDependencyGraphVisual";
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
  { key: "reports", label: "Reports" },
];

function MetricCard({ label, value, subtitle }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
        {value}
      </div>
      {subtitle ? <div className="mt-0.5 text-[11px] text-slate-500">{subtitle}</div> : null}
    </div>
  );
}

function CompactStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
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
        Sprint creation and sprint management work only for a single selected project.
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
  } = usePlannerStore();

  const projectIdFromUrl = searchParams.get("projectId") || "";
  const tabFromUrl = searchParams.get("tab") || "";

  const [activeTab, setActiveTab] = useState(tabFromUrl || "schedule");
  const [selectedProjectId, setSelectedProjectId] = useState(projectIdFromUrl);
  const [selectedRelationshipTaskId, setSelectedRelationshipTaskId] = useState("");
  const [focusedTaskId, setFocusedTaskId] = useState("");

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

  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find((project) => project.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  const summary = summarizeProject(filteredTasks);
  const conflicts = useMemo(() => getDependencyConflicts(filteredTasks), [filteredTasks]);
  const dependencyGraph = useMemo(() => getDependencyGraphStarter(filteredTasks), [filteredTasks]);
  const relationship = useMemo(
    () => getTaskRelationships(selectedRelationshipTaskId, filteredTasks),
    [selectedRelationshipTaskId, filteredTasks]
  );
  const riskSummary = useMemo(() => getProjectRiskSummary(filteredTasks), [filteredTasks]);

  const schedulingMode = plannerSettings?.schedulingMode || "manual";

  const counts = useMemo(() => {
    const notStarted = filteredTasks.filter((t) => t.status === "Not Started").length;
    const inProgress = filteredTasks.filter((t) => t.status === "In Progress").length;
    const done = filteredTasks.filter((t) => t.status === "Done").length;
    const blocked = filteredTasks.filter((t) => t.status === "Blocked").length;
    const owners = [...new Set(filteredTasks.map((t) => t.owner).filter(Boolean))].length;

    return { notStarted, inProgress, done, blocked, owners };
  }, [filteredTasks]);

  const exportData = useMemo(
    () => ({
      projects,
      tasks,
      plannerSettings,
      baselineSnapshots,
      sprints,
    }),
    [projects, tasks, plannerSettings, baselineSnapshots, sprints]
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
        isManualLocked: schedulingMode === "manual" ? Boolean(task.isManualLocked) : false,
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

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-4xl">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              {selectedProject ? selectedProject.name : "Project Planner"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {selectedProject
                ? "Single workspace for project overview, schedule, execution, sprints, and reporting."
                : "Compact scheduling, execution, sprint management, and dependency control across all projects."}
            </p>
          </div>

          <div className="grid gap-1 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 xl:min-w-[240px]">
            <div>
              <span className="font-medium text-slate-800">View:</span>{" "}
              {selectedProject ? selectedProject.name : "All Projects"}
            </div>
            <div>
              <span className="font-medium text-slate-800">Tasks:</span> {filteredTasks.length}
            </div>
            <div>
              <span className="font-medium text-slate-800">Sprints:</span> {filteredSprints.length}
            </div>
            <div>
              <span className="font-medium text-slate-800">Mode:</span> {schedulingMode}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1fr_auto]">
        <PlannerProjectFilter
          projects={projects}
          selectedProjectId={selectedProjectId}
          onChange={setSelectedProjectId}
        />
        <PlannerDataTools
          exportData={exportData}
          onImportData={importPlannerData}
        />
      </section>

      <PlannerRiskSummary summary={riskSummary} />

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Planned" value={`${summary.plannedAvg}%`} />
        <MetricCard label="Actual" value={`${summary.actualAvg}%`} />
        <MetricCard label="Variance" value={`${summary.variance}%`} />
        <MetricCard label="In Progress" value={counts.inProgress} />
        <MetricCard label="Completed" value={counts.done} subtitle={`Blocked: ${counts.blocked}`} />
        <MetricCard label="Not Started" value={counts.notStarted} />
      </section>

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
                    <span className="font-medium text-slate-800">Target End:</span>{" "}
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

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <CompactStat label="Sprints" value={filteredSprints.length} />
            <CompactStat label="Not Started" value={counts.notStarted} />
            <CompactStat label="In Progress" value={counts.inProgress} />
            <CompactStat label="Done / Blocked" value={`${counts.done} / ${counts.blocked}`} />
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

      {activeTab === "reports" && (
        <div className="space-y-3">
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