import { useMemo, useState } from "react";
import { usePlannerStore } from "../store/usePlannerStore";
import PlannerScheduleTable from "../components/planner/PlannerScheduleTable";
import PlannerBoardView from "../components/planner/PlannerBoardView";
import PlannerTimelineView from "../components/planner/PlannerTimelineView";
import PlannerTabs from "../components/planner/PlannerTabs";
import { summarizeProject } from "../utils/calculations";

const TABS = [
  { key: "schedule", label: "Schedule" },
  { key: "board", label: "Board" },
  { key: "timeline", label: "Timeline" },
  { key: "resources", label: "Resources" },
  { key: "reports", label: "Reports" },
];

function MetricCard({ label, value, subtitle }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
      {subtitle ? <div className="mt-1 text-xs text-slate-500">{subtitle}</div> : null}
    </div>
  );
}

export default function PlannerPage() {
  const { tasks, projects, updateTask } = usePlannerStore();
  const [activeTab, setActiveTab] = useState("schedule");

  const summary = summarizeProject(tasks);

  const counts = useMemo(() => {
    const notStarted = tasks.filter((t) => t.status === "Not Started").length;
    const inProgress = tasks.filter((t) => t.status === "In Progress").length;
    const done = tasks.filter((t) => t.status === "Done").length;
    const blocked = tasks.filter((t) => t.status === "Blocked").length;
    const owners = [...new Set(tasks.map((t) => t.owner).filter(Boolean))].length;

    return { notStarted, inProgress, done, blocked, owners };
  }, [tasks]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Project Planner Module</h2>
            <p className="mt-2 max-w-3xl text-slate-600">
              Manage schedules, boards, and timelines in one dedicated planner workspace.
            </p>
          </div>

          <div className="grid gap-2 text-sm text-slate-600">
            <div>
              <span className="font-medium text-slate-800">Projects:</span> {projects.length}
            </div>
            <div>
              <span className="font-medium text-slate-800">Tasks:</span> {tasks.length}
            </div>
            <div>
              <span className="font-medium text-slate-800">Owners:</span> {counts.owners}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Planned Progress" value={`${summary.plannedAvg}%`} />
        <MetricCard label="Actual Progress" value={`${summary.actualAvg}%`} />
        <MetricCard label="Variance" value={`${summary.variance}%`} />
        <MetricCard label="In Progress" value={counts.inProgress} />
        <MetricCard label="Completed" value={counts.done} subtitle={`Blocked: ${counts.blocked}`} />
        <MetricCard label="Not Started" value={counts.notStarted} />
      </div>

      <PlannerTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "schedule" && (
        <PlannerScheduleTable tasks={tasks} onUpdate={updateTask} />
      )}

      {activeTab === "board" && <PlannerBoardView tasks={tasks} />}

      {activeTab === "timeline" && (
        <PlannerTimelineView tasks={tasks} onUpdateTask={updateTask} />
      )}

      {activeTab === "resources" && (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Resources</h3>
          <p className="mt-2 text-sm text-slate-500">
            Resource allocation and workload view will be added in PP-2B.
          </p>
        </div>
      )}

      {activeTab === "reports" && (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Reports</h3>
          <p className="mt-2 text-sm text-slate-500">
            Planner reports and variance insights will be added in PP-2B.
          </p>
        </div>
      )}
    </div>
  );
}