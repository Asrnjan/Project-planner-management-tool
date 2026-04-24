import {
  BarChart3,
  CalendarRange,
  ClipboardList,
  FolderTree,
  LayoutGrid,
} from "lucide-react";

const iconMap = {
  overview: LayoutGrid,
  planning: FolderTree,
  timeline: CalendarRange,
  tasks: ClipboardList,
  sprints: BarChart3,
};

export default function SectionTabs({ tabs, activeTab, onChange }) {
  return (
    <div className="sticky top-[72px] z-30 rounded-2xl border border-slate-200 bg-white/90 p-1.5 shadow-sm backdrop-blur-xl">
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-1.5">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = iconMap[tab.key];

            return (
              <button
                key={tab.key}
                onClick={() => onChange(tab.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive
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