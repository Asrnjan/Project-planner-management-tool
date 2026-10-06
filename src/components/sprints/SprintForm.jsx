import { useState } from "react";
import { Button, Field, inputClass } from "../../ui/primitives";

const EMPTY = { name: "", goal: "", startDate: "", endDate: "" };

export default function SprintForm({ projectId, initialValue = null, onSubmit, onCancel, submitLabel = "Create sprint" }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...(initialValue || {}) }));
  const [error, setError] = useState("");

  function update(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Give the sprint a name.");
      return;
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setError("The end date must be on or after the start date.");
      return;
    }
    onSubmit({
      name: form.name.trim(),
      goal: form.goal.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      ...(projectId ? { projectId } : {}),
    });
    if (!initialValue) setForm(EMPTY);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sprint name" htmlFor="sprint-name" required>
          <input id="sprint-name" name="name" value={form.name} onChange={update} placeholder="e.g. Sprint 4" className={inputClass} />
        </Field>
        <Field label="Goal" htmlFor="sprint-goal">
          <input id="sprint-goal" name="goal" value={form.goal} onChange={update} placeholder="What this sprint delivers" className={inputClass} />
        </Field>
        <Field label="Start date" htmlFor="sprint-start">
          <input id="sprint-start" name="startDate" type="date" value={form.startDate} onChange={update} className={inputClass} />
        </Field>
        <Field label="End date" htmlFor="sprint-end">
          <input id="sprint-end" name="endDate" type="date" value={form.endDate} min={form.startDate || undefined} onChange={update} className={inputClass} />
        </Field>
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        {onCancel ? <Button onClick={onCancel}>Cancel</Button> : null}
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
