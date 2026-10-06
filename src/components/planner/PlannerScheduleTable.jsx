import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  buildTaskIndexMaps,
  calculateEndDateFromDuration,
  getTaskDuration,
  applySingleGridDraftToTask,
} from "../../utils/planner";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
  Milestone,
  Rows3,
  RotateCcw,
} from "lucide-react";
import { confirmAction, notify } from "../../ui/feedback";

function HeaderCell({ children, className = "", title }) {
  return (
    <th
      scope="col"
      title={title}
      className={`px-1.5 py-2 text-left text-xs font-semibold text-slate-500 ${className}`}
    >
      {children}
    </th>
  );
}

function GridInput({ readOnly = false, className = "", ...props }) {
  return (
    <input
      {...props}
      readOnly={readOnly}
      className={`w-full rounded-md border px-1.5 py-1 text-[13px] leading-5 transition ${
        readOnly
          ? "border-transparent bg-transparent text-slate-500"
          : "border-transparent bg-transparent text-slate-900 hover:border-slate-200 focus:border-indigo-400 focus:bg-white focus:outline-none"
      } ${className}`}
    />
  );
}

function GridSelect({ disabled = false, className = "", children, ...props }) {
  return (
    <div className="relative">
      <select
        {...props}
        disabled={disabled}
        className={`w-full appearance-none rounded-md border px-1.5 py-1 pr-6 text-[13px] leading-5 transition ${
          disabled
            ? "border-transparent bg-transparent text-slate-500"
            : "border-transparent bg-transparent text-slate-900 hover:border-slate-200 focus:border-indigo-400 focus:bg-white focus:outline-none"
        } ${className}`}
      >
        {children}
      </select>

      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-300" />
    </div>
  );
}

function statusSelectClass(status) {
  switch (status) {
    case "Done":
      return "!bg-emerald-50 !text-emerald-700 font-medium";
    case "In Progress":
      return "!bg-blue-50 !text-blue-700 font-medium";
    case "Blocked":
      return "!bg-red-50 !text-red-700 font-medium";
    default:
      return "text-slate-600";
  }
}

function progressColor(status) {
  if (status === "Done") return "bg-emerald-500";
  if (status === "Blocked") return "bg-red-500";
  if (status === "In Progress") return "bg-blue-500";
  return "bg-slate-400";
}

function IconActionButton({ title, className = "", children, ...props }) {
  return (
    <button
      {...props}
      title={title}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition ${className}`}
    >
      {children}
    </button>
  );
}

function ToolbarButton({ children, variant = "secondary", ...props }) {
  const variantClass =
    variant === "primary"
      ? "bg-indigo-600 text-white hover:bg-indigo-700"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900";

  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition ${variantClass}`}
    >
      {children}
    </button>
  );
}

function getTaskDepth(task, taskById) {
  let depth = 0;
  let currentParentId = task.parentTaskId;

  while (currentParentId && taskById[currentParentId]) {
    depth += 1;
    currentParentId = taskById[currentParentId].parentTaskId;
  }

  return depth;
}

function getTaskWbs(task, fallbackIndex) {
  return (
    task.wbs ||
    task.outlineNumber ||
    task.externalId ||
    task.externalUid ||
    String(fallbackIndex + 1)
  );
}

function getDependencyText(task, taskById) {
  const dependencies = Array.isArray(task.dependencyIds)
    ? task.dependencyIds
    : [];

  if (!dependencies.length) return "";

  return dependencies
    .map((dependencyId) => {
      const dependency = taskById[dependencyId];

      return (
        dependency?.wbs ||
        dependency?.outlineNumber ||
        dependency?.title ||
        dependencyId
      );
    })
    .join(", ");
}

function makeDraftFromTask(task) {
  return {
    title: task.title || "",
    owner: task.owner || "",
    sprintId: task.sprintId || "",
    status: task.status || "Not Started",
    durationDays: getTaskDuration(task),
    plannedStart: task.plannedStart || "",
    plannedEnd: task.plannedEnd || "",
    predecessorInput: "",
    plannedProgress: Number(task.plannedProgress || 0),
    actualProgress: Number(task.actualProgress || 0),
    isMilestone: Boolean(task.isMilestone),
    isManualLocked: Boolean(task.isManualLocked),
  };
}

