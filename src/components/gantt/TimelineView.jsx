import { useEffect, useMemo, useRef, useState } from "react";
import {
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  differenceInCalendarDays,
} from "date-fns";
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
    const startOffset = differenceInCalendarDays(parseISO(task.plannedStart), range.start);
    const span =
      differenceInCalendarDays(parseISO(task.plannedEnd), parseISO(task.plannedStart)) + 1;

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
      if (task.parentTaskId) map[task.parentTaskId] = (map[task.parentTaskId] || 0) + 1;
    });
    return map;
  }, [tasks]);

  const buckets = useMemo(() => {
    if (!range) return [];
    return buildBuckets(range, zoom);
  }, [range, zoom]);

  function toggleCollapse(taskId) {
    setCollapsedParents((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  }

  function getColumnWidth() {
    if (zoom === "day") return 32;
    if (zoom === "week") return 56;
    return 78;
  }

  function startDrag(e, task, mode) {
    if (zoom !== "day") return;

    e.preventDefault();
    e.stopPropagation();

    dragRef.current = {
      task,
      mode,
      startX: e.clientX,
      deltaDays: 0,
    };

    setDragState({
      taskId: task.id,
      mode,
      deltaDays: 0,
    });
  }

  useEffect(() => {
    function handleMouseMove(e) {
      if (!dragRef.current) return;

      const columnWidth = getColumnWidth();
      const deltaX = e.clientX - dragRef.current.startX;
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
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">Timeline</h3>
          <div className="flex gap-1.5">
            <button className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs text-white">Day</button>
            <button className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700">Week</button>
            <button className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700">Month</button>
          </div>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          Add tasks with planned dates to see the timeline.
        </p>
      </div>
    );
  }

  const columnWidth = getColumnWidth();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Timeline</h3>
          <p className="text-xs text-slate-500">
            Drag bars in Day view to move or resize planned dates.
          </p>
        </div>

        <div className="flex gap-1.5">
          {["day", "week", "month"].map((level) => (
            <button
              key={level}
              onClick={() => setZoom(level)}
              className={`rounded-lg px-2.5 py-1 text-xs ${
                zoom === level
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200">
        <div
          className="grid min-w-max"
          style={{
            gridTemplateColumns: `220px repeat(${buckets.length}, ${columnWidth}px)`,
          }}
        >
          <div className="sticky left-0 z-20 border-b border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Task
          </div>

          {buckets.map((bucket) => (
            <div
              key={bucket.key}
              className="border-b border-slate-200 bg-slate-50 px-2 py-2 text-center text-[10px] font-medium text-slate-600"
            >
              {zoom === "day" ? bucket.shortLabel : bucket.label}
            </div>
          ))}

          {visibleTasks.map((task) => {
            const overdue = isTaskOverdue(task);
            const hasChildren = Boolean(childCountMap[task.id]);
            const bar = getTaskBarPosition(task, range, buckets, zoom);

            const dragDelta =
              dragState && dragState.taskId === task.id ? dragState.deltaDays : 0;

            let adjustedLeftPx = bar.left * columnWidth;
            let adjustedWidthPx = bar.span * columnWidth;

            if (zoom === "day" && dragState?.taskId === task.id) {
              if (dragState.mode === "move") {
                adjustedLeftPx = (bar.left + dragDelta) * columnWidth;
              } else if (dragState.mode === "left") {
                adjustedLeftPx = (bar.left + dragDelta) * columnWidth;
                adjustedWidthPx = Math.max(1, bar.span - dragDelta) * columnWidth;
              } else if (dragState.mode === "right") {
                adjustedWidthPx = Math.max(1, bar.span + dragDelta) * columnWidth;
              }
            }

            return (
              <div key={task.id} className="contents">
                <div className="sticky left-0 z-10 border-b border-slate-200 bg-white px-3 py-2 text-xs">
                  <div
                    className="flex items-center gap-1.5"
                    style={{ paddingLeft: `${task.depth * 14}px` }}
                  >
                    {hasChildren ? (
                      <button
                        onClick={() => toggleCollapse(task.id)}
                        className="flex h-4 w-4 items-center justify-center rounded border text-[10px] text-slate-600"
                      >
                        {collapsedParents[task.id] ? "+" : "-"}
                      </button>
                    ) : (
                      <span className="inline-block w-4 text-slate-300">
                        {task.depth > 0 ? "└" : ""}
                      </span>
                    )}

                    <span className="max-w-[120px] truncate font-medium text-slate-900">
                      {task.title}
                    </span>

                    {task.isMilestone && (
                      <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700">
                        M
                      </span>
                    )}

                    {overdue && (
                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">
                        O
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className="relative border-b border-slate-200"
                  style={{ gridColumn: `2 / span ${buckets.length}`, minHeight: "30px" }}
                >
                  <div
                    className="absolute inset-0 grid"
                    style={{
                      gridTemplateColumns: `repeat(${buckets.length}, ${columnWidth}px)`,
                    }}
                  >
                    {buckets.map((bucket) => (
                      <div key={`${task.id}-${bucket.key}`} className="border-r border-slate-100 bg-white" />
                    ))}
                  </div>

                  {bar.span > 0 && (
                    <div
                      className="absolute inset-y-1"
                      style={{
                        left: `${Math.max(0, adjustedLeftPx)}px`,
                        width: `${Math.max(columnWidth, adjustedWidthPx)}px`,
                      }}
                    >
                      <div className="relative h-full w-full">
                        <div
                          onMouseDown={(e) => startDrag(e, task, "move")}
                          className={`absolute inset-0 cursor-move rounded ${
                            overdue ? "bg-red-300" : "bg-blue-400"
                          }`}
                        />

                        <div
                          onMouseDown={(e) => startDrag(e, task, "left")}
                          className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize rounded-l bg-blue-700"
                        />

                        <div
                          onMouseDown={(e) => startDrag(e, task, "right")}
                          className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize rounded-r bg-blue-700"
                        />

                        {task.actualStart && task.actualEnd && (
                          <div className="pointer-events-none absolute inset-y-0.5 left-1 right-1 rounded bg-green-500/80" />
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
          <span className="h-2.5 w-2.5 rounded bg-blue-400"></span>
          Planned
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-green-500"></span>
          Actual
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-red-300"></span>
          Overdue
        </div>
      </div>
    </div>
  );
}