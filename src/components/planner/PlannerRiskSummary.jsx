import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";

function getRiskTone(riskLevel) {
  switch (riskLevel) {
    case "High":
      return {
        wrap: "border-red-200 bg-red-50",
        text: "text-red-700",
        icon: ShieldAlert,
      };
    case "Medium":
      return {
        wrap: "border-amber-200 bg-amber-50",
        text: "text-amber-700",
        icon: AlertTriangle,
      };
    default:
      return {
        wrap: "border-emerald-200 bg-emerald-50",
        text: "text-emerald-700",
        icon: ShieldCheck,
      };
  }
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl bg-white/80 px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tracking-tight text-slate-900">
        {value}
      </div>
    </div>
  );
}

export default function PlannerRiskSummary({ summary }) {
  const tone = getRiskTone(summary.riskLevel);
  const Icon = tone.icon;

  return (
    <div className={`rounded-2xl border p-3 shadow-sm ${tone.wrap}`}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white ${tone.text}`}>
            <Icon className="h-4 w-4" />
          </div>

          <div>
            <div className="text-xs font-semibold tracking-tight text-slate-900">
              {summary.riskLevel} Risk
            </div>
            <div className="text-[11px] text-slate-600">
              Warnings, blocked tasks, overdue work, and critical items.
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Warnings" value={summary.warningCount} />
          <Metric label="Critical" value={summary.criticalCount} />
          <Metric label="Blocked" value={summary.blockedCount} />
          <Metric label="Overdue" value={summary.overdueCount} />
        </div>
      </div>
    </div>
  );
}