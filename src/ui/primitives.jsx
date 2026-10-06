import { useEffect, useId, useRef } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useFeedbackStore } from "./feedback";

export function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

const BUTTON_VARIANTS = {
  primary:
    "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-indigo-600",
  dark: "bg-slate-900 text-white shadow-sm hover:bg-slate-800 focus-visible:outline-slate-900",
  secondary:
    "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-slate-400",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-slate-400",
  danger:
    "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 focus-visible:outline-red-500",
  ai: "bg-violet-600 text-white shadow-sm hover:bg-violet-700 focus-visible:outline-violet-600",
};

const BUTTON_SIZES = {
  sm: "h-8 gap-1.5 rounded-lg px-2.5 text-xs",
  md: "h-9 gap-2 rounded-lg px-3.5 text-sm",
  lg: "h-11 gap-2 rounded-lg px-5 text-sm",
};

/** Class names for links that should look like buttons. */
export function buttonClass(variant = "secondary", size = "md") {
  return cx(
    "inline-flex shrink-0 items-center justify-center font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size]
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  className = "",
  children,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      {...props}
      className={cx(
        "inline-flex shrink-0 items-center justify-center font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className
      )}
    >
      {Icon ? <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden /> : null}
      {children}
    </button>
  );
}

export function Card({ className = "", children, ...props }) {
  return (
    <section
      {...props}
      className={cx("rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]", className)}
    >
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, icon: Icon, actions, className = "" }) {
  return (
    <div className={cx("flex flex-wrap items-start justify-between gap-3 px-5 pt-4", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <Icon className="h-4 w-4" aria-hidden />
          </div>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-600">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, children, className = "" }) {
  return (
    <div
      className={cx(
        "flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center",
        className
      )}
    >
      {Icon ? (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p> : null}
      {children ? <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}

const BADGE_TONES = {
  slate: "bg-slate-100 text-slate-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
  violet: "bg-violet-100 text-violet-700",
};

export function Badge({ tone = "slate", className = "", children }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        BADGE_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({ value = 0, tone = "indigo", label }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const color =
    tone === "green" ? "bg-emerald-500" : tone === "red" ? "bg-red-500" : tone === "amber" ? "bg-amber-500" : "bg-indigo-600";
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2 overflow-hidden rounded-full bg-slate-100"
    >
      <div className={cx("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Field({ label, hint, required, children, htmlFor }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

/** Accessible modal dialog: focus moves in, Escape closes, focus returns. */
export function Modal({ open, onClose, title, description, children, footer, size = "md" }) {
  const titleId = useId();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const firstField = panel?.querySelector(
      "input, select, textarea, button:not([data-modal-close])"
    );
    (firstField || panel)?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }

    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const width = size === "lg" ? "max-w-3xl" : size === "sm" ? "max-w-md" : "max-w-xl";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          "relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none sm:rounded-2xl",
          width
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              {title}
            </h2>
            {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button
            type="button"
            data-modal-close
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const TOAST_STYLES = {
  success: { icon: CheckCircle2, className: "border-emerald-200 bg-emerald-50 text-emerald-900" },
  error: { icon: XCircle, className: "border-red-200 bg-red-50 text-red-900" },
  warning: { icon: AlertTriangle, className: "border-amber-200 bg-amber-50 text-amber-900" },
  info: { icon: Info, className: "border-slate-200 bg-white text-slate-900" },
};

/** Renders toasts and the confirmation dialog. Mount once at the app root. */
export function FeedbackHost() {
  const toasts = useFeedbackStore((state) => state.toasts);
  const dismissToast = useFeedbackStore((state) => state.dismissToast);
  const dialog = useFeedbackStore((state) => state.dialog);
  const closeDialog = useFeedbackStore((state) => state.closeDialog);

  return (
    <>
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const style = TOAST_STYLES[toast.tone] || TOAST_STYLES.info;
          const Icon = style.icon;
          return (
            <div
              key={toast.id}
              role={toast.tone === "error" ? "alert" : "status"}
              className={cx(
                "pointer-events-auto flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm shadow-lg",
                style.className
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">{toast.message}</div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="rounded p-0.5 opacity-60 hover:opacity-100"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <Modal
        open={Boolean(dialog)}
        onClose={() => closeDialog(false)}
        title={dialog?.title || ""}
        size="sm"
        footer={
          <>
            <Button onClick={() => closeDialog(false)}>{dialog?.cancelLabel || "Cancel"}</Button>
            <Button
              variant={dialog?.tone === "danger" ? "danger" : "primary"}
              onClick={() => closeDialog(true)}
              data-testid="confirm-dialog-confirm"
            >
              {dialog?.confirmLabel || "Confirm"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{dialog?.message}</p>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Layout helpers shared by every screen, so they all look the same.  */
/* ------------------------------------------------------------------ */

/** Card with a header bar (title, optional subtitle and actions) and a body. */
export function Panel({ title, subtitle, icon: Icon, actions, children, className = "", bodyClassName = "", ...props }) {
  return (
    <section
      {...props}
      className={cx("overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]", className)}
    >
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon ? <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden /> : null}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-slate-900">{title}</h2>
              {subtitle ? <p className="truncate text-xs text-slate-500">{subtitle}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** A row of numbers inside one card, separated by dividers. */
export function StatStrip({ items, className = "" }) {
  return (
    <dl
      className={cx(
        "grid divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:divide-x sm:divide-y-0",
        className
      )}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0 px-4 py-3">
          <dt className="truncate text-xs font-medium text-slate-500">{item.label}</dt>
          <dd className={cx("mt-1 truncate text-xl font-semibold tracking-tight", item.tone || "text-slate-900")}>
            {item.value}
          </dd>
          {item.hint ? <p className="mt-0.5 truncate text-[11px] text-slate-400">{item.hint}</p> : null}
        </div>
      ))}
    </dl>
  );
}

/** Underline tabs. items: [{ key, label, icon?, count? }] */
export function Tabs({ items, value, onChange, label, className = "" }) {
  return (
    <div className={cx("overflow-x-auto border-b border-slate-200", className)}>
      <div role="tablist" aria-label={label} className="flex min-w-max gap-1">
        {items.map((item) => {
          const active = item.key === value;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(item.key)}
              className={cx(
                "-mb-px inline-flex items-center gap-2 border-b-2 px-3 pb-2.5 pt-2 text-sm font-medium transition",
                active
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
              )}
            >
              {item.icon ? <item.icon className="h-4 w-4" aria-hidden /> : null}
              {item.label}
              {item.count !== undefined ? (
                <span className={cx("rounded-full px-1.5 text-[11px]", active ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500")}>
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Small segmented switch, e.g. Manual / Auto. */
export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-slate-100 p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cx(
              "rounded-md px-2.5 py-1 text-xs font-medium transition",
              active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Consistent table styling. columns: [{ key, label, className, render }] */
export function DataTable({ columns, rows, rowKey = "id", empty = "Nothing here yet.", onRowClick }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70 text-left">
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cx("whitespace-nowrap px-4 py-2.5 text-xs font-medium text-slate-500", column.className)}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-slate-500">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row[rowKey]}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cx("bg-white", onRowClick ? "cursor-pointer hover:bg-slate-50" : "")}
              >
                {columns.map((column) => (
                  <td key={column.key} className={cx("px-4 py-2.5 align-middle text-slate-700", column.className)}>
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Avatar({ name, size = "md" }) {
  const label = String(name || "?").trim();
  const initials = label === "Unassigned" ? "–" : label.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const palette = ["bg-indigo-100 text-indigo-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-800", "bg-sky-100 text-sky-700", "bg-rose-100 text-rose-700", "bg-violet-100 text-violet-700"];
  const color = label === "Unassigned" ? "bg-slate-100 text-slate-400" : palette[[...label].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % palette.length];
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs",
        color
      )}
      title={label}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}

const STATUS_TONES = {
  "Not Started": "slate",
  "In Progress": "blue",
  Done: "green",
  Blocked: "red",
};

export function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONES[status] || "slate"}>{status || "Not Started"}</Badge>;
}
