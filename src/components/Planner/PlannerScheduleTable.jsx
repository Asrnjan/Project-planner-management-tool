import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildTaskIndexMaps,
  calculateEndDateFromDuration,
  createGridDraftMap,
  getTaskDuration,
  applySingleGridDraftToTask,
  getTaskQuickFixes,
} from "../../utils/planner";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
  Milestone,
  GitBranch,
  Rows3,
  RotateCcw,
} from "lucide-react";

function HeaderCell({ children, className = "" }) {
  return (
    <th
      className={`px-1.5 py-2 text-left text-[9px] font-semibold uppercase tracking-wide text-slate-500 ${className}`}
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
      className={`w-full rounded-md border px-1.5 py-1.5 text-[11px] leading-4 transition ${
        readOnly
          ? "border-slate-200 bg-slate-100 text-slate-600"
          : "border-slate-200 bg-white text-slate-900 focus:border-slate-400 focus:outline-none"
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
        className={`w-full appearance-none rounded-md border px-1.5 py-1.5 pr-6 text-[11px] leading-4 transition ${
          disabled
            ? "border-slate-200 bg-slate-100 text-slate-600"
            : "border-slate-200 bg-white text-slate-900 focus:border-slate-400 focus:outline-none"
        } ${className}`}
      >
        {children}
      </select>

      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

function issueBadgeClass(severity) {
  switch (severity) {
    case "high":
      return "bg-red-100 text-red-700";
    case "medium":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function statusSelectClass(status) {
  switch (status) {
    case "Done":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold";
    case "In Progress":
      return "border-blue-200 bg-blue-50 text-blue-700 font-semibold";
    case "Blocked":
      return "border-red-200 bg-red-50 text-red-700 font-semibold";
    default:
      return "border-slate-200 bg-white text-slate-700";
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
      ? "bg-slate-900 text-white hover:bg-slate-800"
      : variant === "blue"
      ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
      : "bg-slate-100 text-slate-700 hover:bg-slate-200";

  return (
    <button
      type="button"
      {...props}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${variantClass}`}
    >
      {children}
    </button>
  );
}