const ScheduleRow = memo(function ScheduleRow({
  task,
  index,
  taskById,
  sprints,
  selectedProjectId,
  selectedRowId,
  flashTaskId,
  collapsedParents,
  childCountMap,
  onSelectRow,
  onToggleCollapse,
  onCommitRow,
  onInsertBelow,
  onAddSubtask,
  onDeleteRow,
  rowRef,
}) {
  const hasChildren = Boolean(childCountMap[task.id]);
  const isSummaryTask = Boolean(task.isSummaryTask || hasChildren);
  const depth = getTaskDepth(task, taskById);
  const wbs = getTaskWbs(task, index);
  const dependencyText = getDependencyText(task, taskById);
  const isSelected = selectedRowId === task.id;
  const isFlashing = flashTaskId === task.id;

  const [draft, setDraft] = useState(() => makeDraftFromTask(task));
  const latestDraftRef = useRef(draft);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    const nextDraft = makeDraftFromTask(task);
    setDraft(nextDraft);
    latestDraftRef.current = nextDraft;
    isDirtyRef.current = false;
  }, [task.id, task.updatedAt]);

  function updateDraft(field, value) {
    setDraft((prev) => {
      const next = {
        ...prev,
        [field]: value,
      };

      if (field === "durationDays" && prev.plannedStart) {
        next.plannedEnd = calculateEndDateFromDuration(
          prev.plannedStart,
          value
        );
      }

      if (field === "plannedStart") {
        next.plannedEnd = calculateEndDateFromDuration(
          value,
          prev.durationDays || 1
        );
      }

      latestDraftRef.current = next;
      isDirtyRef.current = true;

      return next;
    });
  }

  function commitDraft() {
    if (!isDirtyRef.current) return;

    onCommitRow(task.id, latestDraftRef.current);
    isDirtyRef.current = false;
  }

  function commitDraftImmediately(nextDraft) {
    latestDraftRef.current = nextDraft;
    isDirtyRef.current = false;
    setDraft(nextDraft);
    onCommitRow(task.id, nextDraft);
  }

  function inputHandlers(field) {
    return {
      onChange: (event) => updateDraft(field, event.target.value),
      onBlur: commitDraft,
      onKeyDown: (event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      },
    };
  }

  function toggleMilestone(checked) {
    const nextDraft = {
      ...latestDraftRef.current,
      isMilestone: checked,
    };

    commitDraftImmediately(nextDraft);
  }

  function toggleManualLock() {
    const nextDraft = {
      ...latestDraftRef.current,
      isManualLocked: !latestDraftRef.current.isManualLocked,
    };

    commitDraftImmediately(nextDraft);
  }

  function changeSelect(field, value) {
    const nextDraft = {
      ...latestDraftRef.current,
      [field]: value,
    };

    if (field === "status" && value === "Done") {
      nextDraft.actualProgress = 100;
    }

    commitDraftImmediately(nextDraft);
  }

  const plannedProgress = Math.min(
    100,
    Math.max(0, Number(draft.plannedProgress || 0))
  );

  return (
    <tr
      ref={rowRef}
      onClick={() => onSelectRow(task.id)}
      className={`border-b border-slate-100 transition ${
        isFlashing
          ? "bg-yellow-100"
          : isSelected
          ? "bg-blue-50/60"
          : isSummaryTask
          ? "bg-slate-50"
          : "bg-white hover:bg-slate-50/60"
      }`}
    >
      <td className="px-1 py-1 align-middle text-[11px] text-slate-500">
        {index + 1}
      </td>

      <td className="px-1 py-1 align-middle">
        <span
          className={`inline-flex rounded-md px-1.5 py-1 text-[10px] font-semibold ${
            isSummaryTask
              ? "bg-slate-200 text-slate-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {wbs}
        </span>
      </td>

      <td className="px-1 py-1 align-middle">
        <div
          className="flex items-center gap-1"
          style={{ paddingLeft: `${depth * 10}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleCollapse(task.id);
              }}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
            >
              {collapsedParents[task.id] ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          ) : (
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-slate-300">
              {task.parentTaskId ? "└" : ""}
            </span>
          )}

          {draft.isMilestone ? (
            <Milestone className="h-3.5 w-3.5 shrink-0 text-purple-600" />
          ) : hasChildren ? (
            <Rows3 className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          ) : null}

          <GridInput
            value={draft.title}
            aria-label="Task name"
            readOnly={false}
            {...inputHandlers("title")}
            className={
              isSummaryTask
                ? "font-semibold text-slate-900"
                : "text-slate-800"
            }
          />
        </div>
      </td>

      <td className="px-1 py-1 align-middle">
        <GridSelect
          value={draft.sprintId}
          disabled={isSummaryTask || !selectedProjectId}
          onChange={(event) => changeSelect("sprintId", event.target.value)}
        >
          <option value="">No Sprint</option>
          {sprints.map((sprint) => (
            <option key={sprint.id} value={sprint.id}>
              {sprint.name}
            </option>
          ))}
        </GridSelect>
      </td>

      <td className="px-1 py-1 align-middle">
        <label
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 ${
            draft.isMilestone
              ? "bg-purple-100 text-purple-700"
              : isSummaryTask
              ? "bg-slate-100 text-slate-500"
              : "bg-slate-50 text-slate-700"
          }`}
        >
          <input
            type="checkbox"
            checked={Boolean(draft.isMilestone)}
            disabled={isSummaryTask}
            onChange={(event) => toggleMilestone(event.target.checked)}
            className="h-3 w-3"
          />
          <span className="text-[9px] font-medium">MS</span>
        </label>
      </td>

      <td className="px-1 py-1 align-middle">
        <GridInput
          type="number"
          min="1"
          readOnly={isSummaryTask}
          value={draft.durationDays}
          {...inputHandlers("durationDays")}
        />
      </td>

      <td className="px-1 py-1 align-middle">
        <GridInput
          type="date"
          readOnly={isSummaryTask}
          value={draft.plannedStart}
          {...inputHandlers("plannedStart")}
        />
      </td>

      <td className="px-1 py-1 align-middle">
        <GridInput
          type="date"
          readOnly={isSummaryTask}
          value={draft.plannedEnd}
          {...inputHandlers("plannedEnd")}
        />
      </td>

      <td className="px-1 py-1 align-middle">
        <GridInput
          value={draft.predecessorInput}
          readOnly={isSummaryTask}
          {...inputHandlers("predecessorInput")}
          placeholder={dependencyText || "e.g. 1,3"}
          aria-label={`Depends on, for ${draft.title}`}
          title={
            dependencyText
              ? `Depends on: ${dependencyText}. Type new row/WBS numbers to change, or "none" to clear.`
              : "Type the row or WBS numbers of tasks that must finish first, e.g. 1,3"
          }
        />
      </td>

      <td className="px-1 py-1 align-middle">
        <GridInput
          value={draft.owner}
          readOnly={false}
          {...inputHandlers("owner")}
        />
      </td>

      <td className="px-1 py-1 align-middle">
        <GridInput
          type="number"
          min="0"
          max="100"
          readOnly={isSummaryTask}
          value={draft.plannedProgress}
          {...inputHandlers("plannedProgress")}
        />

        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${progressColor(draft.status)}`}
            style={{ width: `${plannedProgress}%` }}
          />
        </div>
      </td>

      <td className="px-1 py-1 align-middle">
        <GridSelect
          value={draft.status}
          disabled={isSummaryTask}
          className={statusSelectClass(draft.status)}
          onChange={(event) => changeSelect("status", event.target.value)}
        >
          <option>Not Started</option>
          <option>In Progress</option>
          <option>Done</option>
          <option>Blocked</option>
        </GridSelect>
      </td>

      <td className="px-1 py-1 align-middle">
        <GridInput
          type="number"
          min="0"
          max="100"
          readOnly={isSummaryTask}
          value={draft.actualProgress}
          aria-label={`Percent done, for ${draft.title}`}
          title="How much of this task is actually done (0-100)"
          {...inputHandlers("actualProgress")}
        />
      </td>

      <td className="px-1 py-1 align-middle">
        <div className="flex items-center justify-end gap-1">
          {!isSummaryTask ? (
            <IconActionButton
              type="button"
              title={
              draft.isManualLocked
                ? "Dates locked: Recalculate will not move this task. Click to unlock."
                : "Dates follow dependencies when you Recalculate. Click to lock."
            }
              onClick={(event) => {
                event.stopPropagation();
                toggleManualLock();
              }}
              className={
                draft.isManualLocked
                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }
            >
              {draft.isManualLocked ? (
                <Lock className="h-3.5 w-3.5" />
              ) : (
                <Unlock className="h-3.5 w-3.5" />
              )}
            </IconActionButton>
          ) : (
            <span className="inline-flex h-6 items-center rounded-md bg-slate-100 px-1.5 text-[9px] font-medium text-slate-600">
              Roll
            </span>
          )}

          <IconActionButton
            type="button"
            title={isSummaryTask ? "Add a subtask" : "Insert a task below"}
            onClick={(event) => {
              event.stopPropagation();

              if (isSummaryTask) {
                onAddSubtask(task.id);
              } else {
                onSelectRow(task.id);
                onInsertBelow(task.id);
              }
            }}
            className="bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            <Plus className="h-3.5 w-3.5" />
          </IconActionButton>

          <IconActionButton
            type="button"
            title="Delete task"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteRow(task.id);
            }}
            className="bg-red-50 text-red-700 hover:bg-red-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </IconActionButton>
        </div>
      </td>
    </tr>
  );
});

