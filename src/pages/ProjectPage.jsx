import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CircleUserRound,
  FolderTree,
  ClipboardList,
  KanbanSquare,
} from "lucide-react";
import { usePlannerStore } from "../store/usePlannerStore";
import SummaryCards from "../components/dashboard/SummaryCards";
import SprintForm from "../components/sprints/SprintForm";
import SprintList from "../components/sprints/SprintList";
import TaskForm from "../components/tasks/TaskForm";
import TaskTable from "../components/tasks/TaskTable";
import TimelineView from "../components/gantt/TimelineView";
import SectionTabs from "../components/layout/SectionTabs";
import CollapsibleCard from "../components/common/CollapsibleCard";
import { summarizeProject } from "../utils/calculations";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "planning", label: "Planning" },
  { key: "timeline", label: "Timeline" },
  { key: "tasks", label: "Tasks" },
  { key: "sprints", label: "Sprints" },
];

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

export default function ProjectPage() {
  const { projectId } = useParams();
  const [activeTab, setActiveTab] = useState("overview");

  const {
    projects,
    sprints,
    tasks,
    addSprint,
    updateSprint,
    deleteSprint,
    addTask,
    updateTask,
    deleteTask,
  } = usePlannerStore();

  const project = projects.find((p) => p.id === projectId);
  const projectSprints = sprints.filter((s) => s.projectId === projectId);
  const projectTasks = tasks.filter((t) => t.projectId === projectId);
  const summary = summarizeProject(projectTasks);

  const counts = useMemo(() => {
    return {
      notStarted: projectTasks.filter((t) => t.status === "Not Started").length,
      inProgress: projectTasks.filter((t) => t.status === "In Progress").length,
      done: projectTasks.filter((t) => t.status === "Done").length,
      blocked: projectTasks.filter((t) => t.status === "Blocked").length,
    };
  }, [projectTasks]);

  if (!project) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-slate-700">Project not found.</p>
        <Link to="/" className="mt-4 inline-flex items-center gap-2 text-sm text-slate-600 underline">
          <ArrowLeft className="h-4 w-4" />
          Go back
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Portfolio
            </Link>

            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              {project.name}
            </h2>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              {project.description || "No description added."}
            </p>
          </div>

          <div className="grid gap-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 xl:min-w-[280px]">
            <div className="inline-flex items-center gap-2">
              <CircleUserRound className="h-4 w-4" />
              <span className="font-medium text-slate-800">Owner:</span> {project.owner || "Not assigned"}
            </div>
            <div className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              <span className="font-medium text-slate-800">Start:</span> {project.startDate || "-"}
            </div>
            <div className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              <span className="font-medium text-slate-800">Target End:</span> {project.targetEndDate || "-"}
            </div>
            <div className="inline-flex items-center gap-2">
              <KanbanSquare className="h-4 w-4" />
              <span className="font-medium text-slate-800">Status:</span> {project.status || "Active"}
            </div>
          </div>
        </div>
      </section>

      <SectionTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" && (
        <div className="space-y-4">
          <SummaryCards summary={summary} />

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <CompactStat label="Sprints" value={projectSprints.length} />
            <CompactStat label="Not Started" value={counts.notStarted} />
            <CompactStat label="In Progress" value={counts.inProgress} />
            <CompactStat label="Done / Blocked" value={`${counts.done} / ${counts.blocked}`} />
          </section>
        </div>
      )}

      {activeTab === "planning" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <CollapsibleCard
            title="Add Sprint"
            subtitle="Open only when needed."
            defaultOpen={false}
          >
            <SprintForm projectId={projectId} onSubmit={addSprint} />
          </CollapsibleCard>

          <CollapsibleCard
            title="Add Task"
            subtitle="Open only when needed."
            defaultOpen={false}
          >
            <TaskForm
              projectId={projectId}
              sprints={projectSprints}
              tasks={projectTasks}
              onSubmit={addTask}
            />
          </CollapsibleCard>
        </div>
      )}

      {activeTab === "timeline" && (
        <TimelineView tasks={projectTasks} onUpdateTask={updateTask} />
      )}

      {activeTab === "tasks" && (
        <TaskTable
          tasks={projectTasks}
          sprints={projectSprints}
          onDelete={deleteTask}
          onUpdate={updateTask}
        />
      )}

      {activeTab === "sprints" && (
        <SprintList
          sprints={projectSprints}
          onDelete={deleteSprint}
          onUpdate={updateSprint}
        />
      )}
    </div>
  );
}