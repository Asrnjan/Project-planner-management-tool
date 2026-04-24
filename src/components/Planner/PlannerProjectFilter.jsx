import { Filter } from "lucide-react";

export default function PlannerProjectFilter({
  projects,
  selectedProjectId,
  onChange,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        <Filter className="h-3.5 w-3.5" />
        Project Filter
      </div>

      <div className="grid gap-2 md:grid-cols-[120px_minmax(0,1fr)] md:items-center">
        <div className="text-xs font-medium text-slate-600">Planning view</div>
        <select
          value={selectedProjectId}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-400"
        >
          <option value="">All Projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}