export default function PlannerScheduleTable({
  tasks,
  sprints,
  onAddTask,
  onUpdateTask,
  onBulkUpdate,
  onDeleteTask,
  selectedProjectId,
  focusedTaskId,
}) {
  const { ordered } = useMemo(() => buildTaskIndexMaps(tasks), [tasks]);

  const [collapsedParents, setCollapsedParents] = useState({});
  const [selectedRowId, setSelectedRowId] = useState("");
  const [flashTaskId, setFlashTaskId] = useState("");
  const [lastActionText, setLastActionText] = useState("Ready");

  const rowRefs = useRef({});
  const undoStackRef = useRef([]);

  const taskById = useMemo(() => {
    return Object.fromEntries(tasks.map((task) => [task.id, task]));
  }, [tasks]);

  const childCountMap = useMemo(() => {
    const map = {};

    tasks.forEach((task) => {
      if (task.parentTaskId) {
        map[task.parentTaskId] = (map[task.parentTaskId] || 0) + 1;
      }
    });

    return map;
  }, [tasks]);

  const hierarchyStats = useMemo(() => {
    const summaryRows = tasks.filter((task) => childCountMap[task.id]).length;
    const leafRows = tasks.length - summaryRows;
    const milestones = tasks.filter((task) => task.isMilestone).length;

    return {
      summaryRows,
      leafRows,
      milestones,
      total: tasks.length,
    };
  }, [tasks, childCountMap]);

  useEffect(() => {
    if (!focusedTaskId) return;

    const nextCollapsed = {};

    function openParentChain(taskId) {
      let current = taskById[taskId];

      while (current?.parentTaskId) {
        nextCollapsed[current.parentTaskId] = false;
        current = taskById[current.parentTaskId];
      }
    }

    openParentChain(focusedTaskId);

    setCollapsedParents((prev) => ({
      ...prev,
      ...nextCollapsed,
    }));

    const timeout = setTimeout(() => {
      const rowEl = rowRefs.current[focusedTaskId];

      if (rowEl) {
        rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
        setSelectedRowId(focusedTaskId);
        setFlashTaskId(focusedTaskId);

        setTimeout(() => {
          setFlashTaskId("");
        }, 2200);
      }
    }, 120);

    return () => clearTimeout(timeout);
  }, [focusedTaskId, taskById]);

  const visibleTasks = useMemo(() => {
    return ordered.filter((task) => {
      if (!task.parentTaskId) return true;

      let currentParentId = task.parentTaskId;

      while (currentParentId) {
        if (collapsedParents[currentParentId]) return false;

        const parent = taskById[currentParentId];
        currentParentId = parent?.parentTaskId || "";
      }

      return true;
    });
  }, [ordered, collapsedParents, taskById]);

  function pushUndoSnapshot() {
    undoStackRef.current = [...undoStackRef.current, tasks].slice(-30);
  }

  function handleUndo() {
    const previous = undoStackRef.current.pop();

    if (!previous) {
      setLastActionText("Nothing to undo");
      return;
    }

    onBulkUpdate(previous);
    setLastActionText("Rolled back");
  }

  function handleGridKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      handleUndo();
    }
  }

  function toggleCollapse(taskId) {
    setCollapsedParents((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  }

  function expandAll() {
    setCollapsedParents({});
  }

  function collapseAll() {
    const next = {};

    tasks.forEach((task) => {
      if (childCountMap[task.id]) {
        next[task.id] = true;
      }
    });

    setCollapsedParents(next);
  }

  function handleCommitRow(taskId, nextDraft) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;

    const hasChildren = Boolean(childCountMap[taskId]);

    pushUndoSnapshot();

    if (hasChildren) {
      const updates = {
        title: nextDraft.title,
        owner: nextDraft.owner,
        updatedAt: new Date().toISOString(),
      };

      if (onUpdateTask) {
        onUpdateTask(taskId, updates);
      } else {
        const nextTasks = tasks.map((item) =>
          item.id === taskId ? { ...item, ...updates } : item
        );
        onBulkUpdate(nextTasks);
      }

      setLastActionText("Saved");
      return;
    }

    const updatedRow = applySingleGridDraftToTask(
      task,
      { ...nextDraft, isManualLocked: true },
      tasks
    );

    const updates = {
      ...updatedRow,
      updatedAt: new Date().toISOString(),
    };

    if (onUpdateTask) {
      onUpdateTask(taskId, updates);
    } else {
      const nextTasks = tasks.map((item) =>
        item.id === taskId ? updates : item
      );
      onBulkUpdate(nextTasks);
    }

    setLastActionText("Saved");
  }

  function handleAddRow() {
    if (!selectedProjectId) {
      notify.info("Pick a project at the top of the page first, then add tasks to it.");
      return;
    }

    pushUndoSnapshot();

    onAddTask({
      projectId: selectedProjectId,
      title: "New Task",
      owner: "",
      sprintId: "",
      priority: "Medium",
      status: "Not Started",
      plannedStart: "",
      plannedEnd: "",
      actualStart: "",
      actualEnd: "",
      plannedProgress: 0,
      actualProgress: 0,
      durationDays: 1,
      isMilestone: false,
      isManualLocked: false,
      dependencyIds: [],
      dependencyRules: [],
    });

    setLastActionText("Added task");
  }

  function handleInsertBelow(baseTaskId = selectedRowId) {
    const selected = tasks.find((task) => task.id === baseTaskId);

    if (!selected) {
      notify.info("Click a row first, then use Insert to add a task below it.");
      return;
    }

    pushUndoSnapshot();

    onAddTask({
      projectId: selected.projectId,
      sprintId: selected.sprintId || "",
      parentTaskId: selected.parentTaskId || "",
      title: "Inserted Task",
      owner: "",
      priority: "Medium",
      status: "Not Started",
      plannedStart: "",
      plannedEnd: "",
      actualStart: "",
      actualEnd: "",
      plannedProgress: 0,
      actualProgress: 0,
      durationDays: 1,
      isMilestone: false,
      isManualLocked: false,
      dependencyIds: [],
      dependencyRules: [],
    });

    setLastActionText("Inserted task");
  }

  function handleAddSubtask(targetTaskId) {
    const parentTask = tasks.find((task) => task.id === targetTaskId);

    if (!parentTask) {
      notify.info("Click the row that should become the parent, then add a subtask.");
      return;
    }

    pushUndoSnapshot();

    onAddTask({
      projectId: parentTask.projectId,
      parentTaskId: parentTask.id,
      sprintId: parentTask.sprintId || "",
      title: "New Subtask",
      owner: "",
      priority: "Medium",
      status: "Not Started",
      plannedStart: "",
      plannedEnd: "",
      actualStart: "",
      actualEnd: "",
      plannedProgress: 0,
      actualProgress: 0,
      durationDays: 1,
      isMilestone: false,
      isManualLocked: false,
      dependencyIds: [],
      dependencyRules: [],
    });

    setCollapsedParents((prev) => ({
      ...prev,
      [targetTaskId]: false,
    }));

    setLastActionText("Added subtask");
  }

  async function handleDeleteRow(taskId) {
    const hasChildren = Boolean(childCountMap[taskId]);

    const confirmed = await confirmAction({
      title: "Delete this task?",
      message: hasChildren
        ? "It has subtasks. They will be kept and moved up one level."
        : "You can undo this with Ctrl + Z while this page is open.",
      confirmLabel: "Delete task",
    });

    if (!confirmed) return;

    pushUndoSnapshot();

    onDeleteTask(taskId);

    if (selectedRowId === taskId) {
      setSelectedRowId("");
    }

    setLastActionText("Deleted row");
  }

  return (
    <div
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      onKeyDown={handleGridKeyDown}
      tabIndex={0}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <ToolbarButton variant="primary" onClick={handleAddRow} title="Add a task at the end">
            <Plus className="h-3.5 w-3.5" /> Add row
          </ToolbarButton>
          <ToolbarButton onClick={() => handleInsertBelow()} title="Insert a task below the selected row">
            Insert
          </ToolbarButton>
          <ToolbarButton onClick={() => handleAddSubtask(selectedRowId)} title="Add a subtask under the selected row">
            Subtask
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
          <ToolbarButton onClick={expandAll}>Expand all</ToolbarButton>
          <ToolbarButton onClick={collapseAll}>Collapse all</ToolbarButton>
          <ToolbarButton onClick={handleUndo} title="Undo the last change (Ctrl + Z)">
            <RotateCcw className="h-3.5 w-3.5" /> Undo
          </ToolbarButton>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>
            {hierarchyStats.total} rows · {hierarchyStats.milestones} milestones
          </span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600" aria-live="polite">
            {lastActionText}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1350px] table-fixed border-collapse text-xs">
          <colgroup>
            <col style={{ width: "34px" }} />
            <col style={{ width: "70px" }} />
            <col style={{ width: "330px" }} />
            <col style={{ width: "130px" }} />
            <col style={{ width: "62px" }} />
            <col style={{ width: "70px" }} />
            <col style={{ width: "115px" }} />
            <col style={{ width: "115px" }} />
            <col style={{ width: "110px" }} />
            <col style={{ width: "115px" }} />
            <col style={{ width: "90px" }} />
            <col style={{ width: "130px" }} />
            <col style={{ width: "72px" }} />
            <col style={{ width: "80px" }} />
          </colgroup>

          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              <HeaderCell title="Row number. Use it in Depends on.">#</HeaderCell>
              <HeaderCell title="Work breakdown number, e.g. 2.1 is the first subtask of task 2">WBS</HeaderCell>
              <HeaderCell>Task</HeaderCell>
              <HeaderCell>Sprint</HeaderCell>
              <HeaderCell title="Milestone: a key date with no duration">Milest.</HeaderCell>
              <HeaderCell title="Duration in days">Days</HeaderCell>
              <HeaderCell>Start</HeaderCell>
              <HeaderCell>Finish</HeaderCell>
              <HeaderCell title="Rows that must finish before this one starts">Depends on</HeaderCell>
              <HeaderCell>Owner</HeaderCell>
              <HeaderCell title="How much should be done by now (plan)">Plan %</HeaderCell>
              <HeaderCell>Status</HeaderCell>
              <HeaderCell title="How much is actually done">Done %</HeaderCell>
              <HeaderCell title="Lock dates, insert below, delete">Actions</HeaderCell>
            </tr>
          </thead>

          <tbody>
            {visibleTasks.map((task, index) => (
              <ScheduleRow
                key={task.id}
                task={task}
                index={index}
                taskById={taskById}
                sprints={sprints}
                selectedProjectId={selectedProjectId}
                selectedRowId={selectedRowId}
                flashTaskId={flashTaskId}
                collapsedParents={collapsedParents}
                childCountMap={childCountMap}
                onSelectRow={setSelectedRowId}
                onToggleCollapse={toggleCollapse}
                onCommitRow={handleCommitRow}
                onInsertBelow={handleInsertBelow}
                onAddSubtask={handleAddSubtask}
                onDeleteRow={handleDeleteRow}
                rowRef={(element) => {
                  rowRefs.current[task.id] = element;
                }}
              />
            ))}

            {visibleTasks.length === 0 && (
              <tr>
                <td
                  colSpan="14"
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  No plan rows found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
        Click a cell to edit; changes save when you leave it. Ctrl + Z undoes the last change. Depends on: type row or WBS numbers, e.g. "1, 3".
      </div>
    </div>
  );
}