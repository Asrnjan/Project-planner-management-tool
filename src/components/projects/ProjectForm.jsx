import { useEffect, useState } from "react";
import { CalendarDays, CircleUserRound, FileText, Flag } from "lucide-react";

const emptyState = {
  name: "",
  owner: "",
  description: "",
  status: "Active",
  startDate: "",
  targetEndDate: "",
};

function FieldLabel({ children, required = false, icon: Icon }) {
  return (
    <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      <span>
        {children} {required && <span className="text-red-500">*</span>}
      </span>
    </label>
  );
}

export default function ProjectForm({
  initialValue = null,
  onSubmit,
  onCancel,
  submitLabel = "Create Project",
}) {
  const [form, setForm] = useState(emptyState);

  useEffect(() => {
    if (initialValue) {
      setForm({
        name: initialValue.name || "",
        owner: initialValue.owner || "",
        description: initialValue.description || "",
        status: initialValue.status || "Active",
        startDate: initialValue.startDate || "",
        targetEndDate: initialValue.targetEndDate || "",
      });
    } else {
      setForm(emptyState);
    }
  }, [initialValue]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Please enter a project name.");
      return;
    }

    onSubmit({
      ...initialValue,
      ...form,
      name: form.name.trim(),
      updatedAt: new Date().toISOString(),
    });

    if (!initialValue) {
      setForm(emptyState);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4">
        <div>
          <FieldLabel required icon={FileText}>
            Project Name
          </FieldLabel>

          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Enter project name"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel icon={CircleUserRound}>Owner</FieldLabel>

            <input
              name="owner"
              value={form.owner}
              onChange={handleChange}
              placeholder="Project owner"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </div>

          <div>
            <FieldLabel icon={Flag}>Status</FieldLabel>

            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none"
            >
              <option value="Active">Active</option>
              <option value="Planned">Planned</option>
              <option value="On Hold">On Hold</option>
              <option value="Completed">Completed</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel icon={CalendarDays}>Start Date</FieldLabel>

            <input
              name="startDate"
              type="date"
              value={form.startDate}
              onChange={handleChange}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none"
            />
          </div>

          <div>
            <FieldLabel icon={CalendarDays}>Target End</FieldLabel>

            <input
              name="targetEndDate"
              type="date"
              value={form.targetEndDate}
              onChange={handleChange}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <FieldLabel icon={FileText}>Description</FieldLabel>

          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Short project description"
            className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Cancel
          </button>
        ) : null}

        <button
          type="submit"
          className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}