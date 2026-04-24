export default function PlannerDependencyGraphVisual({ graph }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Dependency Graph Visual</h3>
      <p className="mt-1 text-sm text-slate-500">
        Simple visual dependency map showing upstream and downstream rows.
      </p>

      <div className="mt-4 space-y-4">
        {graph.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            No tasks available.
          </div>
        ) : (
          graph.map((item) => (
            <div key={item.id} className="rounded-xl border bg-slate-50 p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="text-xs text-slate-500">Row {item.row}</div>
                  <div className="mt-1 font-semibold text-slate-900">{item.title}</div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:min-w-[420px]">
                  <div className="rounded-lg bg-white p-3">
                    <div className="text-xs text-slate-500">Predecessors</div>
                    <div className="mt-2 text-sm text-slate-900">
                      {item.predecessors.length ? item.predecessors.join("  ←  ") : "-"}
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-3">
                    <div className="text-xs text-slate-500">Successors</div>
                    <div className="mt-2 text-sm text-slate-900">
                      {item.successors.length ? item.successors.join("  →  ") : "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}