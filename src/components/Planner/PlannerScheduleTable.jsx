import { useMemo, useState } from "react";
import { buildWbs, calculateDurationDays, getPredecessorText } from "../../utils/planner";

const emptyEditState = {
  id: "",
  title: "",
  owner: "",
  status: "Not Started",
  plannedStart: "",
  plannedEnd: "",
  actualStart: "",
  actualEnd: "",
  baselineStart: "",
  baselineEnd: "",
  plannedProgress: 0,
  isMilestone: false,
};

function FieldLabel({ children }) {
  return <label className="mb-1 block text-sm font-medium text-slate-700">{children}</label>;
}

export default function PlannerScheduleTable({ tasks, onUpdate }) {
  const orderedTasks = useMemo(() => buildWbs(tasks), [tasks]);
  const [editingTask, setEditingTask] = useState(emptyEditState);

  function startEdit(task) {
    setEditingTask({
      id: task.id,
      title: task.title || "",
      owner: task.owner || "",
      status: task.status || "Not Started",
      plannedStart: task.plannedStart || "",
      plannedEnd: task.plannedEnd || "",
      actualStart: task.actualStart || "",
      actualEnd: task.actualEnd || "",
      baselineStart: task.baselineStart || "",
      baselineEnd: task.baselineEnd || "",
      plannedProgress: task.plannedProgress ?? 0,
      isMilestone: Boolean(task.isMilestone),
    });
  }

  function cancelEdit() {
    setEditingTask(emptyEditState);
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setEditingTask((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function saveEdit() {
    if (!editingTask.id || !editingTask.title.trim()) return;

    onUpdate(editingTask.id, {
      title: editingTask.title,
      owner: editingTask.owner,
      status: editingTask.status,
      plannedStart: editingTask.plannedStart,
      plannedEnd: editingTask.plannedEnd,
      actualStart: editingTask.actualStart,
      actualEnd: editingTask.actualEnd,
      baselineStart: editingTask.baselineStart,
      baselineEnd: editingTask.baselineEnd,
      plannedProgress: Number(editingTask.plannedProgress || 0),
      isMilestone: Boolean(editingTask.isMilestone),
    });

    cancelEdit();
  }

  return (
    <div className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
      <div>
        <h3 className="text-xl font-semibold text-slate-900">Project Planner Schedule</h3>
        <p className="mt-1 text-sm text-slate-500">
          Microsoft Project-style schedule view with WBS, duration, predecessors, baseline, and actual dates.
        </p>
      </div>

      {editingTask.id && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <h4 className="mb-4 text-lg font-semibold text-slate-900">Edit Schedule Row</h4>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <FieldLabel>Task Name</FieldLabel>
              <input
                name="title"
                value={editingTask.title}
                onChange={handleChange}
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <FieldLabel>Owner</FieldLabel>
              <input
                name="owner"
                value={editingTask.owner}
                onChange={handleChange}
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <FieldLabel>Status</FieldLabel>
              <select
                name="status"
                value={editingTask.status}
                onChange={handleChange}
                className="w-full rounded-lg border p-3"
              >
                <option>Not Started</option>
                <option>In Progress</option>
                <option>Done</option>
                <option>Blocked</option>
              </select>
            </div>

            <div>
              <FieldLabel>Planned Start</FieldLabel>
              <input
                name="plannedStart"
                type="date"
                value={editingTask.plannedStart}
                onChange={handleChange}
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <FieldLabel>Planned Finish</FieldLabel>
              <input
                name="plannedEnd"
                type="date"
                value={editingTask.plannedEnd}
                onChange={handleChange}
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <FieldLabel>% Complete</FieldLabel>
              <input
                name="plannedProgress"
                type="number"
                min="0"
                max="100"
                value={editingTask.plannedProgress}
                onChange={handleChange}
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <FieldLabel>Actual Start</FieldLabel>
              <input
                name="actualStart"
                type="date"
                value={editingTask.actualStart}
                onChange={handleChange}
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <FieldLabel>Actual Finish</FieldLabel>
              <input
                name="actualEnd"
                type="date"
                value={editingTask.actualEnd}
                onChange={handleChange}
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <FieldLabel>Milestone</FieldLabel>
              <label className="flex items-center gap-2 rounded-lg border bg-white p-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="isMilestone"
                  checked={editingTask.isMilestone}
                  onChange={handleChange}
                />
                Mark as milestone
              </label>
            </div>

            <div>
              <FieldLabel>Baseline Start</FieldLabel>
              <input
                name="baselineStart"
                type="date"
                value={editingTask.baselineStart}
                onChange={handleChange}
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <FieldLabel>Baseline Finish</FieldLabel>
              <input
                name="baselineEnd"
                type="date"
                value={editingTask.baselineEnd}
                onChange={handleChange}
                className="w-full rounded-lg border p-3"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={saveEdit}
              className="rounded-lg bg-slate-900 px-4 py-2 text-white"
            >
              Save Schedule Changes
            </button>
            <button
              onClick={cancelEdit}
              className="rounded-lg bg-slate-200 px-4 py-2 text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-auto rounded-xl border">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b text-left text-slate-600">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">WBS</th>
              <th className="px-4 py-3">Task Name</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">Finish</th>
              <th className="px-4 py-3">Predecessors</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">% Complete</th>
              <th className="px-4 py-3">Baseline Start</th>
              <th className="px-4 py-3">Baseline Finish</th>
              <th className="px-4 py-3">Actual Start</th>
              <th className="px-4 py-3">Actual Finish</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>

          <tbody>
            {orderedTasks.map((task, index) => (
              <tr key={task.id} className="border-b bg-white align-top">
                <td className="px-4 py-3">{index + 1}</td>
                <td className="px-4 py-3">{task.wbs}</td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  <div style={{ paddingLeft: `${(task.wbs.split(".").length - 1) * 18}px` }}>
                    {task.title}
                    {task.isMilestone && (
                      <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                        Milestone
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {calculateDurationDays(task.plannedStart, task.plannedEnd) || "-"}
                </td>
                <td className="px-4 py-3">{task.plannedStart || "-"}</td>
                <td className="px-4 py-3">{task.plannedEnd || "-"}</td>
                <td className="px-4 py-3">{getPredecessorText(task, tasks) || "-"}</td>
                <td className="px-4 py-3">{task.owner || "-"}</td>
                <td className="px-4 py-3">{task.plannedProgress || 0}%</td>
                <td className="px-4 py-3">{task.baselineStart || "-"}</td>
                <td className="px-4 py-3">{task.baselineEnd || "-"}</td>
                <td className="px-4 py-3">{task.actualStart || "-"}</td>
                <td className="px-4 py-3">{task.actualEnd || "-"}</td>
                <td className="px-4 py-3">{task.status || "-"}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => startEdit(task)}
                    className="text-blue-600"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}

            {orderedTasks.length === 0 && (
              <tr>
                <td colSpan="15" className="px-4 py-8 text-center text-slate-500">
                  No planner tasks found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}