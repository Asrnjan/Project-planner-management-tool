import {
  differenceInCalendarDays,
  parseISO,
  isValid,
  addDays,
  format,
} from "date-fns";

export function safeParseDate(value) {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

export function calculateDurationDays(start, end) {
  const s = safeParseDate(start);
  const e = safeParseDate(end);
  if (!s || !e) return "";
  return differenceInCalendarDays(e, s) + 1;
}

export function calculateEndDateFromDuration(start, durationDays) {
  const parsed = safeParseDate(start);
  const duration = Math.max(1, Number(durationDays || 1));
  if (!parsed) return "";
  return format(addDays(parsed, duration - 1), "yyyy-MM-dd");
}

export function calculateStartDateFromEnd(end, durationDays) {
  const parsed = safeParseDate(end);
  const duration = Math.max(1, Number(durationDays || 1));
  if (!parsed) return "";
  return format(addDays(parsed, -(duration - 1)), "yyyy-MM-dd");
}

export function getTaskDuration(task) {
  const explicit = Number(task.durationDays || 0);
  if (explicit > 0) return explicit;

  const derived = Number(calculateDurationDays(task.plannedStart, task.plannedEnd) || 0);
  return derived > 0 ? derived : 1;
}

export function buildWbs(tasks) {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const childrenMap = new Map();

  tasks.forEach((task) => {
    const parentId = task.parentTaskId || "";
    if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
    childrenMap.get(parentId).push(task);
  });

  const ordered = [];

  function walk(task, prefix) {
    ordered.push({ ...task, wbs: prefix });

    const children = childrenMap.get(task.id) || [];
    children.forEach((child, index) => {
      walk(child, `${prefix}.${index + 1}`);
    });
  }

  const rootTasks = tasks.filter(
    (task) => !task.parentTaskId || !taskMap.has(task.parentTaskId)
  );

  rootTasks.forEach((task, index) => {
    walk(task, `${index + 1}`);
  });

  return ordered;
}

export function buildTaskIndexMaps(tasks) {
  const byId = Object.fromEntries(tasks.map((task) => [task.id, task]));
  const ordered = buildWbs(tasks);
  const byWbs = Object.fromEntries(ordered.map((task) => [task.wbs, task]));
  const indexById = Object.fromEntries(ordered.map((task, index) => [task.id, index + 1]));

  return { byId, byWbs, indexById, ordered };
}

export function getTaskDependencyRules(task) {
  return Array.isArray(task.dependencyRules) ? task.dependencyRules : [];
}

export function getPredecessorText(task, allTasks) {
  const { indexById } = buildTaskIndexMaps(allTasks);

  return (task.dependencyIds || [])
    .map((id) => indexById[id])
    .filter(Boolean)
    .join(", ");
}

export function getPredecessorNames(task, allTasks) {
  const { byId } = buildTaskIndexMaps(allTasks);

  return (task.dependencyIds || [])
    .map((id) => byId[id]?.title)
    .filter(Boolean);
}

export function parsePredecessorInput(input, allTasks, currentTaskId) {
  const text = String(input || "").trim();
  if (!text) return { dependencyIds: [], dependencyRules: [] };

  const { byId, byWbs, ordered } = buildTaskIndexMaps(allTasks);
  const rowLookup = Object.fromEntries(
    ordered.map((task, index) => [String(index + 1), task])
  );

  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const dependencyIds = [];

  parts.forEach((part) => {
    let matchedTask = null;

    if (byId[part]) {
      matchedTask = byId[part];
    } else if (byWbs[part]) {
      matchedTask = byWbs[part];
    } else if (rowLookup[part]) {
      matchedTask = rowLookup[part];
    }

    if (!matchedTask || matchedTask.id === currentTaskId) return;
    dependencyIds.push(matchedTask.id);
  });

  return {
    dependencyIds: [...new Set(dependencyIds)],
    dependencyRules: [],
  };
}

export function getBlockedByMap(tasks) {
  const blockedByMap = {};

  tasks.forEach((task) => {
    (task.dependencyIds || []).forEach((dependencyId) => {
      if (!blockedByMap[dependencyId]) blockedByMap[dependencyId] = [];
      blockedByMap[dependencyId].push(task.id);
    });
  });

  return blockedByMap;
}

export function getTaskWarnings(task, allTasks) {
  const { byId } = buildTaskIndexMaps(allTasks);
  const warnings = [];

  const predecessors = (task.dependencyIds || [])
    .map((id) => byId[id])
    .filter(Boolean);

  const unfinishedPredecessors = predecessors.filter((p) => p.status !== "Done");
  if (unfinishedPredecessors.length > 0) {
    warnings.push({
      type: "dependency",
      message: `Waiting on ${unfinishedPredecessors.length} unfinished predecessor(s)`,
    });
  }

  const taskStart = safeParseDate(task.plannedStart);
  predecessors.forEach((pred) => {
    const predEnd = safeParseDate(pred.plannedEnd);
    if (taskStart && predEnd && taskStart < addDays(predEnd, 1)) {
      warnings.push({
        type: "sequence",
        message: `Starts before predecessor "${pred.title}" finishes`,
      });
    }
  });

  return warnings;
}

export function getCriticalPathStarter(tasks) {
  const { byId } = buildTaskIndexMaps(tasks);
  const memo = {};

  function duration(task) {
    return Number(getTaskDuration(task) || 0);
  }

  function longestPath(task) {
    if (memo[task.id] !== undefined) return memo[task.id];

    const predecessors = (task.dependencyIds || [])
      .map((id) => byId[id])
      .filter(Boolean);

    if (predecessors.length === 0) {
      memo[task.id] = duration(task);
      return memo[task.id];
    }

    const maxPred = Math.max(...predecessors.map(longestPath));
    memo[task.id] = maxPred + duration(task);
    return memo[task.id];
  }

  const scored = tasks.map((task) => ({
    ...task,
    criticalScore: longestPath(task),
  }));

  const maxScore = Math.max(...scored.map((t) => t.criticalScore), 0);

  return scored
    .filter((task) => task.criticalScore === maxScore && maxScore > 0)
    .map((task) => task.id);
}

export function getPlannerWarnings(tasks) {
  const { byId } = buildTaskIndexMaps(tasks);
  const blockedByMap = getBlockedByMap(tasks);

  const warnings = [];

  tasks.forEach((task) => {
    const taskWarnings = getTaskWarnings(task, tasks);

    taskWarnings.forEach((warning) => {
      warnings.push({
        taskId: task.id,
        taskTitle: task.title,
        type: warning.type,
        message: warning.message,
      });
    });

    const downstream = (blockedByMap[task.id] || [])
      .map((id) => byId[id])
      .filter(Boolean);

    if (task.status === "Blocked" && downstream.length > 0) {
      warnings.push({
        taskId: task.id,
        taskTitle: task.title,
        type: "blocked-chain",
        message: `Blocking ${downstream.length} downstream task(s)`,
      });
    }
  });

  return warnings;
}

export function recalculateFinishToStartSchedule(tasks, options = {}) {
  const mode = options.mode || "manual";
  const cloned = tasks.map((task) => ({ ...task }));
  const byId = Object.fromEntries(cloned.map((task) => [task.id, task]));

  let changed = true;
  let guard = 0;

  while (changed && guard < 30) {
    changed = false;
    guard += 1;

    cloned.forEach((task) => {
      const predecessors = (task.dependencyIds || [])
        .map((id) => byId[id])
        .filter(Boolean);

      if (!predecessors.length) return;

      const predecessorEnds = predecessors
        .map((pred) => safeParseDate(pred.plannedEnd))
        .filter(Boolean);

      if (!predecessorEnds.length) return;

      const latestPredEnd = predecessorEnds.reduce((latest, current) =>
        current > latest ? current : latest
      );

      const suggestedStart = addDays(latestPredEnd, 1);
      const currentStart = safeParseDate(task.plannedStart);
      const duration = getTaskDuration(task);

      const shouldMove =
        !currentStart ||
        currentStart < suggestedStart ||
        mode === "auto";

      if (shouldMove) {
        task.plannedStart = format(suggestedStart, "yyyy-MM-dd");
        task.plannedEnd = format(addDays(suggestedStart, duration - 1), "yyyy-MM-dd");
        changed = true;
      }
    });
  }

  return cloned;
}

export function getDependencyConflicts(tasks) {
  const conflicts = [];

  tasks.forEach((task) => {
    const warnings = getTaskWarnings(task, tasks);
    warnings.forEach((warning) => {
      if (warning.type === "sequence") {
        conflicts.push({
          taskId: task.id,
          taskTitle: task.title,
          message: warning.message,
        });
      }
    });
  });

  return conflicts;
}

export function getTaskRelationships(taskId, tasks) {
  const { byId } = buildTaskIndexMaps(tasks);
  const task = byId[taskId];
  if (!task) {
    return {
      current: null,
      predecessors: [],
      successors: [],
    };
  }

  const predecessors = (task.dependencyIds || [])
    .map((id) => byId[id])
    .filter(Boolean);

  const successors = tasks.filter((t) => (t.dependencyIds || []).includes(taskId));

  return {
    current: task,
    predecessors,
    successors,
  };
}

export function getDependencyGraphStarter(tasks) {
  const { ordered, indexById } = buildTaskIndexMaps(tasks);

  return ordered.map((task) => ({
    id: task.id,
    row: indexById[task.id],
    title: task.title,
    predecessors: (task.dependencyIds || []).map((id) => indexById[id]).filter(Boolean),
    successors: ordered
      .filter((other) => (other.dependencyIds || []).includes(task.id))
      .map((other) => indexById[other.id]),
    status: task.status,
  }));
}

export function getProjectRiskSummary(tasks) {
  const warnings = getPlannerWarnings(tasks);
  const criticalIds = getCriticalPathStarter(tasks);
  const blockedCount = tasks.filter((t) => t.status === "Blocked").length;
  const overdueCount = tasks.filter((t) => {
    const end = safeParseDate(t.plannedEnd);
    return end && t.status !== "Done" && new Date() > end;
  }).length;

  let riskLevel = "Low";
  if (warnings.length > 0 || blockedCount > 0) riskLevel = "Medium";
  if (warnings.length > 3 || blockedCount > 1 || overdueCount > 1) riskLevel = "High";

  return {
    riskLevel,
    warningCount: warnings.length,
    criticalCount: criticalIds.length,
    blockedCount,
    overdueCount,
  };
}

export function getVisibleHierarchyTasks(tasks, collapsedParents = {}) {
  const { ordered } = buildTaskIndexMaps(tasks);

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
}

function rollupSummaryTasks(tasks) {
  const byId = Object.fromEntries(tasks.map((task) => [task.id, task]));
  const childrenMap = {};

  tasks.forEach((task) => {
    if (task.parentTaskId) {
      if (!childrenMap[task.parentTaskId]) childrenMap[task.parentTaskId] = [];
      childrenMap[task.parentTaskId].push(task.id);
    }
  });

  function visit(taskId) {
    const task = byId[taskId];
    const childIds = childrenMap[taskId] || [];
    if (!task) return;

    childIds.forEach(visit);

    if (!childIds.length) {
      task.isSummaryTask = false;
      return;
    }

    const children = childIds.map((id) => byId[id]).filter(Boolean);

    const childStarts = children
      .map((child) => safeParseDate(child.plannedStart))
      .filter(Boolean);

    const childEnds = children
      .map((child) => safeParseDate(child.plannedEnd))
      .filter(Boolean);

    const childProgress = children.map((child) => Number(child.plannedProgress || 0));
    const allDone = children.every((child) => child.status === "Done");
    const anyInProgress = children.some(
      (child) => child.status === "In Progress" || child.status === "Done"
    );
    const anyBlocked = children.some((child) => child.status === "Blocked");

    if (childStarts.length) {
      const minStart = childStarts.sort((a, b) => a - b)[0];
      task.plannedStart = format(minStart, "yyyy-MM-dd");
    }

    if (childEnds.length) {
      const maxEnd = childEnds.sort((a, b) => b - a)[0];
      task.plannedEnd = format(maxEnd, "yyyy-MM-dd");
    }

    task.durationDays = Number(calculateDurationDays(task.plannedStart, task.plannedEnd) || 1);
    task.plannedProgress = childProgress.length
      ? Math.round(childProgress.reduce((sum, val) => sum + val, 0) / childProgress.length)
      : Number(task.plannedProgress || 0);

    if (anyBlocked) {
      task.status = "Blocked";
    } else if (allDone) {
      task.status = "Done";
    } else if (anyInProgress) {
      task.status = "In Progress";
    } else {
      task.status = "Not Started";
    }

    task.isSummaryTask = true;
  }

  tasks
    .filter((task) => !task.parentTaskId)
    .forEach((task) => visit(task.id));

  return tasks;
}

function getMostRestrictiveStart(task, ordered, byId, index) {
  if ((task.dependencyIds || []).length > 0) {
    const predecessors = (task.dependencyIds || [])
      .map((id) => byId[id])
      .filter(Boolean);

    const latestPredEnd = predecessors
      .map((pred) => safeParseDate(pred.plannedEnd))
      .filter(Boolean)
      .sort((a, b) => b - a)[0];

    if (latestPredEnd) {
      return format(addDays(latestPredEnd, 1), "yyyy-MM-dd");
    }
  }

  if (!task.plannedStart && index > 0) {
    const previousTask = byId[ordered[index - 1].id];
    const prevEnd = safeParseDate(previousTask?.plannedEnd);
    if (prevEnd) {
      return format(addDays(prevEnd, 1), "yyyy-MM-dd");
    }
  }

  return task.plannedStart || "";
}

export function recalculateMsProjectSchedule(tasks) {
  const cloned = tasks.map((task) => ({ ...task }));
  const { ordered, indexById } = buildTaskIndexMaps(cloned);
  const byId = Object.fromEntries(cloned.map((task) => [task.id, task]));

  ordered.forEach((orderedTask, index) => {
    const task = byId[orderedTask.id];
    const duration = getTaskDuration(task);

    const hasChildren = cloned.some((item) => item.parentTaskId === task.id);
    if (hasChildren) {
      task.rowNumber = indexById[task.id];
      return;
    }

    if (task.isManualLocked) {
      task.rowNumber = indexById[task.id];
      return;
    }

    const nextStart = getMostRestrictiveStart(task, ordered, byId, index);

    if (nextStart) {
      task.plannedStart = nextStart;
      task.plannedEnd = calculateEndDateFromDuration(nextStart, duration);
    }

    task.rowNumber = indexById[task.id];
  });

  return rollupSummaryTasks(cloned);
}

export function createGridDraftMap(tasks) {
  const map = {};

  tasks.forEach((task) => {
    const duration = getTaskDuration(task);
    map[task.id] = {
      id: task.id,
      title: task.title || "",
      owner: task.owner || "",
      sprintId: task.sprintId || "",
      status: task.status || "Not Started",
      durationDays: duration,
      plannedStart: task.plannedStart || "",
      plannedEnd: task.plannedEnd || "",
      predecessorInput: getPredecessorText(task, tasks),
      plannedProgress: Number(task.plannedProgress || 0),
      isMilestone: Boolean(task.isMilestone),
      isManualLocked: Boolean(task.isManualLocked),
      _originalDurationDays: duration,
      _originalPlannedStart: task.plannedStart || "",
      _originalPlannedEnd: task.plannedEnd || "",
    };
  });

  return map;
}

export function applySingleGridDraftToTask(task, draft, allTasks) {
  if (!draft) return { ...task };

  const parsed = parsePredecessorInput(
    draft.predecessorInput,
    allTasks,
    task.id
  );

  const durationDays = Math.max(1, Number(draft.durationDays || 1));
  const startChanged =
    String(draft.plannedStart || "") !== String(draft._originalPlannedStart || "");
  const durationChanged =
    Number(draft.durationDays || 1) !== Number(draft._originalDurationDays || 1);

  let plannedStart = draft.plannedStart || "";
  let plannedEnd = draft.plannedEnd || "";

  if ((startChanged || durationChanged) && plannedStart) {
    plannedEnd = calculateEndDateFromDuration(plannedStart, durationDays);
  }

  return {
    ...task,
    title: draft.title,
    owner: draft.owner,
    sprintId: draft.sprintId || "",
    status: draft.status,
    plannedStart,
    plannedEnd,
    dependencyIds: parsed.dependencyIds,
    dependencyRules: [],
    durationDays,
    plannedProgress: Number(draft.plannedProgress || 0),
    isMilestone: Boolean(draft.isMilestone),
    isManualLocked: Boolean(draft.isManualLocked),
  };
}

export function applyGridDraftsToTasks(tasks, drafts) {
  const updated = tasks.map((task) => {
    const draft = drafts[task.id];
    if (!draft) return { ...task };
    return applySingleGridDraftToTask(task, draft, tasks);
  });

  return recalculateMsProjectSchedule(updated);
}

export function getTaskQuickFixes(task, allTasks) {
  const fixes = [];
  const { byId, ordered } = buildTaskIndexMaps(allTasks);
  const dependencyText = getPredecessorText(task, allTasks);
  const hasChildren = allTasks.some((t) => t.parentTaskId === task.id);
  const duration = Number(getTaskDuration(task) || 0);

  if (!task.title || !String(task.title).trim()) {
    fixes.push({
      severity: "high",
      type: "missing-title",
      message: "Task name is missing.",
      fix: "Enter a task name.",
    });
  }

  if (!hasChildren && !task.plannedStart) {
    fixes.push({
      severity: "medium",
      type: "missing-start",
      message: "Start date is missing.",
      fix: "Enter a start date, or use Save All / Recalculate on an Auto row.",
    });
  }

  if (!hasChildren && (!duration || duration < 1)) {
    fixes.push({
      severity: "high",
      type: "missing-duration",
      message: "Duration is missing or invalid.",
      fix: "Set duration to 1 day or more.",
    });
  }

  if (!hasChildren && task.plannedStart && duration > 0) {
    const expectedEnd = calculateEndDateFromDuration(task.plannedStart, duration);
    if (task.plannedEnd && expectedEnd !== task.plannedEnd) {
      fixes.push({
        severity: "medium",
        type: "finish-mismatch",
        message: "Finish date does not match Start + Duration.",
        fix: `Use ${expectedEnd} as finish date, or adjust duration/start.`,
      });
    }
  }

  if (dependencyText && (!task.dependencyIds || task.dependencyIds.length === 0)) {
    fixes.push({
      severity: "medium",
      type: "bad-predecessor",
      message: "Predecessor text could not be interpreted.",
      fix: "Use simple row numbers like 1 or 1,3,5.",
    });
  }

  (task.dependencyIds || []).forEach((depId) => {
    const pred = byId[depId];
    if (!pred) {
      fixes.push({
        severity: "high",
        type: "missing-predecessor",
        message: "A predecessor row is missing.",
        fix: "Remove or correct the predecessor reference.",
      });
      return;
    }

    if (!pred.plannedStart || !pred.plannedEnd) {
      fixes.push({
        severity: "medium",
        type: "predecessor-dates-missing",
        message: `Predecessor "${pred.title}" is missing dates.`,
        fix: `Fill dates for row ${ordered.findIndex((t) => t.id === pred.id) + 1} first.`,
      });
    }
  });

  if (!hasChildren && task.isManualLocked) {
    fixes.push({
      severity: "low",
      type: "manual-lock",
      message: "Row is locked.",
      fix: "Unlock it if you want Save All / Recalculate to move it.",
    });
  }

  if (!hasChildren && !task.isManualLocked) {
    fixes.push({
      severity: "low",
      type: "auto-row",
      message: "Row is in Auto mode.",
      fix: "Lock it after saving if you do not want it to move later.",
    });
  }

  return fixes;
}

export function getPlannerQuickFixes(tasks) {
  const all = [];

  tasks.forEach((task) => {
    const fixes = getTaskQuickFixes(task, tasks);
    fixes.forEach((item) => {
      all.push({
        taskId: task.id,
        taskTitle: task.title || "Untitled Task",
        ...item,
      });
    });
  });

  return all;
}