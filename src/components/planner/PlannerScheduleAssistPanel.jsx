import { useMemo, useState } from "react";
import { AlertTriangle, CalendarSync, ChevronDown, ShieldAlert, ShieldCheck, Wrench } from "lucide-react";
import { getPlannerQuickFixes } from "../../utils/planner";
import { Badge, Button, Segmented, cx } from "../../ui/primitives";

const RISK_TONE = { High: "red", Medium: "amber", Low: "green" };

function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * One slim bar above the schedule grid: overall risk, issue counts, the
 * scheduling mode and Recalculate. Issue details open on demand.
 */
export default function PlannerScheduleAssistPanel({
  tasks,
  conflicts,
  riskSummary,
  schedulingMode,
  onChangeMode,
  onRecalculate,
  onSelectConflictTask,
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState("conflicts");
  const quickFixes = useMemo(() => getPlannerQuickFixes(tasks), [tasks]);

  const riskLevel = riskSummary?.riskLevel || "Low";
  const RiskIcon = riskLevel === "Low" ? ShieldCheck : ShieldAlert;
  const issueCount = conflicts.length + quickFixes.length;

  const summary = [
    plural(conflicts.length, "date conflict"),
    `${riskSummary?.overdueCount || 0} overdue`,
    `${riskSummary?.blockedCount || 0} blocked`,
    plural(quickFixes.length, "suggested fix", "suggested fixes"),
  ].join(" · ");

  const items =
    panel === "conflicts"
      ? conflicts.map((conflict) => ({ id: conflict.taskId, title: conflict.taskTitle, text: conflict.message }))
      : quickFixes.map((fix) => ({ id: fix.taskId, title: fix.taskTitle, text: fix.fix, severity: fix.severity }));

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Badge tone={RISK_TONE[riskLevel]}>
            <RiskIcon className="h-3.5 w-3.5" aria-hidden /> {riskLevel} risk
          </Badge>
          <span className="text-slate-500">{summary}</span>
          {issueCount ? (
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              {open ? "Hide issues" : "Review issues"}
              <ChevronDown className={cx("h-4 w-4 transition", open ? "rotate-180" : "")} aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-slate-500 sm:inline">Scheduling</span>
          <Segmented
            label="Scheduling mode"
            value={schedulingMode}
            onChange={onChangeMode}
            options={[
              { value: "manual", label: "Manual", title: "Locked tasks keep their dates when you recalculate" },
              { value: "auto", label: "Auto", title: "Every task is re-dated from its dependencies" },
            ]}
          />
          <Button size="sm" icon={CalendarSync} onClick={onRecalculate} title="Re-date tasks from durations and dependencies">
            Recalculate
          </Button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="mb-2 flex gap-2">
            {[
              ["conflicts", `Date conflicts (${conflicts.length})`, AlertTriangle],
              ["fixes", `Suggested fixes (${quickFixes.length})`, Wrench],
            ].map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPanel(key)}
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
                  panel === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
              </button>
            ))}
          </div>
          {items.length === 0 ? (
            <p className="py-2 text-sm text-slate-500">Nothing to fix here.</p>
          ) : (
            <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
              {items.slice(0, 12).map((item, index) => (
                <li key={`${item.id}-${index}`}>
                  <button
                    type="button"
                    onClick={() => onSelectConflictTask?.(item.id)}
                    className="flex w-full items-start gap-3 px-1 py-2 text-left hover:bg-slate-50"
                  >
                    {item.severity ? (
                      <Badge tone={item.severity === "high" ? "red" : item.severity === "medium" ? "amber" : "slate"}>
                        {item.severity}
                      </Badge>
                    ) : null}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">{item.title}</span>
                      <span className="block text-xs text-slate-500">{item.text}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
