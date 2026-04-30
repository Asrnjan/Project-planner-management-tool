import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, Milestone, MoveHorizontal } from "lucide-react";
import { isTaskOverdue } from "../../utils/calculations";

function getProjectRange(tasks) {
  const starts = tasks.map((task) => task.plannedStart).filter(Boolean);
  const ends = tasks.map((task) => task.plannedEnd).filter(Boolean);

  if (!starts.length || !ends.length) return null;

  const minStart = starts.sort()[0];
  const maxEnd = ends.sort()[ends.length - 1];

  return {
    start: parseISO(minStart),
    end: parseISO(maxEnd),
  };
}

function sortTasksHierarchy(tasks) {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const childrenMap = new Map();

  tasks.forEach((task) => {
    const parentId = task.parentTaskId || "";
    if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
    childrenMap.get(parentId).push(task);
  });

  const result = [];

  function addTaskWithChildren(task, depth = 0) {
    result.push({ ...task, depth });
    const children = childrenMap.get(task.id) || [];
    children.forEach((child) => addTaskWithChildren(child, depth + 1));
  }

  const rootTasks = tasks.filter(
    (task) => !task.parentTaskId || !taskMap.has(task.parentTaskId)
  );

  rootTasks.forEach((task) => addTaskWithChildren(task, 0));

  return result;
}

function buildBuckets(range, zoom) {
  if (zoom === "day") {
    return eachDayOfInterval(range).map((day) => ({
      key: day.toISOString(),
      label: format(day, "dd MMM"),
      shortLabel: format(day, "dd"),
      start: day,
      end: day,
    }));
  }

  if (zoom === "week") {
    return eachWeekOfInterval(range, { weekStartsOn: 1 }).map((week) => ({
      key: week.toISOString(),
      label: `Wk ${format(week, "dd MMM")}`,
      shortLabel: format(week, "dd MMM"),
      start: startOfWeek(week, { weekStartsOn: 1 }),
      end: endOfWeek(week, { weekStartsOn: 1 }),
    }));
  }

  return eachMonthOfInterval(range).map((month) => ({
    key: month.toISOString(),
    label: format(month, "MMM yyyy"),
    shortLabel: format(month, "MMM"),
    start: startOfMonth(month),
    end: endOfMonth(month),
  }));
}

function getTaskBarPosition(task, range, buckets, zoom) {
  if (!task.plannedStart || !task.plannedEnd || !range) {
    return { left: 0, span: 0 };
  }

  if (zoom === "day") {
    const startOffset = differenceInCalendarDays(
      parseISO(task.plannedStart),
      range.start
    );

    const span =
      differenceInCalendarDays(
        parseISO(task.plannedEnd),
        parseISO(task.plannedStart)
      ) + 1;

    return { left: startOffset, span };
  }

  const firstMatchingIndex = buckets.findIndex((bucket) => {
    const bucketStart = format(bucket.start, "yyyy-MM-dd");
    const bucketEnd = format(bucket.end, "yyyy-MM-dd");
    return !(task.plannedEnd < bucketStart || task.plannedStart > bucketEnd);
  });

  const matchingBuckets = buckets.filter((bucket) => {
    const bucketStart = format(bucket.start, "yyyy-MM-dd");
    const bucketEnd = format(bucket.end, "yyyy-MM-dd");
    return !(task.plannedEnd < bucketStart || task.plannedStart > bucketEnd);
  }).length;

  return {
    left: Math.max(0, firstMatchingIndex),
    span: Math.max(1, matchingBuckets),
  };
}

function isTodayBucket(bucket) {
  const today = new Date();

  return isWithinInterval(today, {
    start: bucket.start,
    end: bucket.end,
  });
}

