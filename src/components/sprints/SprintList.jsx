import { useMemo, useState } from "react";
import { Milestone, Pencil, Plus, Timer, Trash2 } from "lucide-react";
import { usePlannerStore } from "../../store/usePlannerStore";
import { confirmAction, notify } from "../../ui/feedback";
import { Badge, Button, EmptyState, Modal, Panel, ProgressBar } from "../../ui/primitives";
import SprintForm from "./SprintForm";

function formatDate(iso) {
  if (!iso) return "—";
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function sprintPhase(sprint, today) {
  if (sprint.startDate && sprint.startDate > today) return { label: "Upcoming", tone: "slate" };
  if (sprint.endDate && sprint.endDate < today) return { label: "Completed", tone: "green" };
  if (sprint.startDate) return { label: "Active", tone: "blue" };
  return { label: "Not scheduled", tone: "slate" };
}

/** Sprints of one project, with create/edit dialogs. */
export default function SprintList({ projectId, sprints, onAdd, onDelete, onUpdate }) {
  const tasks = usePlannerStore((state) => state.tasks);
  const [dialog, setDialog] = useState(null); // { mode: "new" } | { mode: "edit", sprint }
  const today = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const map = {};
    sprints.forEach((sprint) => {
      const items = tasks.filter((task) => task.sprintId === sprint.id);
      map[sprint.id] = {
        total: items.length,
        done: items.filter((task) => task.status === "Done").length,
        milestones: items.filter((task) => task.isMilestone).map((task) => task.title),
      };
    });
    return map;
  }, [sprints, tasks]);

  const ordered = [...sprints].sort((a, b) => String(a.startDate || "9").localeCompare(String(b.startDate || "9")));

  async function remove(sprint) {
    const ok = await confirmAction({
      title: `Delete "${sprint.name}"?`,
      message: "Its tasks are kept and simply no longer belong to a sprint.",
      confirmLabel: "Delete sprint",
    });
    if (ok) {
      onDelete(sprint.id);
      notify.success("Sprint deleted.");
    }
  }

  return (
    <>
      <Panel
        title="Sprints"
        subtitle="Fixed periods, often two weeks, each with a goal. Assign tasks to a sprint in the Schedule."
        icon={Timer}
        actions={
          <Button size="sm" variant="primary" icon={Plus} onClick={() => setDialog({ mode: "new" })}>
            New sprint
          </Button>
        }
      >
        {ordered.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={Timer} title="No sprints yet" description="Create your first sprint to group work into short iterations.">
              <Button variant="primary" icon={Plus} onClick={() => setDialog({ mode: "new" })}>
                New sprint
              </Button>
            </EmptyState>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {ordered.map((sprint) => {
              const stat = stats[sprint.id] || { total: 0, done: 0, milestones: [] };
              const phase = sprintPhase(sprint, today);
              const pct = stat.total ? Math.round((stat.done / stat.total) * 100) : 0;
              return (
                <li key={sprint.id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-slate-900">{sprint.name}</h3>
                      <Badge tone={phase.tone}>{phase.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
                      {sprint.goal ? ` · ${sprint.goal}` : ""}
                    </p>
                    {stat.milestones.length ? (
                      <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-violet-700">
                        <Milestone className="h-3.5 w-3.5" aria-hidden /> {stat.milestones.join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span>
                        {stat.done} of {stat.total} tasks done
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <ProgressBar value={pct} tone={pct === 100 ? "green" : "indigo"} label={`${sprint.name} progress`} />
                  </div>
                  <div className="flex gap-1 md:justify-end">
                    <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setDialog({ mode: "edit", sprint })}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(sprint)} aria-label={`Delete ${sprint.name}`}>
                      Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Modal open={Boolean(dialog)} onClose={() => setDialog(null)} title={dialog?.mode === "edit" ? "Edit sprint" : "New sprint"}>
        {dialog ? (
          <SprintForm
            projectId={projectId}
            initialValue={dialog.mode === "edit" ? dialog.sprint : null}
            submitLabel={dialog.mode === "edit" ? "Save changes" : "Create sprint"}
            onCancel={() => setDialog(null)}
            onSubmit={(values) => {
              if (dialog.mode === "edit") {
                onUpdate(dialog.sprint.id, values);
                notify.success("Sprint updated.");
              } else {
                onAdd(values);
                notify.success(`"${values.name}" created.`);
              }
              setDialog(null);
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}
