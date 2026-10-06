import { useState } from "react";
import { usePlannerStore } from "../../store/usePlannerStore";
import { useUiStore } from "../../ui/uiStore";
import { notify } from "../../ui/feedback";
import { Button, Field, Modal, inputClass } from "../../ui/primitives";
import { TASK_PRIORITIES, TASK_STATUSES } from "../../domain/vocabulary";
import { calculateDurationDays } from "../../utils/planner";

const EMPTY = {
  title: "",
  owner: "",
  priority: "Medium",
  status: "Not Started",
  plannedStart: "",
  plannedEnd: "",
  sprintId: "",
  isMilestone: false,
  notes: "",
};

function QuickTaskForm({ initialProjectId, onClose }) {
  const projects = usePlannerStore((state) => state.projects);
  const sprints = usePlannerStore((state) => state.sprints);
  const addTask = usePlannerStore((state) => state.addTask);

  const [projectId, setProjectId] = useState(initialProjectId || projects[0]?.id || "");
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const projectSprints = sprints.filter((sprint) => sprint.projectId === projectId);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  }

  function save(keepOpen) {
    if (!projectId) {
      setError("Create a project first, then add tasks to it.");
      return;
    }
    if (!form.title.trim()) {
      setError("Give the task a name.");
      return;
    }
    if (form.plannedStart && form.plannedEnd && form.plannedEnd < form.plannedStart) {
      setError("The end date must be on or after the start date.");
      return;
    }

    const plannedEnd = form.isMilestone ? form.plannedStart || form.plannedEnd : form.plannedEnd;
    addTask({
      ...form,
      projectId,
      title: form.title.trim(),
      owner: form.owner.trim(),
      plannedEnd,
      durationDays: Number(calculateDurationDays(form.plannedStart, plannedEnd)) || 1,
      actualProgress: form.status === "Done" ? 100 : 0,
      plannedProgress: 0,
      dependencyIds: [],
    });

    notify.success(`Task "${form.title.trim()}" added.`);

    if (keepOpen) {
      setForm({ ...EMPTY, owner: form.owner, sprintId: form.sprintId });
    } else {
      onClose();
    }
  }

  if (projects.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        You don't have a project yet. Create one first from the <strong>New project</strong> button.
      </p>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save(false);
      }}
      className="space-y-4"
      noValidate
    >
      <Field label="Task name" htmlFor="qt-title" required>
        <input
          id="qt-title"
          value={form.title}
          onChange={(event) => update("title", event.target.value)}
          className={inputClass}
          placeholder="e.g. Write launch announcement"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project" htmlFor="qt-project">
          <select
            id="qt-project"
            value={projectId}
            onChange={(event) => {
              setProjectId(event.target.value);
              update("sprintId", "");
            }}
            className={inputClass}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Assigned to" htmlFor="qt-owner">
          <input
            id="qt-owner"
            value={form.owner}
            onChange={(event) => update("owner", event.target.value)}
            className={inputClass}
            placeholder="Name"
          />
        </Field>
        <Field label="Start" htmlFor="qt-start">
          <input
            id="qt-start"
            type="date"
            value={form.plannedStart}
            onChange={(event) => update("plannedStart", event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Due" htmlFor="qt-end">
          <input
            id="qt-end"
            type="date"
            value={form.plannedEnd}
            min={form.plannedStart || undefined}
            onChange={(event) => update("plannedEnd", event.target.value)}
            className={inputClass}
            disabled={form.isMilestone}
          />
        </Field>
        <Field label="Priority" htmlFor="qt-priority">
          <select
            id="qt-priority"
            value={form.priority}
            onChange={(event) => update("priority", event.target.value)}
            className={inputClass}
          >
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
        </Field>
        <Field label="Status" htmlFor="qt-status">
          <select
            id="qt-status"
            value={form.status}
            onChange={(event) => update("status", event.target.value)}
            className={inputClass}
          >
            {TASK_STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </Field>
        {projectSprints.length > 0 ? (
          <Field label="Sprint" htmlFor="qt-sprint">
            <select
              id="qt-sprint"
              value={form.sprintId}
              onChange={(event) => update("sprintId", event.target.value)}
              className={inputClass}
            >
              <option value="">No sprint</option>
              {projectSprints.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.isMilestone}
          onChange={(event) => update("isMilestone", event.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        This is a milestone (a key date, not a piece of work)
      </label>

      <Field label="Notes" htmlFor="qt-notes">
        <textarea
          id="qt-notes"
          value={form.notes}
          onChange={(event) => update("notes", event.target.value)}
          className={`${inputClass} min-h-[70px]`}
          placeholder="Optional details"
        />
      </Field>

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => save(true)}>Save & add another</Button>
        <Button type="submit" variant="primary">
          Add task
        </Button>
      </div>
    </form>
  );
}

export default function QuickTaskDialog() {
  const quickTask = useUiStore((state) => state.quickTask);
  const close = useUiStore((state) => state.closeQuickTask);

  return (
    <Modal open={Boolean(quickTask)} onClose={close} title="Add a task">
      {quickTask ? (
        <QuickTaskForm initialProjectId={quickTask.projectId} onClose={close} />
      ) : null}
    </Modal>
  );
}