export default function TimelineView({ tasks, onUpdateTask }) {
  const [zoom, setZoom] = useState("day");
  const [collapsedParents, setCollapsedParents] = useState({});
  const [dragState, setDragState] = useState(null);
  const dragRef = useRef(null);

  const range = getProjectRange(tasks);
  const orderedTasks = useMemo(() => sortTasksHierarchy(tasks), [tasks]);

  const visibleTasks = useMemo(() => {
    return orderedTasks.filter((task) => {
      if (!task.parentTaskId) return true;

      let currentParentId = task.parentTaskId;

      while (currentParentId) {
        if (collapsedParents[currentParentId]) return false;
        const parent = orderedTasks.find((t) => t.id === currentParentId);
        currentParentId = parent?.parentTaskId || "";
      }

      return true;
    });
  }, [orderedTasks, collapsedParents]);

  const childCountMap = useMemo(() => {
    const map = {};
    tasks.forEach((task) => {
      if (task.parentTaskId) {
        map[task.parentTaskId] = (map[task.parentTaskId] || 0) + 1;
      }
    });
    return map;
  }, [tasks]);

  const buckets = useMemo(() => {
    if (!range) return [];
    return buildBuckets(range, zoom);
  }, [range, zoom]);

  const stats = useMemo(() => {
    const milestones = tasks.filter((task) => task.isMilestone).length;
    const overdue = tasks.filter((task) => isTaskOverdue(task)).length;
    const completed = tasks.filter((task) => task.status === "Done").length;

    return {
      total: tasks.length,
      milestones,
      overdue,
      completed,
    };
  }, [tasks]);

  function toggleCollapse(taskId) {
    setCollapsedParents((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  }

  function getColumnWidth() {
    if (zoom === "day") return 34;
    if (zoom === "week") return 62;
    return 88;
  }

  function startDrag(event, task, mode) {
    if (zoom !== "day") return;

    event.preventDefault();
    event.stopPropagation();

    dragRef.current = {
      task,
      mode,
      startX: event.clientX,
      deltaDays: 0,
    };

    setDragState({
      taskId: task.id,
      mode,
      deltaDays: 0,
    });
  }

  useEffect(() => {
    function handleMouseMove(event) {
      if (!dragRef.current) return;

      const columnWidth = getColumnWidth();
      const deltaX = event.clientX - dragRef.current.startX;
      const deltaDays = Math.round(deltaX / columnWidth);

      dragRef.current.deltaDays = deltaDays;

      setDragState({
        taskId: dragRef.current.task.id,
        mode: dragRef.current.mode,
        deltaDays,
      });
    }

    function handleMouseUp() {
      if (!dragRef.current) {
        setDragState(null);
        return;
      }

      const { task, mode, deltaDays } = dragRef.current;

      if (deltaDays !== 0 && task.plannedStart && task.plannedEnd) {
        const oldStart = parseISO(task.plannedStart);
        const oldEnd = parseISO(task.plannedEnd);

        if (mode === "move") {
          onUpdateTask(task.id, {
            plannedStart: format(addDays(oldStart, deltaDays), "yyyy-MM-dd"),
            plannedEnd: format(addDays(oldEnd, deltaDays), "yyyy-MM-dd"),
          });
        } else if (mode === "left") {
          const newStart = addDays(oldStart, deltaDays);

          if (newStart <= oldEnd) {
            onUpdateTask(task.id, {
              plannedStart: format(newStart, "yyyy-MM-dd"),
            });
          }
        } else if (mode === "right") {
          const newEnd = addDays(oldEnd, deltaDays);

          if (newEnd >= oldStart) {
            onUpdateTask(task.id, {
              plannedEnd: format(newEnd, "yyyy-MM-dd"),
            });
          }
        }
      }

      dragRef.current = null;
      setDragState(null);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onUpdateTask, zoom]);

  if (!range) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Timeline
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Add tasks with planned dates to see the Gantt timeline.
            </p>
          </div>

          <div className="flex gap-1.5">
            <button className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs text-white">
              Day
            </button>
            <button className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
              Week
            </button>
            <button className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
              Month
            </button>
          </div>
        </div>
      </div>
    );
  }

  const columnWidth = getColumnWidth();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            <CalendarDays className="h-3.5 w-3.5" />
            Gantt Timeline
          </div>

          <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
            Timeline View
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Drag bars in Day view to move or resize planned dates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-600 md:block">
            {stats.total} tasks · {stats.completed} done · {stats.milestones}{" "}
            milestones · {stats.overdue} overdue
          </div>

          <div className="flex gap-1.5 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            {["day", "week", "month"].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setZoom(level)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  zoom === level
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-auto rounded-2xl border border-slate-200">
        <div
          className="grid min-w-max"
          style={{
            gridTemplateColumns: `260px repeat(${buckets.length}, ${columnWidth}px)`,
          }}
        >
          <div className="sticky left-0 z-30 border-b border-slate-200 bg-white px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Task
          </div>

          {buckets.map((bucket) => {
            const today = isTodayBucket(bucket);

            return (
              <div
                key={bucket.key}
                className={`border-b border-slate-200 px-2 py-3 text-center text-[10px] font-semibold ${
                  today
                    ? "bg-blue-50 text-blue-700"
                    : "bg-slate-50 text-slate-600"
                }`}
              >
                {zoom === "day" ? bucket.shortLabel : bucket.label}
              </div>
            );
          })}

          {visibleTasks.map((task) => {
            const overdue = isTaskOverdue(task);
            const hasChildren = Boolean(childCountMap[task.id]);
            const bar = getTaskBarPosition(task, range, buckets, zoom);

            const dragDelta =
              dragState && dragState.taskId === task.id
                ? dragState.deltaDays
                : 0;

            let adjustedLeftPx = bar.left * columnWidth;
            let adjustedWidthPx = bar.span * columnWidth;

            if (zoom === "day" && dragState?.taskId === task.id) {
              if (dragState.mode === "move") {
                adjustedLeftPx = (bar.left + dragDelta) * columnWidth;
              } else if (dragState.mode === "left") {
                adjustedLeftPx = (bar.left + dragDelta) * columnWidth;
                adjustedWidthPx =
                  Math.max(1, bar.span - dragDelta) * columnWidth;
              } else if (dragState.mode === "right") {
                adjustedWidthPx =
                  Math.max(1, bar.span + dragDelta) * columnWidth;
              }
            }

            const plannedPercent = Math.min(
              100,
              Math.max(0, Number(task.plannedProgress || 0))
            );

            return (
              <div key={task.id} className="contents">
                <div className="sticky left-0 z-20 border-b border-slate-200 bg-white px-3 py-2 text-xs">
                  <div
                    className="flex items-center gap-1.5"
                    style={{ paddingLeft: `${task.depth * 14}px` }}
                  >
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => toggleCollapse(task.id)}
                        className="flex h-5 w-5 items-center justify-center rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        {collapsedParents[task.id] ? "+" : "-"}
                      </button>
                    ) : (
                      <span className="inline-block w-5 text-slate-300">
                        {task.depth > 0 ? "└" : ""}
                      </span>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="max-w-[140px] truncate font-semibold text-slate-900">
                          {task.title}
                        </span>

                        {task.isMilestone && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
                            <Milestone className="h-3 w-3" />
                            M
                          </span>
                        )}

                        {overdue && (
                          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                            Overdue
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 text-[10px] text-slate-400">
                        {task.owner || "No owner"} · {task.status || "No status"}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="relative border-b border-slate-200"
                  style={{
                    gridColumn: `2 / span ${buckets.length}`,
                    minHeight: "42px",
                  }}
                >
                  <div
                    className="absolute inset-0 grid"
                    style={{
                      gridTemplateColumns: `repeat(${buckets.length}, ${columnWidth}px)`,
                    }}
                  >
                    {buckets.map((bucket) => (
                      <div
                        key={`${task.id}-${bucket.key}`}
                        className={`border-r border-slate-100 ${
                          isTodayBucket(bucket) ? "bg-blue-50/50" : "bg-white"
                        }`}
                      />
                    ))}
                  </div>

                  {bar.span > 0 && (
                    <div
                      className="absolute inset-y-2"
                      style={{
                        left: `${Math.max(0, adjustedLeftPx)}px`,
                        width: `${Math.max(columnWidth, adjustedWidthPx)}px`,
                      }}
                    >
                      <div className="relative h-full w-full">
                        {task.isMilestone ? (
                          <div
                            onMouseDown={(event) =>
                              startDrag(event, task, "move")
                            }
                            className="absolute left-1 top-1/2 h-5 w-5 -translate-y-1/2 rotate-45 cursor-move rounded bg-purple-500 shadow-sm ring-2 ring-purple-200"
                            title={task.title}
                          />
                        ) : (
                          <>
                            <div
                              onMouseDown={(event) =>
                                startDrag(event, task, "move")
                              }
                              className={`absolute inset-0 cursor-move overflow-hidden rounded-xl shadow-sm ${
                                overdue ? "bg-red-300" : "bg-blue-400"
                              }`}
                            >
                              <div
                                className={`h-full ${
                                  overdue ? "bg-red-500" : "bg-blue-700"
                                }`}
                                style={{ width: `${plannedPercent}%` }}
                              />
                            </div>

                            <div
                              onMouseDown={(event) =>
                                startDrag(event, task, "left")
                              }
                              className="absolute inset-y-0 left-0 flex w-2 cursor-ew-resize items-center justify-center rounded-l-xl bg-slate-900/60"
                            />

                            <div
                              onMouseDown={(event) =>
                                startDrag(event, task, "right")
                              }
                              className="absolute inset-y-0 right-0 flex w-2 cursor-ew-resize items-center justify-center rounded-r-xl bg-slate-900/60"
                            />

                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white">
                              <MoveHorizontal className="mr-1 h-3 w-3" />
                              {plannedPercent}%
                            </div>
                          </>
                        )}

                        {task.actualStart && task.actualEnd && !task.isMilestone && (
                          <div className="pointer-events-none absolute inset-y-1 left-2 right-2 rounded-lg bg-green-500/70" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-600">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-blue-400" />
          Planned
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-slate-900" />
          Planned progress
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rotate-45 rounded bg-purple-500" />
          Milestone
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-green-500" />
          Actual
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-red-300" />
          Overdue
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-blue-50 ring-1 ring-blue-200" />
          Today
        </div>
      </div>
    </div>
  );
}