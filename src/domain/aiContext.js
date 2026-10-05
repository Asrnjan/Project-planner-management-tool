// Builds the compact inputs sent to Claude. Keeping these small is the main
// cost lever: no ids, no empty fields, short strings, capped lists, and all
// arithmetic pre-computed by analytics.js.

import {
  computePortfolio,
  computeProjectMetrics,
  computeWorkload,
  daysBetween,
  todayIso,
} from "./analytics";
import { isDoneStatus } from "./vocabulary";

const MAX_TEXT = 90;

function short(value, max = MAX_TEXT) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Drops empty values so they cost no tokens. */
function compact(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => {
      if (value === null || value === undefined || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    })
  );
}

function taskLine(task, today, extra = {}) {
  const end = task.plannedEnd || task.plannedStart;
  return compact({
    task: short(task.title),
    owner: short(task.owner, 40),
    due: end,
    daysLate: end && end < today ? daysBetween(end, today) : undefined,
    progress: Number(task.actualProgress || 0) || undefined,
    priority: task.priority && task.priority !== "Medium" ? task.priority : undefined,
    note: task.notes ? short(task.notes, 80) : undefined,
    ...extra,
  });
}

function metricsSummary(metrics) {
  return compact({
    health: metrics.health.label,
    tasks: metrics.total,
    done: metrics.done,
    inProgress: metrics.inProgress,
    blocked: metrics.blocked,
    overdue: metrics.overdue,
    dueNext7Days: metrics.dueSoon,
    unassignedOpen: metrics.unassigned,
    missingDates: metrics.missingDates,
    percentComplete: metrics.percentComplete,
    percentPlannedByToday: metrics.percentPlanned,
    spi: metrics.spi,
    forecastFinish: metrics.forecastFinish,
    slipDays: metrics.slipDays,
    nextMilestone: metrics.nextMilestone
      ? `${short(metrics.nextMilestone.title, 50)} (${metrics.nextMilestone.date || "no date"})`
      : undefined,
  });
}

export function buildPortfolioDigest(projects, tasks, today = todayIso()) {
  const portfolio = computePortfolio(projects, tasks, today);

  return {
    today,
    totals: compact({
      projects: portfolio.projectCount,
      active: portfolio.activeProjects,
      tasks: portfolio.totalTasks,
      percentDone: portfolio.percentDone,
      overdue: portfolio.overdue,
      blocked: portfolio.blocked,
      dueNext7Days: portfolio.dueSoon,
      unassignedOpen: portfolio.unassigned,
    }),
    projects: portfolio.perProject.slice(0, 25).map(({ project, metrics }) =>
      compact({
        name: short(project.name, 60),
        status: project.status,
        owner: short(project.owner, 40),
        target: project.targetEndDate,
        ...metricsSummary(metrics),
        worstLate: metrics.overdueTasks
          .slice()
          .sort((a, b) => String(a.plannedEnd).localeCompare(String(b.plannedEnd)))
          .slice(0, 3)
          .map((task) => taskLine(task, today)),
        blockedTasks: metrics.blockedTasks.slice(0, 2).map((task) => taskLine(task, today)),
      })
    ),
    workload: portfolio.workload.slice(0, 8).map((entry) => compact({ ...entry })),
  };
}

export function buildProjectDigest(project, allTasks, sprints = [], today = todayIso()) {
  const tasks = allTasks.filter((task) => task.projectId === project.id);
  const metrics = computeProjectMetrics(project, allTasks, today);

  const upcoming = tasks
    .filter((task) => !isDoneStatus(task.status))
    .filter((task) => {
      const start = task.plannedStart || task.plannedEnd;
      const days = start ? daysBetween(today, start) : null;
      return days !== null && days >= 0 && days <= 14;
    })
    .sort((a, b) => String(a.plannedStart).localeCompare(String(b.plannedStart)))
    .slice(0, 10)
    .map((task) => taskLine(task, today, { starts: task.plannedStart }));

  const recentlyDone = tasks
    .filter((task) => isDoneStatus(task.status))
    .filter((task) => {
      const end = task.actualEnd || task.plannedEnd;
      const days = end ? daysBetween(end, today) : null;
      return days !== null && days >= 0 && days <= 14;
    })
    .slice(0, 10)
    .map((task) => compact({ task: short(task.title), owner: short(task.owner, 40), finished: task.actualEnd || task.plannedEnd }));

  const milestones = tasks
    .filter((task) => task.isMilestone)
    .slice(0, 8)
    .map((task) => compact({ milestone: short(task.title, 60), date: task.plannedStart || task.plannedEnd, status: task.status }));

  const currentSprint = sprints.find(
    (sprint) =>
      sprint.projectId === project.id &&
      sprint.startDate &&
      sprint.endDate &&
      sprint.startDate <= today &&
      sprint.endDate >= today
  );

  return {
    today,
    project: compact({
      name: short(project.name, 80),
      status: project.status,
      owner: short(project.owner, 40),
      start: project.startDate,
      target: project.targetEndDate,
      description: short(project.description, 240),
    }),
    metrics: metricsSummary(metrics),
    overdue: metrics.overdueTasks.slice(0, 10).map((task) => taskLine(task, today)),
    blocked: metrics.blockedTasks.slice(0, 8).map((task) => taskLine(task, today)),
    upcoming,
    recentlyDone,
    milestones,
    currentSprint: currentSprint
      ? compact({ name: short(currentSprint.name, 60), ends: currentSprint.endDate, goal: short(currentSprint.goal, 120) })
      : undefined,
    workload: computeWorkload(tasks, today).slice(0, 8),
  };
}

export function buildWeeklyReportInput(project, allTasks, sprints, previousReport, today = todayIso()) {
  const digest = buildProjectDigest(project, allTasks, sprints, today);
  return compact({
    ...digest,
    previousReport: previousReport
      ? compact({
          week: previousReport.reportingWeek,
          status: previousReport.overallStatus,
          summary: short(previousReport.executiveSummary, 400),
          plannedForThisWeek: short(previousReport.nextWeekPlan, 300),
        })
      : undefined,
  });
}

export function buildAskInput(question, { projects, tasks, sprints, projectId }) {
  const project = projectId ? projects.find((item) => item.id === projectId) : null;
  return {
    question: short(question, 600),
    scope: project ? "project" : "portfolio",
    data: project
      ? buildProjectDigest(project, tasks, sprints)
      : buildPortfolioDigest(projects, tasks),
  };
}

export function buildColumnMappingInput(headers, rows) {
  return {
    columns: headers.slice(0, 60).map((header) => ({
      name: short(header, 60),
      samples: rows
        .map((row) => row[header])
        .filter((value) => value !== undefined && value !== null && String(value).trim() !== "")
        .slice(0, 3)
        .map((value) => short(value, 40)),
    })),
  };
}
