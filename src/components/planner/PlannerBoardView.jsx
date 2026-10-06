import { useRef, useState } from "react";
import { CalendarDays, Milestone } from "lucide-react";
import { Avatar } from "../../ui/primitives";

const columns = ["Not Started", "In Progress", "Done", "Blocked"];

function getSuggestedUpdates(status, task) {
  if (status === "Done") {
    return {
      status: "Done",
      actualProgress: 100,
      plannedProgress: Math.max(Number(task.plannedProgress || 0), 100),
    };
  }

  if (status === "In Progress") {
    return {
      status: "In Progress",
      actualProgress:
        Number(task.actualProgress || 0) === 0 ? 25 : Number(task.actualProgress || 0),
    };
  }

  if (status === "Not Started") {
    return {
      status: "Not Started",
      actualProgress: 0,
    };
  }

  if (status === "Blocked") {
    return {
      status: "Blocked",
    };
  }

  return { status };
}

const PRIORITY_DOT = {
  Critical: "bg-red-600",
  High: "bg-orange-500",
  Medium: "bg-amber-400",
  Low: "bg-slate-300",
};

const COLUMN_DOT = {
  "Not Started": "bg-slate-400",
  "In Progress": "bg-blue-500",
  Done: "bg-emerald-500",
  Blocked: "bg-red-500",
};

const MOVE_LABELS = {
  "Not Started": "To Do",
  "In Progress": "Start",
  Done: "Done",
  Blocked: "Block",
};

function formatDue(iso) {
  if (!iso) return "";
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function TaskCard({ task, onDragStart, onQuickMove }) {
  const today = new Date().toISOString().slice(0, 10);
  const due = task.plannedEnd || task.plannedStart;
  const late = due && due < today && task.status !== "Done";
  const progress = Math.max(0, Math.min(100, Number(task.actualProgress || 0)));

  return (
    <div
      draggable
      onDragStart={() => onDragStart(task)}
      className="group cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition hover:border-slate-300 hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority] || PRIORITY_DOT.Medium}`}
          title={`${task.priority || "Medium"} priority`}
          aria-label={`${task.priority || "Medium"} priority`}
        />
        <div className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-5 text-slate-900">
          {task.isMilestone ? <Milestone className="mr-1 inline h-3.5 w-3.5 text-violet-600" aria-label="Milestone" /> : null}
          {task.title}
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-slate-500">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Avatar name={task.owner || "Unassigned"} size="sm" />
          <span className="truncate">{task.owner || "Unassigned"}</span>
        </span>
        {due ? (
          <span className={`inline-flex shrink-0 items-center gap-1 ${late ? "font-medium text-red-600" : ""}`}>
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            {formatDue(due)}
          </span>
        ) : null}
      </div>

      {progress > 0 && task.status !== "Done" ? (
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-slate-100" aria-label={`${progress}% done`}>
          <div className="h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 pt-2">
        {columns
          .filter((status) => status !== task.status)
          .map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => onQuickMove(task, status)}
              className="text-xs font-medium text-slate-500 hover:text-indigo-700"
            >
              {MOVE_LABELS[status]}
            </button>
          ))}
      </div>
    </div>
  );
}

export default function PlannerBoardView({ tasks, onUpdateTask }) {
  const draggedTaskIdRef = useRef(null);
  const [hoverColumn, setHoverColumn] = useState("");

  function handleDragStart(task) {
    draggedTaskIdRef.current = task.id;
  }

  function handleDrop(status) {
    const taskId = draggedTaskIdRef.current;
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (task.status !== status) {
      onUpdateTask(taskId, getSuggestedUpdates(status, task));
    }

    draggedTaskIdRef.current = null;
    setHoverColumn("");
  }

  function handleQuickMove(task, status) {
    onUpdateTask(task.id, getSuggestedUpdates(status, task));
  }

  function handleDragEnd() {
    draggedTaskIdRef.current = null;
    setHoverColumn("");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {columns.map((status) => {
        // Tasks with an unrecognised status are shown under "Not Started"
        // instead of disappearing from the board.
        const statusTasks = tasks.filter((task) =>
          columns.includes(task.status)
            ? task.status === status
            : status === "Not Started"
        );
        const isHovering = hoverColumn === status;

        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              setHoverColumn(status);
            }}
            onDragLeave={() => {
              if (hoverColumn === status) setHoverColumn("");
            }}
            onDrop={() => handleDrop(status)}
            className={`rounded-xl border p-2.5 transition ${
              isHovering ? "border-indigo-300 bg-indigo-50/60" : "border-slate-200 bg-slate-100/60"
            }`}
          >
            <div className="mb-2.5 flex items-center justify-between px-1.5 pt-1">
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                <span className={`h-2 w-2 rounded-full ${COLUMN_DOT[status]}`} aria-hidden />
                {status}
              </h3>
              <span className="text-xs font-medium text-slate-500">{statusTasks.length}</span>
            </div>

            <div className="min-h-[180px] space-y-2">
              {statusTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">
                  {isHovering ? "Release to move task here" : "Drop task here"}
                </div>
              ) : (
                statusTasks.map((task) => (
                  <div key={task.id} onDragEnd={handleDragEnd}>
                    <TaskCard
                      task={task}
                      onDragStart={handleDragStart}
                      onQuickMove={handleQuickMove}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}