// Project analytics computed locally. These numbers drive the dashboard and
// are also the compact input sent to Claude, so the AI never has to read raw
// task lists to do arithmetic (cheaper and more accurate).

import { isDoneStatus, normalizeTaskStatus } from "./vocabulary";

const DAY_MS = 24 * 60 * 60 * 1000;

export function todayIso(now = new Date()) {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function toDayNumber(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const value = Date.UTC(y, m - 1, d) / DAY_MS;
  return Number.isFinite(value) ? value : null;
}

export function daysBetween(fromIso, toIso) {
  const from = toDayNumber(fromIso);
  const to = toDayNumber(toIso);
  if (from === null || to === null) return null;
  return to - from;
}

function addDaysIso(iso, days) {
  const base = toDayNumber(iso);
  if (base === null) return "";
  return new Date((base + days) * DAY_MS).toISOString().slice(0, 10);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Share of a task's planned window that has elapsed by `today` (0..1). */
export function expectedProgressRatio(task, today) {
  const start = toDayNumber(task.plannedStart);
  const end = toDayNumber(task.plannedEnd || task.plannedStart);
  const now = toDayNumber(today);
  if (start === null || end === null || now === null) return null;
  if (now < start) return 0;
  if (now >= end) return 1;
  return clamp((now - start + 1) / (end - start + 1), 0, 1);
}

function taskActualRatio(task) {
  if (isDoneStatus(task.status)) return 1;
  return clamp(Number(task.actualProgress || 0) / 100, 0, 1);
}

function taskWeight(task) {
  const start = toDayNumber(task.plannedStart);
  const end = toDayNumber(task.plannedEnd || task.plannedStart);
  if (start === null || end === null) return 1;
  return Math.max(1, end - start + 1);
}

/** Leaf tasks only, so summary rows do not double count their children. */
export function leafTasks(tasks) {
  const parents = new Set(tasks.map((task) => task.parentTaskId).filter(Boolean));
  return tasks.filter((task) => !parents.has(task.id) && !task.isSummaryTask);
}

export function isOverdue(task, today) {
  if (isDoneStatus(task.status)) return false;
  const end = task.plannedEnd || (task.isMilestone ? task.plannedStart : "");
  return Boolean(end) && end < today;
}

export function computeProjectMetrics(project, allTasks, today = todayIso()) {
  const projectTasks = allTasks.filter((task) => task.projectId === project.id);
  const work = leafTasks(projectTasks);

  const counts = { "Not Started": 0, "In Progress": 0, Done: 0, Blocked: 0 };
  work.forEach((task) => {
    counts[normalizeTaskStatus(task.status, task.actualProgress)] += 1;
  });

  let earned = 0;
  let planned = 0;
  let totalWeight = 0;

  work.forEach((task) => {
    const weight = taskWeight(task);
    totalWeight += weight;
    earned += weight * taskActualRatio(task);
    const expected = expectedProgressRatio(task, today);
    if (expected !== null) planned += weight * expected;
  });

  const open = work.filter((task) => !isDoneStatus(task.status));
  const overdue = open.filter((task) => isOverdue(task, today));
  const dueSoon = open.filter((task) => {
    const end = task.plannedEnd || task.plannedStart;
    if (!end || end < today) return false;
    const days = daysBetween(today, end);
    return days !== null && days <= 7;
  });
  const unassigned = open.filter((task) => !String(task.owner || "").trim());
  const missingDates = open.filter((task) => !task.plannedStart || !task.plannedEnd);
  const milestones = projectTasks.filter((task) => task.isMilestone);
  const upcomingMilestones = milestones
    .filter((task) => !isDoneStatus(task.status))
    .sort((a, b) => String(a.plannedStart || a.plannedEnd).localeCompare(String(b.plannedStart || b.plannedEnd)));

  const percentComplete = totalWeight ? Math.round((earned / totalWeight) * 100) : 0;
  const percentPlanned = totalWeight ? Math.round((planned / totalWeight) * 100) : 0;
  // Schedule performance index: work done / work that should be done by now.
  const spi = planned > 0 ? Number((earned / planned).toFixed(2)) : null;

  const plannedEnds = projectTasks.map((task) => task.plannedEnd).filter(Boolean).sort();
  const latestPlannedEnd = plannedEnds[plannedEnds.length - 1] || "";

  // Forecast: when overdue work exists, assume it finishes no earlier than
  // today plus its original duration, then take the latest open end date.
  let forecastFinish = latestPlannedEnd;
  open.forEach((task) => {
    const end = task.plannedEnd || task.plannedStart;
    if (!end) return;
    let projected = end;
    if (end < today) {
      const remaining = Math.ceil(taskWeight(task) * (1 - taskActualRatio(task)));
      projected = addDaysIso(today, Math.max(1, remaining));
    }
    if (!forecastFinish || projected > forecastFinish) forecastFinish = projected;
  });

  const slipDays =
    project.targetEndDate && forecastFinish
      ? daysBetween(project.targetEndDate, forecastFinish)
      : null;

  const health = deriveHealth({
    total: work.length,
    done: counts.Done,
    overdue: overdue.length,
    blocked: counts.Blocked,
    spi,
    slipDays,
  });

  return {
    projectId: project.id,
    total: work.length,
    summaryRows: projectTasks.length - work.length,
    notStarted: counts["Not Started"],
    inProgress: counts["In Progress"],
    done: counts.Done,
    blocked: counts.Blocked,
    overdue: overdue.length,
    dueSoon: dueSoon.length,
    unassigned: unassigned.length,
    missingDates: missingDates.length,
    milestones: milestones.length,
    nextMilestone: upcomingMilestones[0]
      ? {
          title: upcomingMilestones[0].title,
          date: upcomingMilestones[0].plannedStart || upcomingMilestones[0].plannedEnd || "",
        }
      : null,
    percentComplete,
    percentPlanned,
    spi,
    latestPlannedEnd,
    forecastFinish,
    slipDays,
    health,
    overdueTasks: overdue,
    dueSoonTasks: dueSoon,
    blockedTasks: open.filter((task) => normalizeTaskStatus(task.status) === "Blocked"),
    unassignedTasks: unassigned,
  };
}

export function deriveHealth({ total, done, overdue, blocked, spi, slipDays }) {
  if (!total) return { level: "empty", label: "No tasks yet" };
  if (done === total) return { level: "done", label: "Complete" };

  const overdueShare = overdue / Math.max(1, total - done);
  if (
    (spi !== null && spi < 0.75) ||
    overdueShare > 0.25 ||
    (slipDays !== null && slipDays > 14)
  ) {
    return { level: "off", label: "Off track" };
  }
  if (
    (spi !== null && spi < 0.92) ||
    overdue > 0 ||
    blocked > 0 ||
    (slipDays !== null && slipDays > 0)
  ) {
    return { level: "risk", label: "At risk" };
  }
  return { level: "good", label: "On track" };
}

export const HEALTH_TONE = {
  good: "green",
  risk: "amber",
  off: "red",
  done: "blue",
  empty: "slate",
};

export function computeWorkload(tasks, today = todayIso()) {
  const byOwner = new Map();
  leafTasks(tasks)
    .filter((task) => !isDoneStatus(task.status))
    .forEach((task) => {
      const owner = String(task.owner || "").trim() || "Unassigned";
      const entry = byOwner.get(owner) || { owner, open: 0, overdue: 0, blocked: 0, dueSoon: 0 };
      entry.open += 1;
      if (isOverdue(task, today)) entry.overdue += 1;
      if (normalizeTaskStatus(task.status) === "Blocked") entry.blocked += 1;
      const end = task.plannedEnd;
      if (end && end >= today && (daysBetween(today, end) ?? 99) <= 7) entry.dueSoon += 1;
      byOwner.set(owner, entry);
    });
  return [...byOwner.values()].sort((a, b) => b.open - a.open);
}

export function computePortfolio(projects, tasks, today = todayIso()) {
  const perProject = projects.map((project) => ({
    project,
    metrics: computeProjectMetrics(project, tasks, today),
  }));

  const sum = (key) => perProject.reduce((total, item) => total + item.metrics[key], 0);
  const totalTasks = sum("total");
  const done = sum("done");

  const healthCounts = { good: 0, risk: 0, off: 0, done: 0, empty: 0 };
  perProject.forEach(({ metrics }) => {
    healthCounts[metrics.health.level] += 1;
  });

  const projectName = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const attention = [];
  perProject.forEach(({ metrics }) => {
    metrics.overdueTasks.forEach((task) =>
      attention.push({ kind: "overdue", task, projectName: projectName[task.projectId], days: daysBetween(task.plannedEnd || task.plannedStart, today) })
    );
    metrics.blockedTasks
      .filter((task) => !isOverdue(task, today))
      .forEach((task) => attention.push({ kind: "blocked", task, projectName: projectName[task.projectId] }));
    metrics.dueSoonTasks
      .filter((task) => !String(task.owner || "").trim())
      .forEach((task) => attention.push({ kind: "unassigned", task, projectName: projectName[task.projectId] }));
  });
  const rank = { overdue: 0, blocked: 1, unassigned: 2 };
  attention.sort((a, b) => rank[a.kind] - rank[b.kind] || (b.days || 0) - (a.days || 0));

  return {
    projectCount: projects.length,
    activeProjects: projects.filter((p) => !["Completed", "Archived"].includes(p.status)).length,
    totalTasks,
    done,
    percentDone: totalTasks ? Math.round((done / totalTasks) * 100) : 0,
    overdue: sum("overdue"),
    blocked: sum("blocked"),
    dueSoon: sum("dueSoon"),
    unassigned: sum("unassigned"),
    healthCounts,
    perProject,
    attention,
    workload: computeWorkload(tasks, today),
  };
}
