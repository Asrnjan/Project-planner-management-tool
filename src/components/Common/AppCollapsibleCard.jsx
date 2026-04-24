import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export default function AppCollapsibleCard({
  title,
  subtitle,
  defaultOpen = false,
  children,
  rightSlot,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {open ? (
              <ChevronDown className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-500" />
            )}
            <h3 className="text-sm font-semibold tracking-tight text-slate-900">
              {title}
            </h3>
          </div>
          {subtitle ? (
            <p className="mt-1 pl-6 text-xs text-slate-500">{subtitle}</p>
          ) : null}
        </div>

        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </button>

      {open ? (
        <div className="border-t border-slate-200 bg-slate-50/40 p-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}