import { GitBranch } from "lucide-react";
import { DataTable, Panel, StatusBadge } from "../../ui/primitives";

/** Every task with what it waits for and what it unblocks, by name. */
export default function PlannerDependencyGraphStarter({ graph }) {
  const rows = Array.isArray(graph) ? graph : [];
  const titleByRow = Object.fromEntries(rows.map((item) => [item.row, item.title]));
  const names = (list) =>
    list.length ? (
      <span className="text-slate-700">{list.map((row) => `${row}. ${titleByRow[row] || ""}`).join(", ")}</span>
    ) : (
      <span className="text-slate-300">—</span>
    );

  return (
    <Panel title="Dependency map" subtitle="Numbers are schedule row numbers." icon={GitBranch}>
      <DataTable
        rows={rows}
        empty="No tasks yet."
        columns={[
          { key: "row", label: "#", className: "w-10 tabular-nums text-slate-400" },
          { key: "title", label: "Task", className: "font-medium text-slate-900" },
          { key: "predecessors", label: "Waits for", render: (item) => names(item.predecessors) },
          { key: "successors", label: "Unblocks", render: (item) => names(item.successors) },
          { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status} /> },
        ]}
      />
    </Panel>
  );
}
