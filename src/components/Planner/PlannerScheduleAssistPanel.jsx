import { useMemo, useState } from "react";
import { getPlannerQuickFixes } from "../../utils/planner";
import { AlertTriangle, CalendarSync, Wrench } from "lucide-react";

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 text-xs font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function severityClass(severity) {
  switch (severity) {
    case "high":
      return "bg-red-100 text-red-700 border-red-200";
    case "medium":
      return "bg-amber-100 text-amber-700 border-amber-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function ListItem({ title, text, badge, badgeClass, onClick, clickable = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left ${
        clickable ? "transition hover:border-slate-300 hover:bg-slate-50" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        {badge ? (
          <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${badgeClass}`}>
            {badge}
          </span>
        ) : null}
        <div className="min-w-0">
          <div className="truncate text-[11px] font-medium text-slate-900">{title}</div>
          <div className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-slate-600">{text}</div>
        </div>
      </div>
    </button>
  );
}

export default function PlannerScheduleAssistPanel({
  tasks,
  conflicts,
  schedulingMode,
  onChangeMode,
  onRecalculate,
  onSelectConflictTask,
}) {
  const [activePanel, setActivePanel] = useState("conflicts");
  const quickFixes = useMemo(() => getPlannerQuickFixes(tasks), [tasks]);

  const highCount = quickFixes.filter((f) => f.severity === "high").length;
  const mediumCount = quickFixes.filter((f) => f.severity === "medium").length;

  const shownConflicts = conflicts.slice(0, 6);
  const shownFixes = quickFixes.slice(0, 6);

  const hasDetailContent = shownConflicts.length > 0 || shownFixes.length > 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-200 px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            <CalendarSync className="h-3 w-3" />
            Scheduling Assist
          </div>
          <div className="mt-0.5 text-xs font-semibold tracking-tight text-slate-900">
            Compact validation and recalculation controls
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex rounded-lg bg-slate-100 p-0.5">
            <button
              onClick={() => onChangeMode("manual")}
              className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition ${
                schedulingMode === "manual"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-700"
              }`}
            >
              Manual
            </button>
            <button
              onClick={() => onChangeMode("auto")}
              className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition ${
                schedulingMode === "auto"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-700"
              }`}
            >
              Auto
            </button>
          </div>

          <button
            onClick={onRecalculate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[10px] font-medium text-white transition hover:bg-slate-800"
          >
            <CalendarSync className="h-3 w-3" />
            Recalculate
          </button>
        </div>
      </div>

      <div className="grid gap-2 px-3 py-2.5 md:grid-cols-5">
        <Metric label="Tasks" value={tasks.length} />
        <Metric label="Conflicts" value={conflicts.length} />
        <Metric label="High" value={highCount} />
        <Metric label="Medium" value={mediumCount} />
        <Metric label="Mode" value={schedulingMode} />
      </div>

      {hasDetailContent && (
        <div className="border-t border-slate-200 px-3 py-2.5">
          <div className="mb-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActivePanel("conflicts")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-medium transition ${
                activePanel === "conflicts"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              <AlertTriangle className="h-3 w-3" />
              Conflicts
              <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px]">
                {conflicts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActivePanel("fixes")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-medium transition ${
                activePanel === "fixes"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              <Wrench className="h-3 w-3" />
              Quick Fixes
              <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px]">
                {quickFixes.length}
              </span>
            </button>
          </div>

          <div className="max-h-40 space-y-1.5 overflow-auto pr-1">
            {activePanel === "conflicts" ? (
              shownConflicts.length === 0 ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[10px] text-emerald-700">
                  No conflicts found.
                </div>
              ) : (
                shownConflicts.map((conflict, index) => (
                  <ListItem
                    key={`${conflict.taskId}-${index}`}
                    title={conflict.taskTitle}
                    text={`${conflict.message} Click to locate row.`}
                    onClick={() => onSelectConflictTask?.(conflict.taskId)}
                    clickable
                  />
                ))
              )
            ) : shownFixes.length === 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[10px] text-emerald-700">
                No quick fixes needed.
              </div>
            ) : (
              shownFixes.map((item, index) => (
                <ListItem
                  key={`${item.taskId}-${item.type}-${index}`}
                  title={item.taskTitle}
                  text={item.fix}
                  badge={item.severity}
                  badgeClass={severityClass(item.severity)}
                  onClick={() => onSelectConflictTask?.(item.taskId)}
                  clickable
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}