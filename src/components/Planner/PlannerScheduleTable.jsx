import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildTaskIndexMaps,
  calculateEndDateFromDuration,
  createGridDraftMap,
  getTaskDuration,
  applyGridDraftsToTasks,
  applySingleGridDraftToTask,
  getTaskQuickFixes,
} from "../../utils/planner";
import { Plus, Trash2, ChevronDown, Lock, Unlock } from "lucide-react";

function HeaderCell({ children, className = "" }) {
  return (
    <th
      className={`px-2 py-2 text-left text-[9px] font-semibold uppercase tracking-wide text-slate-500 ${className}`}
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
      className={`w-full rounded-md border px-2 py-1.5 text-[11px] leading-4 transition ${
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
        className={`w-full appearance-none rounded-md border px-2 py-1.5 pr-7 text-[11px] leading-4 transition ${
          disabled
            ? "border-slate-200 bg-slate-100 text-slate-600"
            : "border-slate-200 bg-white text-slate-900 focus:border-slate-400 focus:outline-none"
        } ${className}`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
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

function IconActionButton({ title, className = "", children, ...props }) {
  return (
    <button
      {...props}
      title={title}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition ${className}`}
    >
      {children}
    </button>
  );
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
  const rowRefs = useRef({});

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

  useEffect(() => {
    if (!focusedTaskId) return;

    const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
    const nextCollapsed = {};

    function openParentChain(taskId) {
      let current = byId[taskId];
      while (current?.parentTaskId) {
        nextCollapsed[current.parentTaskId] = false;
        current = byId[current.parentTaskId];
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
  }, [focusedTaskId, tasks]);

  const visibleTasks = useMemo(() => {
    return ordered.filter((task) => {
      if (!task.parentTaskId) return true;

      let currentParentId = task.parentTaskId;
      while (currentParentId) {
        if (collapsedParents[currentParentId]) return false;
        const parent = ordered.find((t) => t.id === currentParentId);
        currentParentId = parent?.parentTaskId || "";
      }
      return true;
    });
  }, [ordered, collapsedParents]);

  function toggleCollapse(taskId) {
    setCollapsedParents((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  }

  function updateDraft(taskId, field, value) {
    setDrafts((prev) => {
      const current = prev[taskId] || {};
      const next = {
        ...prev,
        [taskId]: {
          ...current,
          [field]: value,
        },
      };

      if (field === "durationDays" && current.plannedStart) {
        next[taskId].plannedEnd = calculateEndDateFromDuration(
          current.plannedStart,
          value
        );
      }

      if (field === "plannedStart") {
        next[taskId].plannedEnd = calculateEndDateFromDuration(
          value,
          current.durationDays || 1
        );
      }

      return next;
    });
  }

  function toggleManualLock(taskId) {
    setDrafts((prev) => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        isManualLocked: !prev[taskId]?.isManualLocked,
      },
    }));
  }

  function saveRow(taskId) {
    const task = tasks.find((item) => item.id === taskId);
    const draft = drafts[taskId];
    if (!task || !draft) return;

    const hasChildren = Boolean(childCountMap[taskId]);

    if (hasChildren) {
      const updatedSummaryRow = {
        ...task,
        title: draft.title,
        owner: draft.owner,
      };

      const nextTasks = tasks.map((item) =>
        item.id === taskId ? updatedSummaryRow : item
      );
      onBulkUpdate(nextTasks);
      setSelectedRowId(taskId);
      return;
    }

    const updatedRow = applySingleGridDraftToTask(
      task,
      { ...draft, isManualLocked: true },
      tasks
    );

    const nextTasks = tasks.map((item) => (item.id === taskId ? updatedRow : item));
    onBulkUpdate(nextTasks);
    setSelectedRowId(taskId);
  }

  function saveAllRows() {
    const summaryUpdated = tasks.map((task) => {
      const hasChildren = Boolean(childCountMap[task.id]);
      const draft = drafts[task.id];

      if (!hasChildren || !draft) return task;

      return {
        ...task,
        title: draft.title,
        owner: draft.owner,
      };
    });

    const recalculated = applyGridDraftsToTasks(summaryUpdated, drafts);
    onBulkUpdate(recalculated);
  }

  function handleAddRow() {
    if (!selectedProjectId) {
      alert("Select a project first to add plan rows.");
      return;
    }

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
      dependencyIds: [],
      dependencyRules: [],
      durationDays: 1,
      isMilestone: false,
      isManualLocked: false,
    });
  }

  function handleInsertBelow() {
    const selected = tasks.find((task) => task.id === selectedRowId);
    if (!selected) {
      alert("Select a row first.");
      return;
    }

    onAddTask({
      projectId: selected.projectId,
      sprintId: selected.sprintId || "",
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
      dependencyIds: [],
      dependencyRules: [],
      durationDays: 1,
      isMilestone: false,
      isManualLocked: false,
    });
  }

  function handleAddSubtask(targetTaskId) {
    const parentTask = tasks.find((task) => task.id === targetTaskId);
    if (!parentTask) {
      alert("Select a parent row first.");
      return;
    }

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
      dependencyIds: [],
      dependencyRules: [],
      durationDays: 1,
      isMilestone: false,
      isManualLocked: false,
    });

    setCollapsedParents((prev) => ({
      ...prev,
      [targetTaskId]: false,
    }));
  }

  function handleDeleteRow(taskId) {
    const confirmed = window.confirm("Delete this task row?");
    if (!confirmed) return;
    onDeleteTask(taskId);
    if (selectedRowId === taskId) {
      setSelectedRowId("");
    }
  }

  function handleCellKeyDown(e, taskId) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveAllRows();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      saveRow(taskId);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-3 py-3">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-slate-900">
              Planning Grid
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Summary rows allow name edits, while leaf tasks can be assigned to sprints.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={handleAddRow}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
            >
              Add
            </button>
            <button
              type="button"
              onClick={handleInsertBelow}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              Insert
            </button>
            <button
              type="button"
              onClick={() => handleAddSubtask(selectedRowId)}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              Subtask
            </button>
            <button
              type="button"
              onClick={saveAllRows}
              className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
            >
              Save All
            </button>
            <button
              type="button"
              onClick={onRecalculate}
              className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700"
            >
              Recalc
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-xs">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              <HeaderCell className="w-[3%]">#</HeaderCell>
              <HeaderCell className="w-[5%]">WBS</HeaderCell>
              <HeaderCell className="w-[21%]">Task</HeaderCell>
              <HeaderCell className="w-[10%]">Sprint</HeaderCell>
              <HeaderCell className="w-[6%]">Dur</HeaderCell>
              <HeaderCell className="w-[9%]">Start</HeaderCell>
              <HeaderCell className="w-[9%]">Finish</HeaderCell>
              <HeaderCell className="w-[8%]">Pred</HeaderCell>
              <HeaderCell className="w-[8%]">Owner</HeaderCell>
              <HeaderCell className="w-[6%]">%</HeaderCell>
              <HeaderCell className="w-[7%]">Status</HeaderCell>
              <HeaderCell className="w-[4%]">!</HeaderCell>
              <HeaderCell className="w-[14%]">Actions</HeaderCell>
            </tr>
          </thead>

          <tbody>
            {visibleTasks.map((task, index) => {
              const hasChildren = Boolean(childCountMap[task.id]);
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
                durationDays: draft.durationDays,
                isManualLocked: draft.isManualLocked,
              };

              const rowFixes = getTaskQuickFixes(previewTask, tasks);
              const topFix = rowFixes[0];

              const isSelected = selectedRowId === task.id;
              const isSummaryTask = Boolean(task.isSummaryTask || hasChildren);
              const isFlashing = flashTaskId === task.id;

              return (
                <tr
                  key={task.id}
                  ref={(el) => {
                    rowRefs.current[task.id] = el;
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
                  <td className="px-1.5 py-1.5 align-top">{index + 1}</td>
                  <td className="px-1.5 py-1.5 align-top text-slate-600">{task.wbs}</td>

                  <td className="px-1.5 py-1.5 align-top">
                    <div
                      className="flex items-center gap-1"
                      style={{ paddingLeft: `${(task.wbs.split(".").length - 1) * 8}px` }}
                    >
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCollapse(task.id);
                          }}
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-200 text-[10px] text-slate-600"
                        >
                          {collapsedParents[task.id] ? "+" : "-"}
                        </button>
                      ) : (
                        <span className="inline-block w-3 shrink-0 text-slate-300">
                          {task.parentTaskId ? "└" : ""}
                        </span>
                      )}

                      <GridInput
                        value={draft.title}
                        readOnly={false}
                        onKeyDown={(e) => handleCellKeyDown(e, task.id)}
                        onChange={(e) => updateDraft(task.id, "title", e.target.value)}
                        className={isSummaryTask ? "font-semibold" : ""}
                      />
                    </div>
                  </td>

                  <td className="px-1.5 py-1.5 align-top">
                    <GridSelect
                      value={draft.sprintId}
                      disabled={isSummaryTask || !selectedProjectId}
                      onKeyDown={(e) => handleCellKeyDown(e, task.id)}
                      onChange={(e) => updateDraft(task.id, "sprintId", e.target.value)}
                    >
                      <option value="">No Sprint</option>
                      {sprints.map((sprint) => (
                        <option key={sprint.id} value={sprint.id}>
                          {sprint.name}
                        </option>
                      ))}
                    </GridSelect>
                  </td>

                  <td className="px-1.5 py-1.5 align-top">
                    <GridInput
                      type="number"
                      min="1"
                      readOnly={isSummaryTask}
                      value={draft.durationDays}
                      onKeyDown={(e) => handleCellKeyDown(e, task.id)}
                      onChange={(e) => updateDraft(task.id, "durationDays", e.target.value)}
                    />
                  </td>

                  <td className="px-1.5 py-1.5 align-top">
                    <GridInput
                      type="date"
                      readOnly={isSummaryTask}
                      value={draft.plannedStart}
                      onKeyDown={(e) => handleCellKeyDown(e, task.id)}
                      onChange={(e) => updateDraft(task.id, "plannedStart", e.target.value)}
                    />
                  </td>

                  <td className="px-1.5 py-1.5 align-top">
                    <GridInput
                      type="date"
                      readOnly={isSummaryTask}
                      value={draft.plannedEnd}
                      onKeyDown={(e) => handleCellKeyDown(e, task.id)}
                      onChange={(e) => updateDraft(task.id, "plannedEnd", e.target.value)}
                    />
                  </td>

                  <td className="px-1.5 py-1.5 align-top">
                    <GridInput
                      value={draft.predecessorInput}
                      readOnly={isSummaryTask}
                      onKeyDown={(e) => handleCellKeyDown(e, task.id)}
                      onChange={(e) => updateDraft(task.id, "predecessorInput", e.target.value)}
                      placeholder="1,3"
                    />
                  </td>

                  <td className="px-1.5 py-1.5 align-top">
                    <GridInput
                      value={draft.owner}
                      readOnly={false}
                      onKeyDown={(e) => handleCellKeyDown(e, task.id)}
                      onChange={(e) => updateDraft(task.id, "owner", e.target.value)}
                    />
                  </td>

                  <td className="px-1.5 py-1.5 align-top">
                    <GridInput
                      type="number"
                      min="0"
                      max="100"
                      readOnly={isSummaryTask}
                      value={draft.plannedProgress}
                      onKeyDown={(e) => handleCellKeyDown(e, task.id)}
                      onChange={(e) => updateDraft(task.id, "plannedProgress", e.target.value)}
                    />
                  </td>

                  <td className="px-1.5 py-1.5 align-top">
                    <GridSelect
                      value={draft.status}
                      disabled={isSummaryTask}
                      onKeyDown={(e) => handleCellKeyDown(e, task.id)}
                      onChange={(e) => updateDraft(task.id, "status", e.target.value)}
                    >
                      <option>Not Started</option>
                      <option>In Progress</option>
                      <option>Done</option>
                      <option>Blocked</option>
                    </GridSelect>
                  </td>

                  <td className="px-1.5 py-1.5 align-top">
                    {topFix ? (
                      <div title={`${topFix.message} Quick fix: ${topFix.fix}`}>
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

                  <td className="px-1.5 py-1.5 align-top">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          saveRow(task.id);
                        }}
                        className="rounded-md bg-slate-900 px-2.5 py-1.5 text-[10px] font-medium text-white"
                      >
                        Save
                      </button>

                      {!isSummaryTask ? (
                        <button
                          type="button"
                          title={draft.isManualLocked ? "Locked" : "Auto"}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleManualLock(task.id);
                          }}
                          className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-medium ${
                            draft.isManualLocked
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {draft.isManualLocked ? (
                            <Lock className="h-3 w-3" />
                          ) : (
                            <Unlock className="h-3 w-3" />
                          )}
                          <span>{draft.isManualLocked ? "Lock" : "Auto"}</span>
                        </button>
                      ) : (
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">
                          Rollup
                        </span>
                      )}

                      <IconActionButton
                        type="button"
                        title={isSummaryTask ? "Add subtask" : "Insert below"}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSummaryTask) {
                            handleAddSubtask(task.id);
                          } else {
                            setSelectedRowId(task.id);
                            handleInsertBelow();
                          }
                        }}
                        className="bg-slate-100 text-slate-700 hover:bg-slate-200"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </IconActionButton>

                      <IconActionButton
                        type="button"
                        title="Delete row"
                        onClick={(e) => {
                          e.stopPropagation();
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
                <td colSpan="13" className="px-4 py-8 text-center text-sm text-slate-500">
                  No plan rows found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-200 bg-slate-50/60 px-3 py-2">
        <div className="grid gap-1 text-[10px] text-slate-600 md:grid-cols-4">
          <div><span className="font-medium text-slate-800">Sprint column:</span> assign leaf tasks to a sprint.</div>
          <div><span className="font-medium text-slate-800">Summary rows:</span> title and owner editable.</div>
          <div><span className="font-medium text-slate-800">Rollup fields:</span> dates, duration, %, status.</div>
          <div><span className="font-medium text-slate-800">Plus button:</span> adds subtask on summary rows.</div>
        </div>
      </div>
    </div>
  );
}