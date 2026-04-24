function SummaryCard({ label, value, subtitle }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
        {value}
      </div>
      {subtitle ? <div className="mt-0.5 text-[11px] text-slate-500">{subtitle}</div> : null}
    </div>
  );
}

export default function SummaryCards({ summary }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      <SummaryCard label="Total Tasks" value={summary.total || 0} />
      <SummaryCard label="Completed" value={summary.completed || 0} />
      <SummaryCard label="Overdue" value={summary.overdue || 0} />
      <SummaryCard label="Milestones" value={summary.milestones || 0} />
      <SummaryCard label="Planned Avg" value={`${summary.plannedAvg || 0}%`} />
      <SummaryCard
        label="Actual Avg"
        value={`${summary.actualAvg || 0}%`}
        subtitle={`Variance: ${summary.variance || 0}%`}
      />
    </div>
  );
}