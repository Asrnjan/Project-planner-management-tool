import { useMemo, useState } from "react";
import { GitBranchPlus } from "lucide-react";

function compareSnapshotWithCurrent(snapshot, tasks) {
  const currentMap = Object.fromEntries(tasks.map((task) => [task.id, task]));
  let changedDates = 0;
  let missingTasks = 0;

  snapshot.tasks.forEach((snapTask) => {
    const current = currentMap[snapTask.id];
    if (!current) {
      missingTasks += 1;
      return;
    }

    const changed =
      current.plannedStart !== snapTask.plannedStart ||
      current.plannedEnd !== snapTask.plannedEnd;

    if (changed) changedDates += 1;
  });

  return { changedDates, missingTasks };
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold tracking-tight text-slate-900">
        {value}
      </div>
    </div>
  );
}

export default function PlannerBaselinePanel({
  selectedProjectId,
  tasks,
  snapshots,
  onCreateSnapshot,
}) {
  const [snapshotName, setSnapshotName] = useState("");

  const relevantSnapshots = useMemo(() => {
    return snapshots.filter((snapshot) =>
      selectedProjectId ? snapshot.projectId === selectedProjectId : true
    );
  }, [snapshots, selectedProjectId]);

  function handleCreate() {
    onCreateSnapshot({
      name: snapshotName,
      projectId: selectedProjectId,
    });
    setSnapshotName("");
    alert("Baseline snapshot created.");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              <GitBranchPlus className="h-3.5 w-3.5" />
              Baseline Snapshots
            </div>
            <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
              Capture a planning checkpoint
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Save the current planned dates and compare them later.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row">
            <input
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              placeholder="Snapshot name"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm"
            />
            <button
              onClick={handleCreate}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white"
            >
              Create Snapshot
            </button>
          </div>
        </div>
      </div>

      {relevantSnapshots.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
          No baseline snapshots found for this view.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {relevantSnapshots.map((snapshot) => {
            const diff = compareSnapshotWithCurrent(snapshot, tasks);

            return (
              <div
                key={snapshot.id}
                className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">{snapshot.name}</h4>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {new Date(snapshot.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="mt-3 grid gap-2 grid-cols-3">
                  <Stat label="Tasks" value={snapshot.tasks.length} />
                  <Stat label="Changes" value={diff.changedDates} />
                  <Stat label="Missing" value={diff.missingTasks} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}