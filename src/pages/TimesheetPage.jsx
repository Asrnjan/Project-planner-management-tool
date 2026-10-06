import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  LogIn,
  LogOut,
  Pencil,
  Play,
  Plus,
  Send,
  Square,
  Trash2,
  Undo2,
  Users,
  X,
} from "lucide-react";

import {
  entryMinutes,
  formatMinutes,
  isAssignedTo,
  isEntryLocked,
  localDay,
} from "../domain/permissions";
import { useAccess, useAccessStore, useVisibleProjects } from "../store/useAccessStore";
import { usePlannerStore } from "../store/usePlannerStore";
import { confirmAction, notify } from "../ui/feedback";
import {
  Avatar,
  Badge,
  Button,
  DataTable,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Panel,
  StatStrip,
  Tabs,
  cx,
  inputClass,
} from "../ui/primitives";

const STATUS = {
  open: { label: "Draft", tone: "slate" },
  submitted: { label: "Waiting for approval", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
};

function startOfWeek(date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const offset = (day.getDay() + 6) % 7; // Monday first
  day.setDate(day.getDate() - offset);
  return day;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

const timeOf = (value) => (value ? new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "");
const dayLabel = (date) => date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });

function toInputValue(value) {
  const date = value ? new Date(value) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Re-renders every second while something is running. */
function useTicker(active) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

function elapsed(startedAt, now) {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ---------------------------------------------------------------- entry form

function EntryForm({ initial, tasks, onSubmit, onCancel, busy, requireNote }) {
  const [form, setForm] = useState(() => ({
    taskId: initial?.taskId || tasks[0]?.id || "",
    startedAt: toInputValue(initial?.startedAt || new Date(Date.now() - 3600000)),
    endedAt: toInputValue(initial?.endedAt || new Date()),
    note: initial?.note || "",
  }));
  const [error, setError] = useState("");

  function submit(event) {
    event.preventDefault();
    const task = tasks.find((item) => item.id === form.taskId);
    if (!task) return setError("Pick a task.");
    const startedAt = new Date(form.startedAt);
    const endedAt = new Date(form.endedAt);
    if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) return setError("Enter a start and an end time.");
    if (endedAt <= startedAt) return setError("The end time must be after the start time.");
    if (requireNote && !form.note.trim()) return setError("Add a short note describing the work.");
    onSubmit({
      taskId: task.id,
      projectId: task.projectId,
      taskTitle: task.title,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      note: form.note.trim(),
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Task" htmlFor="entry-task" required>
        <select id="entry-task" value={form.taskId} onChange={(e) => setForm({ ...form, taskId: e.target.value })} className={inputClass}>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title} — {task.projectName}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Started" htmlFor="entry-start" required>
          <input id="entry-start" type="datetime-local" value={form.startedAt} onChange={(e) => setForm({ ...form, startedAt: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Finished" htmlFor="entry-end" required>
          <input id="entry-end" type="datetime-local" value={form.endedAt} onChange={(e) => setForm({ ...form, endedAt: e.target.value })} className={inputClass} />
        </Field>
      </div>
      <Field label="What did you work on?" htmlFor="entry-note" required={requireNote}>
        <textarea id="entry-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={cx(inputClass, "min-h-[72px]")} maxLength={500} />
      </Field>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {initial ? "Save changes" : "Add time"}
        </Button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------ my timesheet

function MyTime({ access, weekStart, setWeekStart, myTasks }) {
  const service = useAccessStore((state) => state.service)();
  const rules = access.rules;
  const member = access.member;
  const context = useMemo(() => ({ rules, member, tasks: myTasks }), [rules, member, myTasks]);
  const [entries, setEntries] = useState([]);
  const [running, setRunning] = useState({ task: null, attendance: null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [timerTaskId, setTimerTaskId] = useState("");
  const [timerNote, setTimerNote] = useState("");
  const [dialog, setDialog] = useState(null);
  const now = useTicker(Boolean(running.task || running.attendance));
  const weekEnd = addDays(weekStart, 7);
  const userId = member?.userId || "";

  const load = useCallback(async () => {
    try {
      const [week, open] = await Promise.all([
        service.listEntries({ from: weekStart.toISOString(), to: weekEnd.toISOString(), userId }),
        service.listEntries({ userId, from: addDays(new Date(), -3).toISOString() }),
      ]);
      setEntries(week);
      setRunning({
        task: open.find((entry) => entry.kind === "task" && !entry.endedAt) || null,
        attendance: open.find((entry) => entry.kind === "attendance" && !entry.endedAt) || null,
      });
    } catch (error) {
      notify.error(error.message);
    } finally {
      setLoading(false);
    }
    // weekEnd derives from weekStart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, weekStart, userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action, success) {
    setBusy(true);
    try {
      await action();
      if (success) notify.success(success);
      await load();
    } catch (error) {
      notify.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  const taskEntries = entries.filter((entry) => entry.kind === "task");
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const minutesFor = (list) => list.reduce((sum, entry) => sum + entryMinutes(entry, now), 0);
  const total = minutesFor(taskEntries);
  const attendanceToday = minutesFor(entries.filter((entry) => entry.kind === "attendance" && localDay(entry.startedAt) === localDay(new Date())));
  const draftReady = taskEntries.filter((entry) => (entry.status === "open" || entry.status === "rejected") && entry.endedAt);
  const isThisWeek = startOfWeek(new Date()).getTime() === weekStart.getTime();

  const grid = (() => {
    const rows = new Map();
    taskEntries.forEach((entry) => {
      const key = entry.taskId;
      if (!rows.has(key)) rows.set(key, { id: key, title: entry.taskTitle || "Task", projectId: entry.projectId, days: Array(7).fill(0) });
      const index = Math.floor((new Date(entry.startedAt) - weekStart) / 86400000);
      if (index >= 0 && index < 7) rows.get(key).days[index] += entryMinutes(entry, now);
    });
    return [...rows.values()];
  })();

  const selectedTimerTask = myTasks.find((task) => task.id === (timerTaskId || myTasks[0]?.id));

  return (
    <div className="space-y-4">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel title="Attendance" subtitle="Clock in when you start, out when you finish." icon={CalendarClock}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              {running.attendance ? (
                <>
                  <div className="text-sm text-slate-500">Clocked in at {timeOf(running.attendance.startedAt)}</div>
                  <div className="font-mono text-2xl font-semibold tabular-nums text-slate-900" data-testid="attendance-clock">
                    {elapsed(running.attendance.startedAt, now)}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm text-slate-500">Not clocked in</div>
                  <div className="text-2xl font-semibold text-slate-900">{formatMinutes(attendanceToday)} today</div>
                </>
              )}
            </div>
            {running.attendance ? (
              <Button variant="dark" icon={LogOut} disabled={busy} onClick={() => act(() => service.stopTimer(running.attendance.id, undefined, context), "Clocked out.")}>
                Clock out
              </Button>
            ) : (
              <Button variant="primary" icon={LogIn} disabled={busy} data-testid="clock-in" onClick={() => act(() => service.startTimer({ kind: "attendance" }, context), "Clocked in.")}>
                Clock in
              </Button>
            )}
          </div>
        </Panel>

        <Panel title="Task timer" subtitle="Time what you're working on." icon={Clock}>
          {running.task ? (
            <div className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900">{running.task.taskTitle}</div>
                  <div className="text-xs text-slate-500">Started {timeOf(running.task.startedAt)}</div>
                </div>
                <div className="font-mono text-2xl font-semibold tabular-nums text-indigo-700" data-testid="task-timer">
                  {elapsed(running.task.startedAt, now)}
                </div>
              </div>
              <div className="flex gap-2">
                <label className="flex-1">
                  <span className="sr-only">Note</span>
                  <input
                    value={timerNote}
                    onChange={(e) => setTimerNote(e.target.value)}
                    placeholder={rules.timesheet.requireNote ? "What did you work on? (required)" : "What did you work on? (optional)"}
                    className={inputClass}
                    maxLength={500}
                  />
                </label>
                <Button
                  variant="dark"
                  icon={Square}
                  disabled={busy}
                  data-testid="stop-timer"
                  onClick={() =>
                    act(async () => {
                      await service.stopTimer(running.task.id, timerNote || running.task.note, context);
                      setTimerNote("");
                    }, "Time saved.")
                  }
                >
                  Stop
                </Button>
              </div>
            </div>
          ) : myTasks.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-500">
              {rules.timesheet.onlyAssignedTasks
                ? "No open tasks are assigned to you. Time can only be logged on your own tasks."
                : "There are no open tasks to log time on."}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 px-5 py-4">
              <label className="min-w-[220px] flex-1">
                <span className="sr-only">Task</span>
                <select
                  value={selectedTimerTask?.id || ""}
                  onChange={(e) => setTimerTaskId(e.target.value)}
                  className={inputClass}
                  data-testid="timer-task"
                >
                  {myTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title} — {task.projectName}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="primary"
                icon={Play}
                disabled={busy || !selectedTimerTask}
                data-testid="start-timer"
                onClick={() =>
                  act(
                    () =>
                      service.startTimer(
                        { kind: "task", taskId: selectedTimerTask.id, projectId: selectedTimerTask.projectId, taskTitle: selectedTimerTask.title },
                        context
                      ),
                    "Timer started."
                  )
                }
              >
                Start
              </Button>
            </div>
          )}
        </Panel>
      </div>

      <StatStrip
        items={[
          { label: isThisWeek ? "This week" : "Week total", value: formatMinutes(total) },
          { label: "Draft", value: formatMinutes(minutesFor(taskEntries.filter((e) => e.status === "open"))) },
          { label: "Waiting for approval", value: formatMinutes(minutesFor(taskEntries.filter((e) => e.status === "submitted"))), tone: "text-amber-700" },
          { label: "Approved", value: formatMinutes(minutesFor(taskEntries.filter((e) => e.status === "approved"))), tone: "text-emerald-700" },
          { label: "Rejected", value: formatMinutes(minutesFor(taskEntries.filter((e) => e.status === "rejected"))), tone: "text-red-700" },
        ]}
      />

      <Panel
        title="Week"
        subtitle={`${weekStart.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${addDays(weekStart, 6).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`}
        icon={CalendarClock}
        actions={
          <>
            <div className="inline-flex items-center rounded-lg border border-slate-200">
              <button type="button" className="p-1.5 text-slate-600 hover:bg-slate-50" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" className="px-2 text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={() => setWeekStart(startOfWeek(new Date()))} disabled={isThisWeek}>
                This week
              </button>
              <button type="button" className="p-1.5 text-slate-600 hover:bg-slate-50" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            {rules.timesheet.allowManualEntries && myTasks.length ? (
              <Button size="sm" icon={Plus} onClick={() => setDialog({})} data-testid="add-time">
                Add time
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="primary"
              icon={Send}
              disabled={!draftReady.length || busy}
              data-testid="submit-week"
              onClick={() =>
                act(
                  () => service.setEntriesStatus(draftReady.map((entry) => entry.id), "submitted", "", context),
                  rules.timesheet.requireApproval ? "Sent for approval." : "Submitted."
                )
              }
            >
              Submit week{draftReady.length ? ` (${formatMinutes(minutesFor(draftReady))})` : ""}
            </Button>
          </>
        }
      >
        {loading ? (
          <p className="px-5 py-6 text-sm text-slate-500">Loading...</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm" data-testid="week-grid">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th scope="col" className="px-4 py-2.5 text-xs font-medium text-slate-500">Task</th>
                    {days.map((day) => (
                      <th
                        key={day.toISOString()}
                        scope="col"
                        className={cx("w-20 px-2 py-2.5 text-right text-xs font-medium", localDay(day) === localDay(new Date()) ? "text-indigo-700" : "text-slate-500")}
                      >
                        {dayLabel(day)}
                      </th>
                    ))}
                    <th scope="col" className="w-24 px-4 py-2.5 text-right text-xs font-medium text-slate-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {grid.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">
                        No time logged this week. Start the timer on a task, or add time manually.
                      </td>
                    </tr>
                  ) : (
                    grid.map((row) => (
                      <tr key={row.id}>
                        <td className="max-w-[280px] truncate px-4 py-2 font-medium text-slate-800">{row.title}</td>
                        {row.days.map((minutes, index) => (
                          <td key={index} className={cx("px-2 py-2 text-right tabular-nums", minutes ? "text-slate-800" : "text-slate-300")}>
                            {minutes ? formatMinutes(minutes) : "–"}
                          </td>
                        ))}
                        <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-900">{formatMinutes(row.days.reduce((a, b) => a + b, 0))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {grid.length ? (
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50/60">
                      <th scope="row" className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Total</th>
                      {days.map((day, index) => (
                        <td key={index} className="px-2 py-2 text-right text-xs font-semibold tabular-nums text-slate-700">
                          {formatMinutes(grid.reduce((sum, row) => sum + row.days[index], 0))}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-900">{formatMinutes(total)}</td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>

            {taskEntries.length ? (
              <div className="border-t border-slate-100">
                <DataTable
                  rows={taskEntries}
                  maxHeight="max-h-[420px]"
                  columns={[
                    { key: "day", label: "Day", className: "whitespace-nowrap", render: (entry) => dayLabel(new Date(entry.startedAt)) },
                    {
                      key: "task",
                      label: "Task",
                      render: (entry) => (
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-800">{entry.taskTitle}</div>
                          {entry.note ? <div className="truncate text-xs text-slate-500">{entry.note}</div> : null}
                          {entry.status === "rejected" && entry.reviewNote ? <div className="text-xs text-red-600">Reviewer: {entry.reviewNote}</div> : null}
                        </div>
                      ),
                    },
                    {
                      key: "time",
                      label: "Time",
                      className: "whitespace-nowrap tabular-nums",
                      render: (entry) => `${timeOf(entry.startedAt)} – ${entry.endedAt ? timeOf(entry.endedAt) : "running"}`,
                    },
                    { key: "duration", label: "Hours", className: "text-right tabular-nums", render: (entry) => formatMinutes(entryMinutes(entry, now)) },
                    {
                      key: "source",
                      label: "Recorded",
                      render: (entry) => <span className="text-xs text-slate-500">{entry.source === "timer" ? "Timer" : "Manual"}</span>,
                    },
                    { key: "status", label: "Status", render: (entry) => <Badge tone={STATUS[entry.status].tone}>{STATUS[entry.status].label}</Badge> },
                    {
                      key: "actions",
                      label: <span className="sr-only">Actions</span>,
                      className: "w-px whitespace-nowrap text-right",
                      render: (entry) => {
                        if (!entry.endedAt) return null;
                        if (entry.status === "submitted") {
                          return (
                            <Button size="sm" variant="ghost" icon={Undo2} disabled={busy} onClick={() => act(() => service.setEntriesStatus([entry.id], "open", "", context), "Moved back to draft.")}>
                              Withdraw
                            </Button>
                          );
                        }
                        if (isEntryLocked(entry, rules)) return <span className="text-xs text-slate-400">Locked</span>;
                        return (
                          <span className="inline-flex gap-1">
                            {rules.timesheet.allowManualEntries ? (
                              <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setDialog({ entry })} aria-label="Edit entry" />
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={Trash2}
                              aria-label="Delete entry"
                              onClick={async () => {
                                if (await confirmAction({ title: "Delete this time entry?", confirmLabel: "Delete" })) {
                                  act(() => service.deleteEntry(entry.id, context), "Entry deleted.");
                                }
                              }}
                            />
                          </span>
                        );
                      },
                    },
                  ]}
                />
              </div>
            ) : null}
          </>
        )}
      </Panel>

      <Modal open={Boolean(dialog)} onClose={() => setDialog(null)} title={dialog?.entry ? "Edit time" : "Add time"} size="md">
        {dialog ? (
          <EntryForm
            initial={dialog.entry}
            tasks={myTasks}
            requireNote={rules.timesheet.requireNote}
            busy={busy}
            onCancel={() => setDialog(null)}
            onSubmit={(values) =>
              act(async () => {
                if (dialog.entry) await service.updateEntry(dialog.entry.id, values, context);
                else await service.addManualEntry(values, context);
                setDialog(null);
              }, dialog.entry ? "Entry updated." : "Time added.")
            }
          />
        ) : null}
      </Modal>
    </div>
  );
}

// --------------------------------------------------------------- approvals

function Approvals({ access, memberName }) {
  const service = useAccessStore((state) => state.service)();
  const [entries, setEntries] = useState(null);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const context = useMemo(() => ({ rules: access.rules, member: access.member }), [access.rules, access.member]);

  const load = useCallback(async () => {
    try {
      const data = await service.listEntries({ status: "submitted" });
      setEntries(data.filter((entry) => entry.kind === "task"));
      setSelected([]);
    } catch (error) {
      notify.error(error.message);
      setEntries([]);
    }
  }, [service]);

  useEffect(() => {
    load();
  }, [load]);

  const canReviewOwn = access.member?.role === "admin";
  const reviewable = (entries || []).filter((entry) => canReviewOwn || entry.userId !== access.member?.userId);

  async function review(status, note = "") {
    setBusy(true);
    try {
      const ids = selected.length ? selected : reviewable.map((entry) => entry.id);
      await service.setEntriesStatus(ids, status, note, context);
      notify.success(status === "approved" ? `Approved ${ids.length} entries.` : `Sent ${ids.length} entries back.`);
      setRejecting(false);
      setReason("");
      await load();
    } catch (error) {
      notify.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  const byPerson = reviewable.reduce((acc, entry) => {
    acc[entry.userId] = (acc[entry.userId] || 0) + entryMinutes(entry);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <StatStrip
        items={[
          { label: "Waiting for approval", value: reviewable.length },
          { label: "Hours", value: formatMinutes(reviewable.reduce((sum, entry) => sum + entryMinutes(entry), 0)) },
          { label: "People", value: Object.keys(byPerson).length },
        ]}
      />
      <Panel
        title="Submitted time"
        subtitle={selected.length ? `${selected.length} selected` : "Select entries, or approve everything shown."}
        icon={Check}
        actions={
          <>
            <Button size="sm" icon={X} disabled={!reviewable.length || busy} onClick={() => setRejecting(true)}>
              Send back
            </Button>
            <Button size="sm" variant="primary" icon={Check} disabled={!reviewable.length || busy} onClick={() => review("approved")} data-testid="approve-time">
              {selected.length ? "Approve selected" : "Approve all"}
            </Button>
          </>
        }
      >
        <DataTable
          rows={reviewable}
          empty={entries ? "Nothing is waiting for approval." : "Loading..."}
          columns={[
            {
              key: "select",
              label: (
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={reviewable.length > 0 && selected.length === reviewable.length}
                  onChange={(e) => setSelected(e.target.checked ? reviewable.map((entry) => entry.id) : [])}
                />
              ),
              className: "w-8",
              render: (entry) => (
                <input
                  type="checkbox"
                  aria-label="Select entry"
                  checked={selected.includes(entry.id)}
                  onChange={(e) => setSelected((prev) => (e.target.checked ? [...prev, entry.id] : prev.filter((id) => id !== entry.id)))}
                />
              ),
            },
            {
              key: "person",
              label: "Person",
              render: (entry) => (
                <span className="inline-flex items-center gap-2">
                  <Avatar name={memberName(entry.userId)} size="sm" />
                  {memberName(entry.userId)}
                </span>
              ),
            },
            { key: "day", label: "Day", className: "whitespace-nowrap", render: (entry) => dayLabel(new Date(entry.startedAt)) },
            {
              key: "task",
              label: "Task",
              render: (entry) => (
                <div className="min-w-0">
                  <div className="truncate">{entry.taskTitle}</div>
                  {entry.note ? <div className="truncate text-xs text-slate-500">{entry.note}</div> : null}
                </div>
              ),
            },
            { key: "time", label: "Time", className: "whitespace-nowrap tabular-nums", render: (entry) => `${timeOf(entry.startedAt)} – ${timeOf(entry.endedAt)}` },
            { key: "hours", label: "Hours", className: "text-right tabular-nums", render: (entry) => formatMinutes(entryMinutes(entry)) },
            { key: "source", label: "Recorded", render: (entry) => (entry.source === "timer" ? "Timer" : <Badge tone="amber">Manual</Badge>) },
          ]}
        />
      </Panel>
      <Modal open={rejecting} onClose={() => setRejecting(false)} title="Send time back" size="sm">
        <div className="space-y-4">
          <Field label="Reason (shown to the person)" htmlFor="reject-reason">
            <textarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={cx(inputClass, "min-h-[80px]")} maxLength={300} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setRejecting(false)}>Cancel</Button>
            <Button variant="danger" disabled={busy} onClick={() => review("rejected", reason.trim())}>
              Send back {selected.length ? `${selected.length} entries` : "all"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// --------------------------------------------------------------- team view

function TeamTime({ weekStart, setWeekStart, memberName, members }) {
  const service = useAccessStore((state) => state.service)();
  const [entries, setEntries] = useState(null);
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  useEffect(() => {
    let cancelled = false;
    service
      .listEntries({ from: weekStart.toISOString(), to: addDays(weekStart, 7).toISOString() })
      .then((data) => !cancelled && setEntries(data.filter((entry) => entry.kind === "task" && entry.endedAt)))
      .catch((error) => notify.error(error.message));
    return () => {
      cancelled = true;
    };
  }, [service, weekStart]);

  const rows = useMemo(() => {
    const map = new Map();
    members.filter((member) => member.active).forEach((member) => map.set(member.userId, { id: member.userId || member.id, days: Array(7).fill(0), approved: 0, pending: 0 }));
    (entries || []).forEach((entry) => {
      if (!map.has(entry.userId)) map.set(entry.userId, { id: entry.userId, days: Array(7).fill(0), approved: 0, pending: 0 });
      const row = map.get(entry.userId);
      const index = Math.floor((new Date(entry.startedAt) - weekStart) / 86400000);
      const minutes = entryMinutes(entry);
      if (index >= 0 && index < 7) row.days[index] += minutes;
      if (entry.status === "approved") row.approved += minutes;
      if (entry.status === "submitted") row.pending += minutes;
    });
    return [...map.values()].filter((row) => row.id);
  }, [entries, members, weekStart]);

  return (
    <Panel
      title="Team hours"
      subtitle={`Week of ${weekStart.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
      icon={Users}
      actions={
        <div className="inline-flex items-center rounded-lg border border-slate-200">
          <button type="button" className="p-1.5 text-slate-600 hover:bg-slate-50" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" className="px-2 text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            This week
          </button>
          <button type="button" className="p-1.5 text-slate-600 hover:bg-slate-50" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      }
    >
      <DataTable
        rows={rows}
        empty={entries ? "No time logged this week." : "Loading..."}
        columns={[
          {
            key: "person",
            label: "Person",
            render: (row) => (
              <span className="inline-flex items-center gap-2">
                <Avatar name={memberName(row.id)} size="sm" />
                {memberName(row.id)}
              </span>
            ),
          },
          ...days.map((day, index) => ({
            key: `d${index}`,
            label: dayLabel(day),
            className: "text-right tabular-nums",
            render: (row) => (row.days[index] ? formatMinutes(row.days[index]) : <span className="text-slate-300">–</span>),
          })),
          { key: "total", label: "Total", className: "text-right font-semibold tabular-nums", render: (row) => formatMinutes(row.days.reduce((a, b) => a + b, 0)) },
          { key: "pending", label: "Waiting", className: "text-right tabular-nums text-amber-700", render: (row) => (row.pending ? formatMinutes(row.pending) : "–") },
          { key: "approved", label: "Approved", className: "text-right tabular-nums text-emerald-700", render: (row) => (row.approved ? formatMinutes(row.approved) : "–") },
        ]}
      />
    </Panel>
  );
}

// -------------------------------------------------------------------- page

export default function TimesheetPage() {
  const access = useAccess();
  const members = useAccessStore((state) => state.members);
  const allProjects = usePlannerStore((state) => state.projects);
  const projects = useVisibleProjects(allProjects);
  const tasks = usePlannerStore((state) => state.tasks);
  const [searchParams, setSearchParams] = useSearchParams();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const { permissions, rules, member } = access;

  const myTasks = useMemo(() => {
    const names = Object.fromEntries(projects.map((project) => [project.id, project.name]));
    return tasks
      .filter((task) => names[task.projectId] && task.status !== "Done" && !task.isSummaryTask)
      .filter((task) => !rules.timesheet.onlyAssignedTasks || isAssignedTo(task, member))
      .map((task) => ({ ...task, projectName: names[task.projectId] }));
  }, [tasks, projects, rules.timesheet.onlyAssignedTasks, member]);

  const memberName = useCallback(
    (userId) => {
      const found = members.find((item) => item.userId === userId || item.id === userId);
      return found ? found.displayName || found.email : "Former member";
    },
    [members]
  );

  const tabs = [
    permissions["timesheet.log"] ? { key: "mine", label: "My time", icon: Clock } : null,
    permissions["timesheet.approve"] ? { key: "approvals", label: "Approvals", icon: Check } : null,
    permissions["timesheet.view_all"] || permissions["timesheet.approve"] ? { key: "team", label: "Team hours", icon: Users } : null,
  ].filter(Boolean);
  const active = tabs.find((tab) => tab.key === searchParams.get("tab"))?.key || tabs[0]?.key;

  if (!tabs.length) {
    return (
      <EmptyState
        icon={Clock}
        title="Timesheets aren't part of your role"
        description="Ask your administrator if you need to log time."
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Time tracking"
        title="Timesheet"
        description={
          rules.timesheet.requireApproval
            ? "Clock in, time your work on assigned tasks, then submit each week for approval."
            : "Clock in, time your work on assigned tasks and submit each week."
        }
      />
      {access.mode === "local" && !member?.displayName ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Add your name in Admin &rarr; Users so tasks you own are recognised as yours.
        </div>
      ) : null}
      {tabs.length > 1 ? <Tabs label="Timesheet sections" items={tabs} value={active} onChange={(key) => setSearchParams({ tab: key }, { replace: true })} /> : null}
      {active === "mine" ? <MyTime access={access} weekStart={weekStart} setWeekStart={setWeekStart} myTasks={myTasks} /> : null}
      {active === "approvals" ? <Approvals access={access} memberName={memberName} /> : null}
      {active === "team" ? <TeamTime weekStart={weekStart} setWeekStart={setWeekStart} memberName={memberName} members={members} /> : null}
    </div>
  );
}
