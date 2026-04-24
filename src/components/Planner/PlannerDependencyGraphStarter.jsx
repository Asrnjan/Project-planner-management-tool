function StatusBadge({ status }) {
  const styles =
    status === "Done"
      ? "bg-green-100 text-green-700"
      : status === "In Progress"
      ? "bg-blue-100 text-blue-700"
      : status === "Blocked"
      ? "bg-red-100 text-red-700"
      : "bg-slate-100 text-slate-700";

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>
      {status}
    </span>
  );
}

export default function PlannerDependencyGraphStarter({ graph }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Dependency Graph Starter</h3>
      <p className="mt-1 text-sm text-slate-500">
        Simple upstream and downstream relationship view by planner row number.
      </p>

      <div className="mt-4 overflow-auto rounded-xl border">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b text-left text-slate-600">
              <th className="px-4 py-3">Row</th>
              <th className="px-4 py-3">Task</th>
              <th className="px-4 py-3">Predecessors</th>
              <th className="px-4 py-3">Successors</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {graph.map((item) => (
              <tr key={item.id} className="border-b bg-white">
                <td className="px-4 py-3">{item.row}</td>
                <td className="px-4 py-3 text-slate-900">{item.title}</td>
                <td className="px-4 py-3">
                  {item.predecessors.length ? item.predecessors.join(", ") : "-"}
                </td>
                <td className="px-4 py-3">
                  {item.successors.length ? item.successors.join(", ") : "-"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}