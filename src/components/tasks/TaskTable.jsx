import { useMemo, useState } from "react";
import {
  getTaskVariance,
  getTaskDelayDays,
  isTaskOverdue,
} from "../../utils/calculations";

function getStatusClass(status) {
  switch (status) {
    case "Done":
      return "bg-green-100 text-green-700";
    case "In Progress":
      return "bg-blue-100 text-blue-700";
    case "Blocked":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

const emptyEditState = {
  id: "",
  title: "",
  owner: "",
  status: "Not Started",
  priority: "Medium",
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

function ProgressBar({ value, label }) {
  return (
    <div className="w-28">
      <div className="mb-1 flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200">
        <div
          className="h-2 rounded-full bg-slate-900"
          style={{ width: `${Math.max(0, Math.min(100, Number(value || 0)))}%` }}
        />
      </div>
    </div>
  );
}

function sortTasksHierarchy(tasks) {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const childrenMap = new Map();

  tasks.forEach((task) => {
    const parentId = task.parentTaskId || "";
    if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
    childrenMap.get(parentId).push(task);
  });

  const result = [];

  function addTaskWithChildren(task, depth = 0) {
    result.push({ ...task, depth });
    const children = childrenMap.get(task.id) || [];
    children.forEach((child) => addTaskWithChildren(child, depth + 1));
  }

  const rootTasks = tasks.filter(
    (task) => !task.parentTaskId || !taskMap.has(task.parentTaskId)
  );

  rootTasks.forEach((task) => addTaskWithChildren(task, 0));

  return result;
}

function FieldLabel({ children }) {
  return <label className="mb-1 block text-sm font-medium text-slate-700">{children}</label>;
}

export default function TaskTable({ tasks, sprints, onDelete, onUpdate }) {
  const sprintMap = Object.fromEntries(sprints.map((s) => [s.id, s.name]));
  const taskMap = Object.fromEntries(tasks.map((task) => [task.id, task]));

  const [filters, setFilters] = useState({
    sprintId: "",
    status: "",
    owner: "",
  });

  const [editingTask, setEditingTask] = useState(emptyEditState);

  const ownerOptions = useMemo(() => {
    return [...new Set(tasks.map((task) => task.owner).filter(Boolean))];
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const matched = tasks.filter((task) => {
      const sprintMatch = !filters.sprintId || task.sprintId === filters.sprintId;
      const statusMatch = !filters.status || task.status === filters.status;
      const ownerMatch = !filters.owner || task.owner === filters.owner;
      return sprintMatch && statusMatch && ownerMatch;
    });

    return sortTasksHierarchy(matched);
  }, [tasks, filters]);

  function handleFilterChange(e) {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  function startEdit(task) {
    setEditingTask({
      id: task.id,
      title: task.title || "",
      owner: task.owner || "",
      status: task.status || "Not Started",
      priority: task.priority || "Medium",
      sprintId: task.sprintId || "",
      parentTaskId: task.parentTaskId || "",
      dependencyIds: task.dependencyIds || [],
      plannedStart: task.plannedStart || "",
      plannedEnd: task.plannedEnd || "",
      actualStart: task.actualStart || "",
      actualEnd: task.actualEnd || "",
      plannedProgress: task.plannedProgress ?? 0,
      actualProgress: task.actualProgress ?? 0,
      isMilestone: Boolean(task.isMilestone),
    });
  }

  function cancelEdit() {
    setEditingTask(emptyEditState);
  }

  function handleEditChange(e) {
    const { name, value, type, checked, options } = e.target;

    if (name === "dependencyIds") {
      const selectedValues = Array.from(options)
        .filter((option) => option.selected)
        .map((option) => option.value);

      setEditingTask((prev) => ({
        ...prev,
        dependencyIds: selectedValues,
      }));
      return;
    }

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
      priority: editingTask.priority,
      sprintId: editingTask.sprintId,
      parentTaskId: editingTask.parentTaskId,
      dependencyIds: editingTask.dependencyIds,
      plannedStart: editingTask.plannedStart,
      plannedEnd: editingTask.plannedEnd,
      actualStart: editingTask.actualStart,
      actualEnd: editingTask.actualEnd,
      plannedProgress: editingTask.plannedProgress,
      actualProgress: editingTask.actualProgress,
      isMilestone: editingTask.isMilestone,
    });

    cancelEdit();
  }

  return (
    <div className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
      <div>
        <h3 className="text-xl font-semibold text-slate-900">Task Tracker</h3>
        <p className="mt-1 text-sm text-slate-500">
          View, filter, edit, and track tasks, subtasks, milestones, and dependencies.
        </p>
      </div>

      <details className="rounded-xl border bg-slate-50 p-4" open>
        <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-wide text-slate-500">
          Task Filters
        </summary>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <FieldLabel>Sprint</FieldLabel>
            <select
              name="sprintId"
              value={filters.sprintId}
              onChange={handleFilterChange}
              className="w-full rounded-lg border p-2"
            >
              <option value="">All sprints</option>
              {sprints.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>Status</FieldLabel>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="w-full rounded-lg border p-2"
            >
              <option value="">All statuses</option>
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Done">Done</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>

          <div>
            <FieldLabel>Owner</FieldLabel>
            <select
              name="owner"
              value={filters.owner}
              onChange={handleFilterChange}
              className="w-full rounded-lg border p-2"
            >
              <option value="">All owners</option>
              {ownerOptions.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          </div>
        </div>
      </details>

      {editingTask.id && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <h4 className="mb-4 text-lg font-semibold text-slate-900">Edit Task</h4>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Task Title</FieldLabel>
              <input
                name="title"
                value={editingTask.title}
                onChange={handleEditChange}
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <FieldLabel>Owner</FieldLabel>
              <input
                name="owner"
                value={editingTask.owner}
                onChange={handleEditChange}
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <FieldLabel>Sprint</FieldLabel>
              <select
                name="sprintId"
                value={editingTask.sprintId}
                onChange={handleEditChange}
                className="w-full rounded-lg border p-3"
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
              <FieldLabel>Parent Task</FieldLabel>
              <select
                name="parentTaskId"
                value={editingTask.parentTaskId}
                onChange={handleEditChange}
                className="w-full rounded-lg border p-3"
              >
                <option value="">No parent task</option>
                {tasks
                  .filter((task) => task.id !== editingTask.id)
                  .map((task) => (
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
                value={editingTask.priority}
                onChange={handleEditChange}
                className="w-full rounded-lg border p-3"
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
                value={editingTask.status}
                onChange={handleEditChange}
                className="w-full rounded-lg border p-3"
              >
                <option>Not Started</option>
                <option>In Progress</option>
                <option>Done</option>
                <option>Blocked</option>
              </select>
            </div>

            <div>
              <FieldLabel>Planned Progress (%)</FieldLabel>
              <input
                name="plannedProgress"
                type="number"
                min="0"
                max="100"
                value={editingTask.plannedProgress}
                onChange={handleEditChange}
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <FieldLabel>Actual Progress (%)</FieldLabel>
              <input
                name="actualProgress"
                type="number"
                min="0"
                max="100"
                value={editingTask.actualProgress}
                onChange={handleEditChange}
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <FieldLabel>Planned Start Date</FieldLabel>
              <input
                name="plannedStart"
                type="date"
                value={editingTask.plannedStart}
                onChange={handleEditChange}
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <FieldLabel>Planned End Date</FieldLabel>
              <input
                name="plannedEnd"
                type="date"
                value={editingTask.plannedEnd}
                onChange={handleEditChange}
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <FieldLabel>Actual Start Date</FieldLabel>
              <input
                name="actualStart"
                type="date"
                value={editingTask.actualStart}
                onChange={handleEditChange}
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <FieldLabel>Actual End Date</FieldLabel>
              <input
                name="actualEnd"
                type="date"
                value={editingTask.actualEnd}
                onChange={handleEditChange}
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div className="md:col-span-2">
              <FieldLabel>Dependencies</FieldLabel>
              <select
                name="dependencyIds"
                multiple
                value={editingTask.dependencyIds}
                onChange={handleEditChange}
                className="min-h-28 w-full rounded-lg border p-3"
              >
                {tasks
                  .filter((task) => task.id !== editingTask.id)
                  .map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 rounded-lg border bg-white p-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  name="isMilestone"
                  checked={editingTask.isMilestone}
                  onChange={handleEditChange}
                />
                Mark this task as a milestone
              </label>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={saveEdit}
              className="rounded-lg bg-slate-900 px-4 py-2 text-white"
            >
              Save Changes
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
              <th className="px-4 py-3">Task Name</th>
              <th className="px-4 py-3">Sprint</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Dependencies</th>
              <th className="px-4 py-3">Planned Progress</th>
              <th className="px-4 py-3">Actual Progress</th>
              <th className="px-4 py-3">Variance</th>
              <th className="px-4 py-3">Delay</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredTasks.map((task) => {
              const overdue = isTaskOverdue(task);
              const dependencyTitles = (task.dependencyIds || [])
                .map((id) => taskMap[id]?.title)
                .filter(Boolean);

              return (
                <tr
                  key={task.id}
                  className={`border-b align-top ${overdue ? "bg-red-50" : "bg-white"}`}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <div
                      className="flex items-center gap-2"
                      style={{ paddingLeft: `${task.depth * 20}px` }}
                    >
                      {task.depth > 0 && <span className="text-slate-400">└</span>}
                      <span>{task.title}</span>
                      {task.parentTaskId && (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                          Subtask
                        </span>
                      )}
                      {task.isMilestone && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                          Milestone
                        </span>
                      )}
                      {overdue && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                          Overdue
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">{sprintMap[task.sprintId] || "-"}</td>
                  <td className="px-4 py-3">{task.owner || "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(
                        task.status
                      )}`}
                    >
                      {task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{task.priority}</td>
                  <td className="px-4 py-3">
                    {dependencyTitles.length ? (
                      <div className="flex flex-wrap gap-1">
                        {dependencyTitles.map((title) => (
                          <span
                            key={title}
                            className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700"
                          >
                            {title}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ProgressBar value={task.plannedProgress} label="Planned" />
                  </td>
                  <td className="px-4 py-3">
                    <ProgressBar value={task.actualProgress} label="Actual" />
                  </td>
                  <td className="px-4 py-3">{getTaskVariance(task)}%</td>
                  <td className="px-4 py-3">{getTaskDelayDays(task)} days</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button
                        onClick={() => startEdit(task)}
                        className="text-blue-600"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(task.id)}
                        className="text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredTasks.length === 0 && (
              <tr>
                <td colSpan="11" className="px-4 py-8 text-center text-slate-500">
                  No tasks match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}