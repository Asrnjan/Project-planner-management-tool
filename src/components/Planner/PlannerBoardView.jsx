import { useState } from "react";
import {
  CheckCircle2,
  CircleDashed,
  PauseCircle,
  PlayCircle,
  CircleUserRound,
  Milestone,
} from "lucide-react";

const columns = ["Not Started", "In Progress", "Done", "Blocked"];

function getColumnIcon(status) {
  switch (status) {
    case "Not Started":
      return CircleDashed;
    case "In Progress":
      return PlayCircle;
    case "Done":
      return CheckCircle2;
    case "Blocked":
      return PauseCircle;
    default:
      return CircleDashed;
  }
}

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

function PriorityBadge({ priority }) {
  const cls =
    priority === "High"
      ? "bg-red-100 text-red-700"
      : priority === "Low"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-amber-100 text-amber-700";

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {priority || "Medium"}
    </span>
  );
}

function QuickActionButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl bg-slate-100 px-2.5 py-1.5 text-[10px] font-medium text-slate-700 transition hover:bg-slate-200"
    >
      {children}
    </button>
  );
}

function TaskCard({ task, onDragStart, onQuickMove }) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(task)}
      className="cursor-grab rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-slate-900">
            {task.title}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
              <CircleUserRound className="h-3.5 w-3.5" />
              {task.owner || "Unassigned"}
            </div>

            {task.isMilestone ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                <Milestone className="h-3 w-3" />
                Milestone
              </span>
            ) : null}
          </div>
        </div>

        <PriorityBadge priority={task.priority} />
      </div>

      <div className="mt-3 grid gap-1 text-[11px] text-slate-500">
        <div>Plan: {task.plannedStart || "-"} to {task.plannedEnd || "-"}</div>
        <div>Actual: {task.actualProgress || 0}%</div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {task.status !== "Not Started" && (
          <QuickActionButton onClick={() => onQuickMove(task, "Not Started")}>
            To Do
          </QuickActionButton>
        )}
        {task.status !== "In Progress" && (
          <QuickActionButton onClick={() => onQuickMove(task, "In Progress")}>
            Start
          </QuickActionButton>
        )}
        {task.status !== "Done" && (
          <QuickActionButton onClick={() => onQuickMove(task, "Done")}>
            Done
          </QuickActionButton>
        )}
        {task.status !== "Blocked" && (
          <QuickActionButton onClick={() => onQuickMove(task, "Blocked")}>
            Block
          </QuickActionButton>
        )}
      </div>
    </div>
  );
}

export default function PlannerBoardView({ tasks, onUpdateTask }) {
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [hoverColumn, setHoverColumn] = useState("");

  function handleDragStart(task) {
    setDraggedTaskId(task.id);
    window.__dragTaskId = task.id;
  }

  function handleDrop(status) {
    const taskId = window.__dragTaskId || draggedTaskId;
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    onUpdateTask(taskId, getSuggestedUpdates(status, task));
    setDraggedTaskId(null);
    setHoverColumn("");
    window.__dragTaskId = null;
  }

  function handleQuickMove(task, status) {
    onUpdateTask(task.id, getSuggestedUpdates(status, task));
  }

  function handleDragEnd() {
    setDraggedTaskId(null);
    setHoverColumn("");
    window.__dragTaskId = null;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {columns.map((status) => {
        const statusTasks = tasks.filter((task) => task.status === status);
        const Icon = getColumnIcon(status);
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
            className={`rounded-3xl border p-3 transition ${
              isHovering
                ? "border-slate-400 bg-slate-100"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{status}</h3>
              </div>

              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600 shadow-sm">
                {statusTasks.length}
              </span>
            </div>

            <div className="min-h-[180px] space-y-2">
              {statusTasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-400">
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