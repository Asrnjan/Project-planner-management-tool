import { useMemo, useState } from "react";

const initialState = {
  title: "",
  owner: "",
  priority: "Medium",
  status: "Not Started",
  sprintId: "",
  parentTaskId: "",
  dependencyIds: [],
  plannedStart: "",
  plannedEnd: "",
  actualStart: "",
  actualEnd: "",
  plannedProgress: 0,
  actualProgress: 0,
  isMilestone: false,
};

function FieldLabel({ children, required = false }) {
  return (
    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-600">
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  );
}

export default function TaskForm({ projectId, sprints, tasks, onSubmit }) {
  const [form, setForm] = useState(initialState);

  const projectTaskOptions = useMemo(() => {
    return tasks.filter((task) => task.projectId === projectId);
  }, [tasks, projectId]);

  function handleChange(e) {
    const { name, value, type, checked, options } = e.target;

    if (name === "dependencyIds") {
      const selectedValues = Array.from(options)
        .filter((option) => option.selected)
        .map((option) => option.value);

      setForm((prev) => ({
        ...prev,
        dependencyIds: selectedValues,
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;

    onSubmit({ ...form, projectId });
    setForm(initialState);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="xl:col-span-2">
          <FieldLabel required>Task Title</FieldLabel>
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="Design dashboard layout"
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          />
        </div>

        <div>
          <FieldLabel>Owner</FieldLabel>
          <input
            name="owner"
            value={form.owner}
            onChange={handleChange}
            placeholder="Ashish"
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          />
        </div>

        <div>
          <FieldLabel>Sprint</FieldLabel>
          <select
            name="sprintId"
            value={form.sprintId}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          >
            <option value="">Select sprint</option>
            {sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel>Parent</FieldLabel>
          <select
            name="parentTaskId"
            value={form.parentTaskId}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          >
            <option value="">No parent</option>
            {projectTaskOptions.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel>Priority</FieldLabel>
          <select
            name="priority"
            value={form.priority}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </div>

        <div>
          <FieldLabel>Status</FieldLabel>
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          >
            <option>Not Started</option>
            <option>In Progress</option>
            <option>Done</option>
            <option>Blocked</option>
          </select>
        </div>

        <div>
          <FieldLabel>Planned %</FieldLabel>
          <input
            name="plannedProgress"
            type="number"
            min="0"
            max="100"
            value={form.plannedProgress}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          />
        </div>

        <div>
          <FieldLabel>Actual %</FieldLabel>
          <input
            name="actualProgress"
            type="number"
            min="0"
            max="100"
            value={form.actualProgress}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          />
        </div>

        <div>
          <FieldLabel>Planned Start</FieldLabel>
          <input
            name="plannedStart"
            type="date"
            value={form.plannedStart}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          />
        </div>

        <div>
          <FieldLabel>Planned End</FieldLabel>
          <input
            name="plannedEnd"
            type="date"
            value={form.plannedEnd}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          />
        </div>

        <div>
          <FieldLabel>Actual Start</FieldLabel>
          <input
            name="actualStart"
            type="date"
            value={form.actualStart}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          />
        </div>

        <div>
          <FieldLabel>Actual End</FieldLabel>
          <input
            name="actualEnd"
            type="date"
            value={form.actualEnd}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          />
        </div>

        <div className="md:col-span-2 xl:col-span-4">
          <FieldLabel>Dependencies</FieldLabel>
          <select
            name="dependencyIds"
            multiple
            value={form.dependencyIds}
            onChange={handleChange}
            className="min-h-24 w-full rounded-lg border border-slate-300 p-2 text-sm"
          >
            {projectTaskOptions.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2 xl:col-span-4">
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              name="isMilestone"
              checked={form.isMilestone}
              onChange={handleChange}
            />
            Mark as milestone
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white sm:text-sm">
          Add Task
        </button>
      </div>
    </form>
  );
}