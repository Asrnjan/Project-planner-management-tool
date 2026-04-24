import { useMemo } from "react";
import { differenceInCalendarDays, parseISO, isValid } from "date-fns";
import { isTaskOverdue, summarizeProject } from "../../utils/calculations";
import { getCriticalPathStarter, getPlannerWarnings } from "../../utils/planner";

function safeDate(value) {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function Metric({ label, value, subtitle }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
        {value}
      </div>
      {subtitle ? <div className="mt-1 text-[11px] text-slate-500">{subtitle}</div> : null}
    </div>
  );
}

function ListPanel({ title, items, tone = "slate", emptyText, renderItem }) {
  const toneClass =
    tone === "red"
      ? "bg-red-50 border-red-200"
      : tone === "blue"
      ? "bg-blue-50 border-blue-200"
      : "bg-slate-50 border-slate-200";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">{emptyText}</p>
        ) : (
          items.map(renderItem)
        )}
      </div>
    </div>
  );
}

export default function PlannerReportsView({ tasks }) {
  const summary = summarizeProject(tasks);
  const criticalIds = useMemo(() => getCriticalPathStarter(tasks), [tasks]);
  const warnings = useMemo(() => getPlannerWarnings(tasks), [tasks]);

  const insights = useMemo(() => {
    const overdueTasks = tasks.filter((task) => isTaskOverdue(task));
    const blockedTasks = tasks.filter((task) => task.status === "Blocked");

    const baselineShifted = tasks.filter((task) => {
      if (!task.baselineStart || !task.plannedStart) return false;
      return task.baselineStart !== task.plannedStart || task.baselineEnd !== task.plannedEnd;
    });

    const delayedActuals = tasks.filter((task) => {
      const plannedEnd = safeDate(task.plannedEnd);
      const actualEnd = safeDate(task.actualEnd);
      if (!plannedEnd || !actualEnd) return false;
      return actualEnd > plannedEnd;
    });

    const totalDelayDays = delayedActuals.reduce((sum, task) => {
      const plannedEnd = safeDate(task.plannedEnd);
      const actualEnd = safeDate(task.actualEnd);
      if (!plannedEnd || !actualEnd) return sum;
      return sum + differenceInCalendarDays(actualEnd, plannedEnd);
    }, 0);

    const criticalTasks = tasks.filter((task) => criticalIds.includes(task.id));

    return {
      overdueTasks,
      blockedTasks,
      baselineShifted,
      delayedActuals,
      totalDelayDays,
      criticalTasks,
    };
  }, [tasks, criticalIds]);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">Reports</h3>
        <p className="mt-1 text-sm text-slate-500">
          Compact reporting for delay, critical path, warnings, and baseline movement.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <Metric label="Planned" value={`${summary.plannedAvg}%`} />
        <Metric label="Actual" value={`${summary.actualAvg}%`} />
        <Metric label="Variance" value={`${summary.variance}%`} />
        <Metric label="Overdue" value={insights.overdueTasks.length} />
        <Metric label="Blocked" value={insights.blockedTasks.length} />
        <Metric label="Critical" value={insights.criticalTasks.length} />
        <Metric
          label="Warnings"
          value={warnings.length}
          subtitle={`${insights.totalDelayDays} delay days`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ListPanel
          title="Critical Path"
          items={insights.criticalTasks}
          tone="red"
          emptyText="No critical tasks detected yet."
          renderItem={(task) => (
            <div key={task.id} className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs">
              <div className="font-medium text-slate-900">{task.title}</div>
              <div className="mt-1 text-slate-600">
                {task.plannedStart || "-"} to {task.plannedEnd || "-"}
              </div>
            </div>
          )}
        />

        <ListPanel
          title="Overdue Tasks"
          items={insights.overdueTasks}
          tone="red"
          emptyText="No overdue tasks."
          renderItem={(task) => (
            <div key={task.id} className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs">
              <div className="font-medium text-slate-900">{task.title}</div>
              <div className="mt-1 text-slate-600">End: {task.plannedEnd || "-"}</div>
            </div>
          )}
        />

        <ListPanel
          title="Baseline Changes"
          items={insights.baselineShifted}
          tone="blue"
          emptyText="No baseline shifts detected."
          renderItem={(task) => (
            <div key={task.id} className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs">
              <div className="font-medium text-slate-900">{task.title}</div>
              <div className="mt-1 text-slate-600">
                Base: {task.baselineStart || "-"} to {task.baselineEnd || "-"}
              </div>
              <div className="mt-1 text-slate-600">
                Current: {task.plannedStart || "-"} to {task.plannedEnd || "-"}
              </div>
            </div>
          )}
        />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="mb-3 text-sm font-semibold text-slate-900">Detailed Report</h4>

        <div className="overflow-auto rounded-2xl border border-slate-200">
          <table className="min-w-full border-collapse text-xs">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="px-3 py-2 font-medium">Task</th>
                <th className="px-3 py-2 font-medium">Owner</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Plan</th>
                <th className="px-3 py-2 font-medium">Actual</th>
                <th className="px-3 py-2 font-medium">Baseline</th>
                <th className="px-3 py-2 font-medium">Current</th>
                <th className="px-3 py-2 font-medium">Critical</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-b border-slate-200 bg-white">
                  <td className="px-3 py-2 text-slate-900">{task.title}</td>
                  <td className="px-3 py-2 text-slate-600">{task.owner || "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{task.status || "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{task.plannedProgress || 0}%</td>
                  <td className="px-3 py-2 text-slate-600">{task.actualProgress || 0}%</td>
                  <td className="px-3 py-2 text-slate-600">
                    {task.baselineStart || "-"} to {task.baselineEnd || "-"}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {task.plannedStart || "-"} to {task.plannedEnd || "-"}
                  </td>
                  <td className="px-3 py-2">
                    {criticalIds.includes(task.id) ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                        Yes
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}