import { Link } from "react-router-dom";
import { useState } from "react";
import {
  CalendarDays,
  Pencil,
  Trash2,
  ArrowRight,
  CircleUserRound,
  FolderKanban,
} from "lucide-react";
import { getProjectHealth } from "../../utils/calculations";

function getStatusClass(status) {
  switch (status) {
    case "Completed":
      return "bg-emerald-100 text-emerald-700";
    case "On Hold":
      return "bg-amber-100 text-amber-700";
    case "Active":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getHealthClass(health) {
  switch (health) {
    case "Healthy":
      return "bg-emerald-100 text-emerald-700";
    case "At Risk":
      return "bg-amber-100 text-amber-700";
    case "Critical":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function FieldLabel({ children }) {
  return (
    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
      {children}
    </label>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold tracking-tight text-slate-900">
        {value}
      </div>
    </div>
  );
}

export default function ProjectCard({ project, summary, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(project);

  const health = getProjectHealth(summary);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function saveEdit() {
    if (!form.name.trim()) return;
    onUpdate(project.id, form);
    setEditing(false);
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {editing ? (
        <div className="p-5">
          <div className="mb-4">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">
              Edit Project
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Update the main project details.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel>Project Name</FieldLabel>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
              />
            </div>

            <div>
              <FieldLabel>Owner</FieldLabel>
              <input
                name="owner"
                value={form.owner}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
              />
            </div>

            <div>
              <FieldLabel>Status</FieldLabel>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
              >
                <option>Active</option>
                <option>Planned</option>
                <option>On Hold</option>
                <option>Completed</option>
              </select>
            </div>

            <div>
              <FieldLabel>Start Date</FieldLabel>
              <input
                name="startDate"
                type="date"
                value={form.startDate || ""}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
              />
            </div>

            <div>
              <FieldLabel>Target End</FieldLabel>
              <input
                name="targetEndDate"
                type="date"
                value={form.targetEndDate || ""}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <FieldLabel>Description</FieldLabel>
              <textarea
                name="description"
                value={form.description || ""}
                onChange={handleChange}
                className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
              />
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={saveEdit}
              className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
            >
              Save
            </button>
            <button
              onClick={() => {
                setForm(project);
                setEditing(false);
              }}
              className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="border-b border-slate-200 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <FolderKanban className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold tracking-tight text-slate-900">
                      {project.name}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${getStatusClass(
                          project.status
                        )}`}
                      >
                        {project.status}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${getHealthClass(
                          health
                        )}`}
                      >
                        {health}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <CircleUserRound className="h-4 w-4" />
                    {project.owner || "Not assigned"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" />
                    {project.startDate || "-"} to {project.targetEndDate || "-"}
                  </span>
                </div>

                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                  {project.description || "No description added."}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Planned" value={`${summary.plannedAvg}%`} />
            <Metric label="Actual" value={`${summary.actualAvg}%`} />
            <Metric label="Completed" value={`${summary.completed}/${summary.total}`} />
            <Metric label="Overdue" value={summary.overdue} />
          </div>

          <div className="border-t border-slate-200 px-5 py-4">
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/planner?projectId=${project.id}&tab=overview`}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
              >
                Open Project
                <ArrowRight className="h-4 w-4" />
              </Link>

              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>

              <button
                onClick={() => onDelete(project.id)}
                className="inline-flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}