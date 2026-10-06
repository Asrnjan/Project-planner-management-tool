import { useMemo } from "react";
import { differenceInCalendarDays, parseISO, isValid } from "date-fns";
import { isTaskOverdue, summarizeProject } from "../../utils/calculations";
import { getCriticalPathStarter, getPlannerWarnings } from "../../utils/planner";
import { Badge, DataTable, Panel, StatStrip, StatusBadge } from "../../ui/primitives";

function safeDate(value) {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function ListPanel({ title, items, emptyText, renderItem, tone }) {
  return (
    <Panel
      title={title}
      actions={<Badge tone={items.length ? tone : "slate"}>{items.length}</Badge>}
    >
      {items.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">{emptyText}</p>
      ) : (
        <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">{items.map(renderItem)}</ul>
      )}
    </Panel>
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

  const row = (task, detail) => (
    <li key={task.id} className="px-5 py-2.5">
      <div className="truncate text-sm font-medium text-slate-800">{task.title}</div>
      <div className="text-xs text-slate-500">{detail}</div>
    </li>
  );

  return (
    <div className="space-y-4">
      <StatStrip
        items={[
          { label: "Planned progress", value: `${summary.plannedAvg}%` },
          { label: "Actual progress", value: `${summary.actualAvg}%` },
          { label: "Variance", value: `${summary.variance > 0 ? "+" : ""}${summary.variance}%`, tone: summary.variance < 0 ? "text-red-600" : "text-emerald-700" },
          { label: "Overdue", value: insights.overdueTasks.length, tone: insights.overdueTasks.length ? "text-red-600" : undefined },
          { label: "Blocked", value: insights.blockedTasks.length },
          { label: "Critical path", value: insights.criticalTasks.length },
          { label: "Warnings", value: warnings.length, hint: `${insights.totalDelayDays} days of delay` },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <ListPanel
          title="Critical path"
          tone="red"
          items={insights.criticalTasks}
          emptyText="No critical path yet. Add dependencies between tasks."
          renderItem={(task) => row(task, `${task.plannedStart || "—"} → ${task.plannedEnd || "—"}`)}
        />
        <ListPanel
          title="Overdue"
          tone="red"
          items={insights.overdueTasks}
          emptyText="Nothing is overdue."
          renderItem={(task) => row(task, `Was due ${task.plannedEnd || "—"}`)}
        />
        <ListPanel
          title="Moved since baseline"
          tone="blue"
          items={insights.baselineShifted}
          emptyText="No dates have moved since the baseline."
          renderItem={(task) =>
            row(task, `${task.baselineStart || "—"} → ${task.baselineEnd || "—"} was planned; now ${task.plannedStart || "—"} → ${task.plannedEnd || "—"}`)
          }
        />
      </div>

      <Panel title="All tasks" subtitle="Plan against actual for every task">
        <DataTable
          rows={tasks}
          columns={[
            { key: "title", label: "Task", className: "font-medium text-slate-900" },
            { key: "owner", label: "Owner", render: (task) => task.owner || "—" },
            { key: "status", label: "Status", render: (task) => <StatusBadge status={task.status} /> },
            { key: "plannedProgress", label: "Planned", className: "text-right tabular-nums", render: (task) => `${task.plannedProgress || 0}%` },
            { key: "actualProgress", label: "Actual", className: "text-right tabular-nums", render: (task) => `${task.actualProgress || 0}%` },
            { key: "dates", label: "Dates", className: "whitespace-nowrap", render: (task) => `${task.plannedStart || "—"} → ${task.plannedEnd || "—"}` },
            { key: "baseline", label: "Baseline", className: "whitespace-nowrap text-slate-500", render: (task) => (task.baselineStart ? `${task.baselineStart} → ${task.baselineEnd || "—"}` : "—") },
            { key: "critical", label: "Critical", render: (task) => (criticalIds.includes(task.id) ? <Badge tone="red">Yes</Badge> : <span className="text-slate-300">—</span>) },
          ]}
        />
      </Panel>
    </div>
  );
}
