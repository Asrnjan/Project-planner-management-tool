import { useState } from "react";

const initialState = {
  name: "",
  startDate: "",
  endDate: "",
  goal: "",
};

function FieldLabel({ children, required = false }) {
  return (
    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-600">
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  );
}

export default function SprintForm({ projectId, onSubmit }) {
  const [form, setForm] = useState(initialState);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSubmit({ ...form, projectId });
    setForm(initialState);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <FieldLabel required>Sprint Name</FieldLabel>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Sprint 1"
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          />
        </div>

        <div>
          <FieldLabel>Goal</FieldLabel>
          <input
            name="goal"
            value={form.goal}
            onChange={handleChange}
            placeholder="Main goal"
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          />
        </div>

        <div>
          <FieldLabel>Start Date</FieldLabel>
          <input
            name="startDate"
            type="date"
            value={form.startDate}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          />
        </div>

        <div>
          <FieldLabel>End Date</FieldLabel>
          <input
            name="endDate"
            type="date"
            value={form.endDate}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white sm:text-sm">
          Add Sprint
        </button>
      </div>
    </form>
  );
}