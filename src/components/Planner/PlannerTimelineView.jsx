import TimelineView from "../gantt/TimelineView";

export default function PlannerTimelineView({ tasks, onUpdateTask }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Planner Timeline</h3>
        <p className="mt-1 text-sm text-slate-500">
          Review the schedule visually and adjust planned dates in Day view.
        </p>
      </div>

      <TimelineView tasks={tasks} onUpdateTask={onUpdateTask} />
    </div>
  );
}