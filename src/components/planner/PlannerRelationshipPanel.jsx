import { ArrowRight, Link2 } from "lucide-react";
import { Panel, StatusBadge, cx, inputClass } from "../../ui/primitives";

function TaskList({ title, items, empty }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 text-xs font-medium text-slate-500">{title}</div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((task) => (
            <li key={task.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <span className="truncate text-slate-800">{task.title}</span>
              <StatusBadge status={task.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PlannerRelationshipPanel({ tasks, selectedTaskId, onChangeTask, relationship }) {
  return (
    <Panel
      title="Dependencies"
      subtitle="Pick a task to see what it waits for and what waits for it."
      icon={Link2}
      actions={
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <span className="sr-only">Task</span>
          <select
            value={selectedTaskId}
            onChange={(event) => onChangeTask(event.target.value)}
            className={cx(inputClass, "w-72 py-1.5")}
          >
            <option value="">Choose a task…</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
        </label>
      }
    >
      {!relationship?.current ? (
        <p className="px-5 py-6 text-sm text-slate-500">Choose a task above.</p>
      ) : (
        <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-start">
          <TaskList title="Waits for (predecessors)" items={relationship.predecessors} empty="Nothing; it can start any time." />
          <div className="flex shrink-0 flex-col items-center gap-1 self-center px-2 text-center">
            <ArrowRight className="hidden h-4 w-4 text-slate-300 lg:block" aria-hidden />
            <div className="rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800">{relationship.current.title}</div>
            <ArrowRight className="hidden h-4 w-4 text-slate-300 lg:block" aria-hidden />
          </div>
          <TaskList title="Blocks (successors)" items={relationship.successors} empty="No tasks depend on it." />
        </div>
      )}
    </Panel>
  );
}
