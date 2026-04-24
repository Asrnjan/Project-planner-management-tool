function getTypeClass(type) {
  switch (type) {
    case "dependency":
      return "bg-amber-100 text-amber-700";
    case "sequence":
      return "bg-red-100 text-red-700";
    case "blocked-chain":
      return "bg-indigo-100 text-indigo-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function PlannerWarningsPanel({ warnings }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Planner Warnings</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
          {warnings.length}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {warnings.length === 0 ? (
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            No planner warnings detected.
          </div>
        ) : (
          warnings.map((warning, index) => (
            <div key={`${warning.taskId}-${index}`} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs font-medium text-slate-900">{warning.taskTitle}</div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getTypeClass(
                    warning.type
                  )}`}
                >
                  {warning.type}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-600">{warning.message}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}