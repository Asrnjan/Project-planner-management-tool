// Turns an AI-generated work breakdown into planner tasks: one summary row
// per phase, dated with a forward pass over dependencies (working days,
// weekends skipped).

const DAY_MS = 24 * 60 * 60 * 1000;

function parse(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function format(date) {
  return date.toISOString().slice(0, 10);
}

function isWeekend(date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function nextWorkingDay(iso) {
  let date = parse(iso);
  while (isWeekend(date)) date = new Date(date.getTime() + DAY_MS);
  return format(date);
}

/** End date of a task that starts on `startIso` and lasts `days` working days. */
export function addWorkingDays(startIso, days) {
  let date = parse(nextWorkingDay(startIso));
  let remaining = Math.max(1, Math.round(days)) - 1;
  while (remaining > 0) {
    date = new Date(date.getTime() + DAY_MS);
    if (!isWeekend(date)) remaining -= 1;
  }
  return format(date);
}

function dayAfter(iso) {
  return nextWorkingDay(format(new Date(parse(iso).getTime() + DAY_MS)));
}

function makeId(prefix) {
  const random =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

/**
 * @param {Array} aiTasks   [{ key, title, phase, durationDays, dependsOn, isMilestone, priority }]
 * @param {{ projectId: string, startDate: string }} options
 * @returns {Array} planner tasks ready for the store
 */
export function buildPlanTasks(aiTasks, { projectId, startDate }) {
  const start = nextWorkingDay(startDate);
  const valid = (Array.isArray(aiTasks) ? aiTasks : []).filter((task) => task && task.title);

  const keys = new Set();
  const items = valid.map((task, index) => {
    let key = String(task.key || `T${index + 1}`);
    while (keys.has(key)) key = `${key}_`;
    keys.add(key);
    return {
      ...task,
      key,
      id: makeId("task"),
      durationDays: task.isMilestone ? 1 : Math.min(60, Math.max(1, Number(task.durationDays) || 1)),
      phase: String(task.phase || "Plan").trim() || "Plan",
    };
  });

  const byKey = new Map(items.map((item) => [item.key, item]));

  // Forward pass. Dependencies may only point backwards; anything else
  // (unknown key, self or forward reference) is dropped to avoid cycles.
  const order = new Map(items.map((item, index) => [item.key, index]));
  items.forEach((item, index) => {
    const deps = (Array.isArray(item.dependsOn) ? item.dependsOn : [])
      .map(String)
      .filter((key) => byKey.has(key) && order.get(key) < index);
    item.deps = [...new Set(deps)];

    let earliest = start;
    item.deps.forEach((key) => {
      const predecessor = byKey.get(key);
      const candidate = predecessor.isMilestone ? predecessor.plannedEnd : dayAfter(predecessor.plannedEnd);
      if (candidate > earliest) earliest = candidate;
    });

    item.plannedStart = nextWorkingDay(earliest);
    item.plannedEnd = item.isMilestone
      ? item.plannedStart
      : addWorkingDays(item.plannedStart, item.durationDays);
  });

  const phases = [];
  const phaseIds = new Map();
  items.forEach((item) => {
    if (!phaseIds.has(item.phase)) {
      phaseIds.set(item.phase, makeId("task"));
      phases.push(item.phase);
    }
  });

  const result = [];
  phases.forEach((phase) => {
    const children = items.filter((item) => item.phase === phase);
    const phaseStart = children.map((c) => c.plannedStart).sort()[0];
    const phaseEnd = children.map((c) => c.plannedEnd).sort().reverse()[0];

    result.push({
      id: phaseIds.get(phase),
      projectId,
      parentTaskId: "",
      title: phase,
      isSummaryTask: true,
      priority: "Medium",
      status: "Not Started",
      plannedStart: phaseStart,
      plannedEnd: phaseEnd,
      dependencyIds: [],
      durationDays: 1,
    });

    children.forEach((item) => {
      result.push({
        id: item.id,
        projectId,
        parentTaskId: phaseIds.get(phase),
        title: String(item.title).trim(),
        priority: item.priority || "Medium",
        status: "Not Started",
        plannedStart: item.plannedStart,
        plannedEnd: item.plannedEnd,
        durationDays: item.durationDays,
        isMilestone: Boolean(item.isMilestone),
        dependencyIds: item.deps.map((key) => byKey.get(key).id),
        plannedProgress: 0,
        actualProgress: 0,
        owner: "",
      });
    });
  });

  return result;
}
