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
  return <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">{children}</label>;
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
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h3 className="text-base font-semibold tracking-tight text-slate-900">Task Tracker</h3>
        <p className="mt-1 text-xs text-slate-500">
          Compact task list with filters and quick edits.
        </p>
      </div>

      <details className="rounded-lg border border-slate-200 bg-slate-50 p-3" open>
        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-slate-500">
          Filters
        </summary>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <FieldLabel>Sprint</FieldLabel>
            <select
              name="sprintId"
              value={filters.sprintId}
              onChange={handleFilterChange}
              className="w-full rounded-lg border border-slate-300 p-2 text-sm"
            >
              <option value="">All</option>
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
              className="w-full rounded-lg border border-slate-300 p-2 text-sm"
            >
              <option value="">All</option>
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
              className="w-full rounded-lg border border-slate-300 p-2 text-sm"
            >
              <option value="">All</option>
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
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">Edit Task</h4>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="xl:col-span-2">
              <FieldLabel>Task Title</FieldLabel>
              <input
                name="title"
                value={editingTask.title}
                onChange={handleEditChange}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              />
            </div>

            <div>
              <FieldLabel>Owner</FieldLabel>
              <input
                name="owner"
                value={editingTask.owner}
                onChange={handleEditChange}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              />
            </div>

            <div>
              <FieldLabel>Sprint</FieldLabel>
              <select
                name="sprintId"
                value={editingTask.sprintId}
                onChange={handleEditChange}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              >
                <option value="">Select</option>
                {sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name}
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
                value={editingTask.status}
                onChange={handleEditChange}
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
                value={editingTask.plannedProgress}
                onChange={handleEditChange}
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
                value={editingTask.actualProgress}
                onChange={handleEditChange}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={saveEdit}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white sm:text-sm"
            >
              Save
            </button>
            <button
              onClick={cancelEdit}
              className="rounded-lg bg-slate-200 px-3 py-2 text-xs text-slate-700 sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200 text-left text-slate-600">
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">Task</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">Sprint</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">Owner</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">Status</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">Priority</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">Deps</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">Plan %</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">Act %</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">Var</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">Delay</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">Action</th>
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
                  className={`border-b border-slate-200 align-top hover:bg-slate-50 ${
                    overdue ? "bg-red-50/50" : "bg-white"
                  }`}
                >
                  <td className="px-3 py-2.5 font-medium text-slate-900">
                    <div
                      className="flex items-center gap-1.5"
                      style={{ paddingLeft: `${task.depth * 16}px` }}
                    >
                      {task.depth > 0 && <span className="text-slate-400">└</span>}
                      <span className="line-clamp-1">{task.title}</span>
                      {task.parentTaskId && (
                        <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-700">
                          Sub
                        </span>
                      )}
                      {task.isMilestone && (
                        <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700">
                          M
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{sprintMap[task.sprintId] || "-"}</td>
                  <td className="px-3 py-2.5">{task.owner || "-"}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getStatusClass(
                        task.status
                      )}`}
                    >
                      {task.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">{task.priority}</td>
                  <td className="px-3 py-2.5">
                    {dependencyTitles.length ? dependencyTitles.length : "-"}
                  </td>
                  <td className="px-3 py-2.5">{task.plannedProgress || 0}%</td>
                  <td className="px-3 py-2.5">{task.actualProgress || 0}%</td>
                  <td className="px-3 py-2.5">{getTaskVariance(task)}%</td>
                  <td className="px-3 py-2.5">{getTaskDelayDays(task)}d</td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(task)} className="text-blue-600">
                        Edit
                      </button>
                      <button onClick={() => onDelete(task.id)} className="text-red-600">
                        Del
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredTasks.length === 0 && (
              <tr>
                <td colSpan="11" className="px-4 py-8 text-center text-sm text-slate-500">
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