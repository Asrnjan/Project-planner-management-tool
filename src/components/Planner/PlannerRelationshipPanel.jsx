import { Link2 } from "lucide-react";

function MiniCard({ title, items, empty }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mt-2 space-y-2">
        {items.length === 0 ? (
          <div className="text-xs text-slate-500">{empty}</div>
        ) : (
          items.map((task) => (
            <div key={task.id} className="rounded-2xl bg-white p-2.5 text-xs shadow-sm">
              <div className="font-medium text-slate-900">{task.title}</div>
              <div className="mt-0.5 text-slate-500">{task.status || "-"}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function PlannerRelationshipPanel({
  tasks,
  selectedTaskId,
  onChangeTask,
  relationship,
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            <Link2 className="h-3.5 w-3.5" />
            Task Relationships
          </div>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
            Predecessors and successors
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Inspect the dependency chain for a selected task.
          </p>
        </div>

        <div className="w-full lg:w-80">
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Selected Task
          </label>
          <select
            value={selectedTaskId}
            onChange={(e) => onChangeTask(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-slate-400"
          >
            <option value="">Select a task</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!relationship.current ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          Select a task to view its relationships.
        </div>
      ) : (
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-3">
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Current Task
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {relationship.current.title}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Status: {relationship.current.status || "-"}
            </div>
          </div>

          <MiniCard
            title="Predecessors"
            items={relationship.predecessors}
            empty="No predecessors"
          />

          <MiniCard
            title="Successors"
            items={relationship.successors}
            empty="No successors"
          />
        </div>
      )}
    </div>
  );
}