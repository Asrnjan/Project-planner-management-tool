import { useState } from "react";

export default function SprintList({ sprints, onDelete, onUpdate }) {
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    goal: "",
  });

  function startEdit(sprint) {
    setEditingId(sprint.id);
    setForm({
      name: sprint.name || "",
      startDate: sprint.startDate || "",
      endDate: sprint.endDate || "",
      goal: sprint.goal || "",
    });
  }

  function cancelEdit() {
    setEditingId("");
    setForm({
      name: "",
      startDate: "",
      endDate: "",
      goal: "",
    });
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function saveEdit(id) {
    if (!form.name.trim()) return;
    onUpdate(id, form);
    cancelEdit();
  }

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold">Sprints</h3>

      <div className="mt-4 space-y-3">
        {sprints.length === 0 ? (
          <p className="text-sm text-slate-500">No sprints added yet.</p>
        ) : (
          sprints.map((sprint) => (
            <div key={sprint.id} className="rounded-xl border p-4">
              {editingId === sprint.id ? (
                <div className="space-y-3">
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Sprint name"
                    className="w-full rounded-lg border p-3"
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      name="startDate"
                      type="date"
                      value={form.startDate}
                      onChange={handleChange}
                      className="rounded-lg border p-3"
                    />
                    <input
                      name="endDate"
                      type="date"
                      value={form.endDate}
                      onChange={handleChange}
                      className="rounded-lg border p-3"
                    />
                  </div>
                  <textarea
                    name="goal"
                    value={form.goal}
                    onChange={handleChange}
                    placeholder="Sprint goal"
                    className="min-h-20 w-full rounded-lg border p-3"
                  />

                  <div className="flex gap-3">
                    <button
                      onClick={() => saveEdit(sprint.id)}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-white"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="rounded-lg bg-slate-200 px-4 py-2 text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-900">{sprint.name}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {sprint.startDate || "No start"} to {sprint.endDate || "No end"}
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      {sprint.goal || "No goal added."}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(sprint)}
                      className="rounded-lg bg-blue-50 px-3 py-1 text-sm text-blue-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(sprint.id)}
                      className="rounded-lg bg-red-50 px-3 py-1 text-sm text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}