function MilestoneCell({ checked, disabled, onChange }) {
  return (
    <label
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 ${
        checked
          ? "bg-purple-100 text-purple-700"
          : disabled
          ? "bg-slate-100 text-slate-500"
          : "bg-slate-50 text-slate-700"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3 w-3"
      />
      <span className="text-[9px] font-medium">MS</span>
    </label>
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

export default function PlannerScheduleTable({
  tasks,
  sprints,
  onAddTask,
  onBulkUpdate,
  onDeleteTask,
  selectedProjectId,
  focusedTaskId,
  onRecalculate,
}) {
  const { ordered } = useMemo(() => buildTaskIndexMaps(tasks), [tasks]);

  const [collapsedParents, setCollapsedParents] = useState({});
  const [selectedRowId, setSelectedRowId] = useState("");
  const [drafts, setDrafts] = useState({});
  const [flashTaskId, setFlashTaskId] = useState("");
  const [lastActionText, setLastActionText] = useState("Auto-save ready");

  const rowRefs = useRef({});
  const undoStackRef = useRef([]);

  const taskById = useMemo(() => {
    return Object.fromEntries(tasks.map((task) => [task.id, task]));
  }, [tasks]);

  useEffect(() => {
    setDrafts(createGridDraftMap(tasks));
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

        const parent = ordered.find((item) => item.id === currentParentId);
        currentParentId = parent?.parentTaskId || "";
      }

      return true;
    });
  }, [ordered, collapsedParents]);

  function pushUndoSnapshot() {
    undoStackRef.current = [...undoStackRef.current, tasks].slice(-50);
  }

  function handleUndo() {
    const previous = undoStackRef.current.pop();

    if (!previous) {
      setLastActionText("Nothing to undo");
      return;
    }

    onBulkUpdate(previous);
    setLastActionText("Rolled back last change");
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

  function commitTaskUpdate(taskId, nextDraft) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;

    const hasChildren = Boolean(childCountMap[taskId]);

    pushUndoSnapshot();

    if (hasChildren) {
      const updatedSummaryRow = {
        ...task,
        title: nextDraft.title,
        owner: nextDraft.owner,
      };

      const nextTasks = tasks.map((item) =>
        item.id === taskId ? updatedSummaryRow : item
      );

      onBulkUpdate(nextTasks);
      setLastActionText("Auto-saved summary row");
      return;
    }

    const updatedRow = applySingleGridDraftToTask(
      task,
      { ...nextDraft, isManualLocked: true },
      tasks
    );

    const nextTasks = tasks.map((item) =>
      item.id === taskId ? updatedRow : item
    );

    onBulkUpdate(nextTasks);
    setLastActionText("Auto-saved");
  }

  function updateDraft(taskId, field, value) {
    const current = drafts[taskId] || {};
    const nextDraft = {
      ...current,
      [field]: value,
    };

    if (field === "durationDays" && current.plannedStart) {
      nextDraft.plannedEnd = calculateEndDateFromDuration(
        current.plannedStart,
        value
      );
    }

    if (field === "plannedStart") {
      nextDraft.plannedEnd = calculateEndDateFromDuration(
        value,
        current.durationDays || 1
      );
    }

    setDrafts((prev) => ({
      ...prev,
      [taskId]: nextDraft,
    }));

    commitTaskUpdate(taskId, nextDraft);
  }

  function toggleManualLock(taskId) {
    const current = drafts[taskId] || {};
    const nextDraft = {
      ...current,
      isManualLocked: !current.isManualLocked,
    };

    setDrafts((prev) => ({
      ...prev,
      [taskId]: nextDraft,
    }));

    commitTaskUpdate(taskId, nextDraft);
  }

  function handleAddRow() {
    if (!selectedProjectId) {
      alert("Select a project first to add plan rows.");
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
      alert("Select a row first.");
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
      alert("Select a parent row first.");
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

  function handleDeleteRow(taskId) {
    const hasChildren = Boolean(childCountMap[taskId]);

    const confirmed = window.confirm(
      hasChildren
        ? "This task has subtasks. Deleting it may also affect hierarchy. Continue?"
        : "Delete this task row?"
    );

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
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      onKeyDown={handleGridKeyDown}
      tabIndex={0}
    >
      <div className="border-b border-slate-200 px-3 py-3">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              <GitBranch className="h-3.5 w-3.5" />
              Planning Grid
            </div>

            <h3 className="mt-2 text-sm font-semibold tracking-tight text-slate-900">
              Schedule, subtasks, milestones, and dependencies
            </h3>

            <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
              Changes are auto-saved locally. Use Ctrl + Z inside the grid to
              rollback the last change.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <ToolbarButton variant="primary" onClick={handleAddRow}>
              Add
            </ToolbarButton>

            <ToolbarButton onClick={() => handleInsertBelow()}>
              Insert
            </ToolbarButton>

            <ToolbarButton onClick={() => handleAddSubtask(selectedRowId)}>
              Subtask
            </ToolbarButton>

            <ToolbarButton onClick={expandAll}>Expand</ToolbarButton>

            <ToolbarButton onClick={collapseAll}>Collapse</ToolbarButton>

            <ToolbarButton onClick={handleUndo}>
              <span className="inline-flex items-center gap-1">
                <RotateCcw className="h-3.5 w-3.5" />
                Undo
              </span>
            </ToolbarButton>

            <ToolbarButton variant="blue" onClick={onRecalculate}>
              Recalc
            </ToolbarButton>
          </div>
        </div>

        <div className="mt-3 grid gap-2 text-[10px] md:grid-cols-5">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <span className="font-semibold text-slate-900">
              {hierarchyStats.total}
            </span>{" "}
            <span className="text-slate-500">total rows</span>
          </div>

          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <span className="font-semibold text-slate-900">
              {hierarchyStats.summaryRows}
            </span>{" "}
            <span className="text-slate-500">summary rows</span>
          </div>

          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <span className="font-semibold text-slate-900">
              {hierarchyStats.leafRows}
            </span>{" "}
            <span className="text-slate-500">leaf tasks</span>
          </div>

          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <span className="font-semibold text-slate-900">
              {hierarchyStats.milestones}
            </span>{" "}
            <span className="text-slate-500">milestones</span>
          </div>

          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <span className="font-semibold text-slate-900">
              {lastActionText}
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden">
        <table className="w-full table-fixed border-collapse text-xs">
          <colgroup>
            <col style={{ width: "2%" }} />
            <col style={{ width: "4.5%" }} />
            <col style={{ width: "25%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "4%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "7.5%" }} />
            <col style={{ width: "7.5%" }} />
            <col style={{ width: "6.5%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "4.5%" }} />
            <col style={{ width: "4.5%" }} />
          </colgroup>

          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              <HeaderCell>#</HeaderCell>
              <HeaderCell>WBS</HeaderCell>
              <HeaderCell>Task</HeaderCell>
              <HeaderCell>Sprint</HeaderCell>
              <HeaderCell>MS</HeaderCell>
              <HeaderCell>Dur</HeaderCell>
              <HeaderCell>Start</HeaderCell>
              <HeaderCell>Finish</HeaderCell>
              <HeaderCell>Pred</HeaderCell>
              <HeaderCell>Owner</HeaderCell>
              <HeaderCell>%</HeaderCell>
              <HeaderCell>Status</HeaderCell>
              <HeaderCell>!</HeaderCell>
              <HeaderCell>Act</HeaderCell>
            </tr>
          </thead>

          <tbody>
            {visibleTasks.map((task, index) => {
              const hasChildren = Boolean(childCountMap[task.id]);
              const depth = getTaskDepth(task, taskById);
              const wbs = getTaskWbs(task, index);
              const dependencyText = getDependencyText(task, taskById);

              const draft = drafts[task.id] || {
                title: task.title || "",
                owner: task.owner || "",
                sprintId: task.sprintId || "",
                status: task.status || "Not Started",
                durationDays: getTaskDuration(task),
                plannedStart: task.plannedStart || "",
                plannedEnd: task.plannedEnd || "",
                predecessorInput: "",
                plannedProgress: Number(task.plannedProgress || 0),
                isMilestone: Boolean(task.isMilestone),
                isManualLocked: Boolean(task.isManualLocked),
              };

              const previewTask = {
                ...task,
                title: draft.title,
                owner: draft.owner,
                sprintId: draft.sprintId,
                status: draft.status,
                plannedStart: draft.plannedStart,
                plannedEnd: draft.plannedEnd,
                plannedProgress: draft.plannedProgress,
                isMilestone: draft.isMilestone,
                durationDays: draft.durationDays,
                isManualLocked: draft.isManualLocked,
              };

              const rowFixes = getTaskQuickFixes(previewTask, tasks);
              const topFix = rowFixes[0];

              const isSelected = selectedRowId === task.id;
              const isSummaryTask = Boolean(task.isSummaryTask || hasChildren);
              const isFlashing = flashTaskId === task.id;
              const plannedProgress = Math.min(
                100,
                Math.max(0, Number(draft.plannedProgress || 0))
              );

              return (
                <tr
                  key={task.id}
                  ref={(element) => {
                    rowRefs.current[task.id] = element;
                  }}
                  onClick={() => setSelectedRowId(task.id)}
                  className={`border-b border-slate-200 transition ${
                    isFlashing
                      ? "bg-yellow-100"
                      : isSelected
                      ? "bg-blue-50/60"
                      : isSummaryTask
                      ? "bg-slate-50"
                      : "bg-white hover:bg-slate-50/60"
                  }`}
                >
                  <td className="px-1 py-1.5 align-top text-[11px] text-slate-500">
                    {index + 1}
                  </td>

                  <td className="px-1 py-1.5 align-top">
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

                  <td className="px-1 py-1.5 align-top">
                    <div
                      className="flex items-center gap-1"
                      style={{ paddingLeft: `${depth * 10}px` }}
                    >
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleCollapse(task.id);
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
                        readOnly={false}
                        onChange={(event) =>
                          updateDraft(task.id, "title", event.target.value)
                        }
                        className={
                          isSummaryTask
                            ? "font-semibold text-slate-900"
                            : "text-slate-800"
                        }
                      />
                    </div>
                  </td>

                  <td className="px-1 py-1.5 align-top">
                    <GridSelect
                      value={draft.sprintId}
                      disabled={isSummaryTask || !selectedProjectId}
                      onChange={(event) =>
                        updateDraft(task.id, "sprintId", event.target.value)
                      }
                    >
                      <option value="">No Sprint</option>
                      {sprints.map((sprint) => (
                        <option key={sprint.id} value={sprint.id}>
                          {sprint.name}
                        </option>
                      ))}
                    </GridSelect>
                  </td>

                  <td className="px-1 py-1.5 align-top">
                    <MilestoneCell
                      checked={Boolean(draft.isMilestone)}
                      disabled={isSummaryTask}
                      onChange={(checked) =>
                        updateDraft(task.id, "isMilestone", checked)
                      }
                    />
                  </td>

                  <td className="px-1 py-1.5 align-top">
                    <GridInput
                      type="number"
                      min="1"
                      readOnly={isSummaryTask}
                      value={draft.durationDays}
                      onChange={(event) =>
                        updateDraft(
                          task.id,
                          "durationDays",
                          event.target.value
                        )
                      }
                    />
                  </td>

                  <td className="px-1 py-1.5 align-top">
                    <GridInput
                      type="date"
                      readOnly={isSummaryTask}
                      value={draft.plannedStart}
                      onChange={(event) =>
                        updateDraft(
                          task.id,
                          "plannedStart",
                          event.target.value
                        )
                      }
                    />
                  </td>

                  <td className="px-1 py-1.5 align-top">
                    <GridInput
                      type="date"
                      readOnly={isSummaryTask}
                      value={draft.plannedEnd}
                      onChange={(event) =>
                        updateDraft(task.id, "plannedEnd", event.target.value)
                      }
                    />
                  </td>

                  <td className="px-1 py-1.5 align-top">
                    <GridInput
                      value={draft.predecessorInput}
                      readOnly={isSummaryTask}
                      onChange={(event) =>
                        updateDraft(
                          task.id,
                          "predecessorInput",
                          event.target.value
                        )
                      }
                      placeholder={dependencyText || "1,3"}
                      title={
                        dependencyText
                          ? `Current predecessors: ${dependencyText}`
                          : "Enter predecessor WBS or row number"
                      }
                    />
                  </td>

                  <td className="px-1 py-1.5 align-top">
                    <GridInput
                      value={draft.owner}
                      readOnly={false}
                      onChange={(event) =>
                        updateDraft(task.id, "owner", event.target.value)
                      }
                    />
                  </td>

                  <td className="px-1 py-1.5 align-top">
                    <GridInput
                      type="number"
                      min="0"
                      max="100"
                      readOnly={isSummaryTask}
                      value={draft.plannedProgress}
                      onChange={(event) =>
                        updateDraft(
                          task.id,
                          "plannedProgress",
                          event.target.value
                        )
                      }
                    />

                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${progressColor(
                          draft.status
                        )}`}
                        style={{ width: `${plannedProgress}%` }}
                      />
                    </div>
                  </td>

                  <td className="px-1 py-1.5 align-top">
                    <GridSelect
                      value={draft.status}
                      disabled={isSummaryTask}
                      className={statusSelectClass(draft.status)}
                      onChange={(event) =>
                        updateDraft(task.id, "status", event.target.value)
                      }
                    >
                      <option>Not Started</option>
                      <option>In Progress</option>
                      <option>Done</option>
                      <option>Blocked</option>
                    </GridSelect>
                  </td>

                  <td className="px-1 py-1.5 align-top">
                    {topFix ? (
                      <div
                        title={`${topFix.message} Quick fix: ${topFix.fix}`}
                      >
                        <span
                          className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-medium ${issueBadgeClass(
                            topFix.severity
                          )}`}
                        >
                          {rowFixes.length}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-100 px-1.5 text-[10px] font-medium text-emerald-700">
                        OK
                      </span>
                    )}
                  </td>

                  <td className="px-1 py-1.5 align-top">
                    <div className="flex items-center justify-end gap-1">
                      {!isSummaryTask ? (
                        <IconActionButton
                          type="button"
                          title={draft.isManualLocked ? "Locked" : "Auto"}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleManualLock(task.id);
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
                        title={isSummaryTask ? "Add subtask" : "Insert below"}
                        onClick={(event) => {
                          event.stopPropagation();

                          if (isSummaryTask) {
                            handleAddSubtask(task.id);
                          } else {
                            setSelectedRowId(task.id);
                            handleInsertBelow(task.id);
                          }
                        }}
                        className="bg-slate-100 text-slate-700 hover:bg-slate-200"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </IconActionButton>

                      <IconActionButton
                        type="button"
                        title="Delete row"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteRow(task.id);
                        }}
                        className="bg-red-50 text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconActionButton>
                    </div>
                  </td>
                </tr>
              );
            })}

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

      <div className="border-t border-slate-200 bg-slate-50/60 px-3 py-2">
        <div className="grid gap-1 text-[10px] text-slate-600 md:grid-cols-4">
          <div>
            <span className="font-medium text-slate-800">Auto-save:</span>{" "}
            every change is applied immediately.
          </div>

          <div>
            <span className="font-medium text-slate-800">Undo:</span> Ctrl + Z
            rolls back the last change.
          </div>

          <div>
            <span className="font-medium text-slate-800">Rollup:</span> parent
            rows are calculated.
          </div>

          <div>
            <span className="font-medium text-slate-800">Actions:</span> lock,
            insert/subtask, delete.
          </div>
        </div>
      </div>
    </div>
  );
}