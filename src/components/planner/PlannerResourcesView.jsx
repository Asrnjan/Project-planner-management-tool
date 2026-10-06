import { Fragment, useMemo, useState } from "react";
import { ChevronRight, Users } from "lucide-react";
import { Avatar, Badge, Panel, StatusBadge, cx } from "../../ui/primitives";
import { isDoneStatus } from "../../domain/vocabulary";

function formatDate(iso) {
  if (!iso) return "—";
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Workload per person: one row each, expandable to their tasks. */
export default function PlannerResourcesView({ tasks }) {
  const [expanded, setExpanded] = useState({});
  const today = new Date().toISOString().slice(0, 10);

  const people = useMemo(() => {
    const parents = new Set(tasks.map((task) => task.parentTaskId).filter(Boolean));
    const groups = new Map();
    tasks
      .filter((task) => !parents.has(task.id) && !task.isSummaryTask)
      .forEach((task) => {
        const owners = String(task.owner || "").split(",").map((name) => name.trim()).filter(Boolean);
        (owners.length ? owners : ["Unassigned"]).forEach((owner) => {
          if (!groups.has(owner)) groups.set(owner, []);
          groups.get(owner).push(task);
        });
      });

    return [...groups.entries()]
      .map(([owner, items]) => {
        const open = items.filter((task) => !isDoneStatus(task.status));
        const nextDue = open
          .map((task) => task.plannedEnd || task.plannedStart)
          .filter(Boolean)
          .sort()[0];
        return {
          owner,
          items: [...items].sort((a, b) => String(a.plannedEnd || "9").localeCompare(String(b.plannedEnd || "9"))),
          open: open.length,
          inProgress: items.filter((task) => task.status === "In Progress").length,
          done: items.length - open.length,
          blocked: items.filter((task) => task.status === "Blocked").length,
          overdue: open.filter((task) => (task.plannedEnd || task.plannedStart) && (task.plannedEnd || task.plannedStart) < today).length,
          avg: items.length ? Math.round(items.reduce((sum, task) => sum + Number(task.actualProgress || 0), 0) / items.length) : 0,
          nextDue,
        };
      })
      .sort((a, b) => (a.owner === "Unassigned") - (b.owner === "Unassigned") || b.open - a.open);
  }, [tasks, today]);

  const maxOpen = Math.max(1, ...people.map((person) => person.open));

  return (
    <Panel title="Team workload" subtitle="Open work per person. Click a row to see their tasks." icon={Users}>
      {people.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">No tasks yet. Assign owners to see workload here.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-xs font-medium text-slate-500">
                <th scope="col" className="px-4 py-2.5">Person</th>
                <th scope="col" className="px-4 py-2.5">Open work</th>
                <th scope="col" className="px-4 py-2.5 text-right">In progress</th>
                <th scope="col" className="px-4 py-2.5 text-right">Done</th>
                <th scope="col" className="px-4 py-2.5 text-right">Overdue</th>
                <th scope="col" className="px-4 py-2.5 text-right">Blocked</th>
                <th scope="col" className="px-4 py-2.5">Next due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {people.map((person) => {
                const isOpen = Boolean(expanded[person.owner]);
                return (
                  <Fragment key={person.owner}>
                    <tr
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => setExpanded((prev) => ({ ...prev, [person.owner]: !prev[person.owner] }))}
                      aria-expanded={isOpen}
                    >
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2.5">
                          <ChevronRight className={cx("h-4 w-4 text-slate-400 transition", isOpen ? "rotate-90" : "")} aria-hidden />
                          <Avatar name={person.owner} size="sm" />
                          <span className={cx("font-medium", person.owner === "Unassigned" ? "italic text-slate-500" : "text-slate-900")}>
                            {person.owner}
                          </span>
                        </span>
                      </td>
                      <td className="w-56 px-4 py-2.5">
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <span className="block h-full rounded-full bg-indigo-500" style={{ width: `${(person.open / maxOpen) * 100}%` }} />
                          </span>
                          <span className="w-16 text-right text-xs text-slate-600">{person.open} open</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{person.inProgress}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{person.done}</td>
                      <td className={cx("px-4 py-2.5 text-right tabular-nums", person.overdue ? "font-semibold text-red-600" : "")}>{person.overdue}</td>
                      <td className={cx("px-4 py-2.5 text-right tabular-nums", person.blocked ? "font-semibold text-amber-600" : "")}>{person.blocked}</td>
                      <td className="px-4 py-2.5 text-slate-600">{formatDate(person.nextDue)}</td>
                    </tr>
                    {isOpen ? (
                      <tr>
                        <td colSpan={7} className="bg-slate-50/60 px-4 py-2">
                          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                            {person.items.map((task) => (
                              <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                                <span className="min-w-0 flex-1 truncate text-slate-800">{task.title}</span>
                                <span className="flex items-center gap-3 text-xs text-slate-500">
                                  <span>
                                    {formatDate(task.plannedStart)} – {formatDate(task.plannedEnd)}
                                  </span>
                                  <span className="w-10 text-right">{Number(task.actualProgress || 0)}%</span>
                                  <StatusBadge status={task.status} />
                                </span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {people.some((person) => person.owner === "Unassigned") ? (
        <div className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">
          <Badge tone="amber">Tip</Badge> Unassigned tasks have no owner; assign them in the Schedule or Board.
        </div>
      ) : null}
    </Panel>
  );
}
