import { usePlannerStore } from "../store/usePlannerStore";
import PlannerScheduleTable from "../components/planner/PlannerScheduleTable";

export default function PlannerPage() {
  const { tasks, updateTask } = usePlannerStore();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Project Planner Module</h2>
        <p className="mt-2 text-slate-600">
          This is the dedicated planner module for schedule-based planning, similar to a Microsoft Project-style schedule table.
        </p>
      </div>

      <PlannerScheduleTable tasks={tasks} onUpdate={updateTask} />
    </div>
  );
}