import {
  CalendarRange,
  KanbanSquare,
  Table2,
  Users,
  BarChart3,
  LayoutGrid,
  ListTodo,
} from "lucide-react";

const iconMap = {
  overview: LayoutGrid,
  schedule: Table2,
  board: KanbanSquare,
  timeline: CalendarRange,
  sprints: ListTodo,
  resources: Users,
  reports: BarChart3,
};

export default function PlannerTabs({ tabs, activeTab, onChange }) {
  return (
    <div className="sticky top-[72px] z-30 rounded-2xl border border-slate-200 bg-white/90 p-1.5 shadow-sm backdrop-blur-xl">
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-1.5">
          {tabs.map((tab) => {
            const Icon = iconMap[tab.key];
            const active = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                onClick={() => onChange(tab.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}