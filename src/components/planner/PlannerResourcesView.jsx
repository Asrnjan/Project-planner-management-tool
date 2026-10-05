import { useMemo } from "react";
import { CircleUserRound } from "lucide-react";

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold tracking-tight text-slate-900">
        {value}
      </div>
    </div>
  );
}

function ResourceCard({ owner, items }) {
  const totalTasks = items.length;
  const done = items.filter((task) => task.status === "Done").length;
  const inProgress = items.filter((task) => task.status === "In Progress").length;
  const blocked = items.filter((task) => task.status === "Blocked").length;
  const avgActual = totalTasks
    ? Math.round(items.reduce((sum, task) => sum + Number(task.actualProgress || 0), 0) / totalTasks)
    : 0;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <CircleUserRound className="h-4 w-4" />
          </div>
          <div className="truncate text-sm font-semibold text-slate-900">{owner}</div>
        </div>

        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600">
          {totalTasks} tasks
        </span>
      </div>

      <div className="mt-3 grid gap-2 grid-cols-4">
        <Metric label="Done" value={done} />
        <Metric label="Progress" value={inProgress} />
        <Metric label="Blocked" value={blocked} />
        <Metric label="Avg %" value={`${avgActual}%`} />
      </div>

      <div className="mt-3 overflow-auto rounded-2xl border border-slate-200">
        <table className="min-w-full border-collapse text-xs">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200 text-left text-slate-600">
              <th className="px-3 py-2 font-medium">Task</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Actual</th>
            </tr>
          </thead>
          <tbody>
            {items.map((task) => (
              <tr key={task.id} className="border-b border-slate-200 bg-white">
                <td className="px-3 py-2 text-slate-900">{task.title}</td>
                <td className="px-3 py-2 text-slate-600">{task.status}</td>
                <td className="px-3 py-2 text-slate-600">
                  {task.plannedStart || "-"} to {task.plannedEnd || "-"}
                </td>
                <td className="px-3 py-2 text-slate-600">{task.actualProgress || 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PlannerResourcesView({ tasks }) {
  const grouped = useMemo(() => {
    const groups = {};

    tasks.forEach((task) => {
      const owner = task.owner?.trim() || "Unassigned";
      if (!groups[owner]) groups[owner] = [];
      groups[owner].push(task);
    });

    return Object.entries(groups)
      .map(([owner, items]) => ({ owner, items }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [tasks]);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">Resources</h3>
        <p className="mt-1 text-sm text-slate-500">
          Compact workload and ownership view by assignee.
        </p>
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
          No resources found. Add task owners to see workload here.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {grouped.map((group) => (
            <ResourceCard key={group.owner} owner={group.owner} items={group.items} />
          ))}
        </div>
      )}
    </div>
  );
}