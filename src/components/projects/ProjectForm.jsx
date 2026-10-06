import { useState } from "react";
import { PROJECT_STATUSES } from "../../domain/vocabulary";
import { Button, Field, inputClass } from "../../ui/primitives";

function toFormState(project) {
  return {
    name: project?.name || "",
    owner: project?.owner || "",
    description: project?.description || "",
    status: project?.status || "Active",
    startDate: project?.startDate || "",
    targetEndDate: project?.targetEndDate || "",
  };
}

export default function ProjectForm({
  initialValue = null,
  onSubmit,
  onCancel,
  submitLabel = "Create project",
}) {
  const [form, setForm] = useState(() => toFormState(initialValue));
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError("");
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Give the project a name.");
      return;
    }

    if (form.startDate && form.targetEndDate && form.targetEndDate < form.startDate) {
      setError("The target end date must be on or after the start date.");
      return;
    }

    onSubmit({
      ...initialValue,
      ...form,
      name: form.name.trim(),
      owner: form.owner.trim(),
      description: form.description.trim(),
      updatedAt: new Date().toISOString(),
    });

    if (!initialValue) {
      setForm(toFormState(null));
    }
  }

  const statuses = PROJECT_STATUSES.includes(form.status)
    ? PROJECT_STATUSES
    : [form.status, ...PROJECT_STATUSES];

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Field label="Project name" htmlFor="project-name" required>
        <input
          id="project-name"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="e.g. Website relaunch"
          className={inputClass}
          aria-invalid={Boolean(error) && !form.name.trim()}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Owner" htmlFor="project-owner" hint="Who is accountable for it">
          <input
            id="project-owner"
            name="owner"
            value={form.owner}
            onChange={handleChange}
            placeholder="Name"
            className={inputClass}
          />
        </Field>

        <Field label="Status" htmlFor="project-status">
          <select
            id="project-status"
            name="status"
            value={form.status}
            onChange={handleChange}
            className={inputClass}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Start date" htmlFor="project-start">
          <input
            id="project-start"
            name="startDate"
            type="date"
            value={form.startDate}
            onChange={handleChange}
            className={inputClass}
          />
        </Field>

        <Field label="Target end date" htmlFor="project-end">
          <input
            id="project-end"
            name="targetEndDate"
            type="date"
            value={form.targetEndDate}
            min={form.startDate || undefined}
            onChange={handleChange}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Description" htmlFor="project-description" hint="One or two sentences on the goal">
        <textarea
          id="project-description"
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="What will this project deliver?"
          className={`${inputClass} min-h-[90px]`}
        />
      </Field>

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        {onCancel ? <Button onClick={onCancel}>Cancel</Button> : null}
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
