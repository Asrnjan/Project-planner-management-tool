import { useMemo, useState } from "react";
import { CalendarDays, Milestone, Pencil, Trash2, ListChecks } from "lucide-react";
import { usePlannerStore } from "../../store/usePlannerStore";

function FieldLabel({ children }) {
  return (
    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
      {children}
    </label>
  );
}

function getStatusClass(status) {
  switch (status) {
    case "Completed":
      return "bg-emerald-100 text-emerald-700";
    case "Active":
      return "bg-blue-100 text-blue-700";
    case "Planned":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-amber-100 text-amber-700";
  }
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </div>
      <div className="mt-1 text-base font-semibold tracking-tight text-slate-900">
        {value}
      </div>
    </div>
  );
}

export default function SprintList({ sprints, onDelete, onUpdate }) {
  const { tasks } = usePlannerStore();
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState({});

  const sprintStatsMap = useMemo(() => {
    const map = {};

    sprints.forEach((sprint) => {
      const sprintTasks = tasks.filter((task) => task.sprintId === sprint.id);
      const milestoneTasks = sprintTasks.filter((task) => task.isMilestone);
      const doneTasks = sprintTasks.filter((task) => task.status === "Done");

      map[sprint.id] = {
        totalTasks: sprintTasks.length,
        milestoneCount: milestoneTasks.length,
        doneCount: doneTasks.length,
        milestoneTitles: milestoneTasks.map((task) => task.title),
      };
    });

    return map;
  }, [sprints, tasks]);

  function startEdit(sprint) {
    setEditingId(sprint.id);
    setForm({
      name: sprint.name || "",
      goal: sprint.goal || "",
      status: sprint.status || "Planned",
      startDate: sprint.startDate || "",
      endDate: sprint.endDate || "",
    });
  }

  function handleSave(id) {
    onUpdate(id, form);
    setEditingId("");
    setForm({});
  }

  if (!sprints.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
        No sprints found for this project.
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {sprints.map((sprint) => {
        const stats = sprintStatsMap[sprint.id] || {
          totalTasks: 0,
          milestoneCount: 0,
          doneCount: 0,
          milestoneTitles: [],
        };

        const isEditing = editingId === sprint.id;

        return (
          <div
            key={sprint.id}
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
          >
            {isEditing ? (
              <div className="p-4">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                    Edit Sprint
                  </h3>
                </div>

                <div className="grid gap-4">
                  <div>
                    <FieldLabel>Sprint Name</FieldLabel>
                    <input
                      value={form.name || ""}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
                    />
                  </div>

                  <div>
                    <FieldLabel>Goal</FieldLabel>
                    <textarea
                      value={form.goal || ""}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, goal: e.target.value }))
                      }
                      className="min-h-[100px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <FieldLabel>Status</FieldLabel>
                      <select
                        value={form.status || "Planned"}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, status: e.target.value }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
                      >
                        <option>Planned</option>
                        <option>Active</option>
                        <option>Completed</option>
                        <option>On Hold</option>
                      </select>
                    </div>

                    <div>
                      <FieldLabel>Start Date</FieldLabel>
                      <input
                        type="date"
                        value={form.startDate || ""}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, startDate: e.target.value }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
                      />
                    </div>

                    <div>
                      <FieldLabel>End Date</FieldLabel>
                      <input
                        type="date"
                        value={form.endDate || ""}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, endDate: e.target.value }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    onClick={() => handleSave(sprint.id)}
                    className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingId("");
                      setForm({});
                    }}
                    className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="border-b border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-semibold tracking-tight text-slate-900">
                          {sprint.name}
                        </h3>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${getStatusClass(
                            sprint.status
                          )}`}
                        >
                          {sprint.status}
                        </span>
                      </div>

                      <div className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-500">
                        <CalendarDays className="h-4 w-4" />
                        {sprint.startDate || "-"} to {sprint.endDate || "-"}
                      </div>

                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {sprint.goal || "No sprint goal added."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 p-4 sm:grid-cols-3">
                  <Stat label="Tasks" value={stats.totalTasks} icon={ListChecks} />
                  <Stat label="Done" value={stats.doneCount} icon={ListChecks} />
                  <Stat label="Milestones" value={stats.milestoneCount} icon={Milestone} />
                </div>

                <div className="px-4 pb-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      Milestones in this sprint
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {stats.milestoneTitles.length ? (
                        stats.milestoneTitles.map((title, idx) => (
                          <span
                            key={`${sprint.id}-ms-${idx}`}
                            className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-[10px] font-medium text-purple-700"
                          >
                            <Milestone className="h-3 w-3" />
                            {title}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">
                          No milestone tasks assigned to this sprint.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => startEdit(sprint)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>

                    <button
                      onClick={() => onDelete(sprint.id)}
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
      })}
    </div>
  );
}