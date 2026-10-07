// Builds the content of the portfolio slide deck from live data: one model
// for the banner, the summary cards and one slide per project. Pure, so it
// is unit-tested; slides only lay it out. No financial fields are used.

import { computePortfolio, computeProjectMetrics, daysBetween, todayIso } from "./analytics";
import { isDoneStatus } from "./vocabulary";

const MAX_ITEMS = 4;

/** Removes characters that are invalid in Office XML and tidies spacing. */
export function cleanSlideText(value, max = 400) {
  const text = String(value ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F￾￿]/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** "- a\n- b" or "a; b" → ["a", "b"] */
export function splitLines(value) {
  return String(value || "")
    .split(/\n|•/)
    .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, "").trim())
    .filter((line) => line && !/^(none|n\/a|na|nil|-|none identified)\.?$/i.test(line));
}

function unique(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (!item || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function shortDate(iso) {
  if (!iso) return "";
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export const formatDeckDate = shortDate;

function latestReport(projectId, weeklyReports) {
  return weeklyReports
    .filter((report) => report.projectId === projectId)
    .sort((a, b) => String(b.reportDate || b.updatedAt || "").localeCompare(String(a.reportDate || a.updatedAt || "")))[0];
}

const HEALTH = {
  good: { label: "On track", tone: "green" },
  risk: { label: "At risk", tone: "amber" },
  off: { label: "Off track", tone: "red" },
  done: { label: "Complete", tone: "blue" },
  empty: { label: "Not started", tone: "grey" },
};

function projectModel(project, tasks, weeklyReports, today) {
  const metrics = computeProjectMetrics(project, tasks, today);
  const projectTasks = tasks.filter((task) => task.projectId === project.id);
  const report = latestReport(project.id, weeklyReports);

  const recentlyDone = projectTasks
    .filter((task) => isDoneStatus(task.status) && !task.isSummaryTask)
    .map((task) => ({ task, end: task.actualEnd || task.plannedEnd }))
    .filter(({ end }) => end && daysBetween(end, today) !== null && daysBetween(end, today) >= 0 && daysBetween(end, today) <= 14)
    .sort((a, b) => String(b.end).localeCompare(String(a.end)))
    .map(({ task, end }) => `Completed ${task.title} (${shortDate(end)})`);

  const upcoming = projectTasks
    .filter((task) => !isDoneStatus(task.status) && !task.isSummaryTask)
    .map((task) => ({ task, date: task.plannedEnd || task.plannedStart }))
    .filter(({ date }) => date && date >= today && daysBetween(today, date) <= 21)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map(({ task, date }) => `${task.title}${task.owner ? ` (${task.owner})` : ""}, due ${shortDate(date)}`);

  const blocked = metrics.blockedTasks.map(
    (task) => `Blocked: ${task.title}${task.notes ? `. ${task.notes}` : ""}`
  );
  const late = metrics.overdueTasks
    .filter((task) => !metrics.blockedTasks.includes(task))
    .map((task) => {
      const end = task.plannedEnd || task.plannedStart;
      const days = end ? daysBetween(end, today) : null;
      return `${task.title} is ${days} day${days === 1 ? "" : "s"} late${task.owner ? ` (${task.owner})` : ""}`;
    });
  const unassigned = metrics.unassigned ? [`${metrics.unassigned} open task${metrics.unassigned === 1 ? " has" : "s have"} no owner`] : [];

  const milestones = projectTasks
    .filter((task) => task.isMilestone)
    .map((task) => ({ title: task.title, date: task.plannedStart || task.plannedEnd || "", done: isDoneStatus(task.status) }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const decisions = [];
  if (report?.decisionRequired === "Yes" && report.decisionDetails) {
    decisions.push(`Decision: ${report.decisionDetails}${report.decisionRequiredBy ? ` (by ${shortDate(report.decisionRequiredBy)})` : ""}`);
  }
  if (report?.escalationRequired === "Yes" && report.escalationDetails) decisions.push(`Escalation: ${report.escalationDetails}`);
  if (report?.supportNeeded) decisions.push(`Support needed: ${report.supportNeeded}`);

  const team = unique(projectTasks.map((task) => String(task.owner || "").trim()).filter(Boolean));
  const health = HEALTH[metrics.health.level] || HEALTH.empty;
  const clean = (list, max = MAX_ITEMS) => unique(list.map((item) => cleanSlideText(item, 160))).slice(0, max);

  return {
    id: project.id,
    name: cleanSlideText(project.name, 90) || "Untitled project",
    description: cleanSlideText(project.description, 220),
    owner: cleanSlideText(project.owner, 60),
    status: project.status || "Active",
    health: { ...health, reason: metrics.health.label },
    reportStatus: report?.overallStatus || "",
    reportDate: report?.reportDate || "",
    percentComplete: metrics.percentComplete,
    percentPlanned: metrics.percentPlanned,
    spi: metrics.spi,
    start: project.startDate || "",
    target: project.targetEndDate || metrics.latestPlannedEnd || "",
    forecast: metrics.forecastFinish || "",
    slipDays: metrics.slipDays,
    counts: {
      total: metrics.total,
      done: metrics.done,
      inProgress: metrics.inProgress,
      notStarted: metrics.notStarted,
      blocked: metrics.blocked,
      overdue: metrics.overdue,
    },
    statusLine: cleanSlideText(report?.executiveSummary || report?.currentStatus || "", 260),
    keyUpdates: clean([...recentlyDone, ...splitLines(report?.achievements)]),
    risks: clean([...blocked, ...late, ...splitLines(report?.risks), ...splitLines(report?.issues), ...unassigned]),
    nextSteps: clean([...splitLines(report?.nextWeekPlan), ...upcoming]),
    decisions: clean(decisions, 3),
    milestonesDone: milestones.filter((item) => item.done).slice(-2),
    milestonesUpcoming: milestones.filter((item) => !item.done).slice(0, 3),
    nextMilestone: milestones.find((item) => !item.done) || null,
    team: team.slice(0, 8),
  };
}

/**
 * Applies Claude's narrative (when requested) over the data-derived text.
 * Numbers, dates and health always come from the data, never from the AI.
 */
function applyNarrative(projectModels, narrative) {
  if (!narrative?.projects) return projectModels;
  const byKey = new Map(narrative.projects.map((item) => [item.key, item]));
  return projectModels.map((model, index) => {
    const ai = byKey.get(`p${index + 1}`);
    if (!ai) return model;
    const pick = (list, fallback, max = MAX_ITEMS) => {
      const cleaned = (Array.isArray(list) ? list : []).map((item) => cleanSlideText(item, 160)).filter(Boolean);
      return cleaned.length ? cleaned.slice(0, max) : fallback;
    };
    return {
      ...model,
      statusLine: cleanSlideText(ai.statusSummary, 260) || model.statusLine,
      keyUpdates: pick(ai.keyUpdates, model.keyUpdates),
      risks: pick(ai.risks, model.risks),
      nextSteps: pick(ai.nextSteps, model.nextSteps),
      decisions: pick(ai.decisionsNeeded, model.decisions, 3),
      aiWritten: true,
    };
  });
}

export function buildDeckModel({
  projects = [],
  tasks = [],
  weeklyReports = [],
  title = "",
  description = "",
  preparedBy = "",
  narrative = null,
  today = todayIso(),
} = {}) {
  const included = projects.filter((project) => project.status !== "Archived");
  const portfolio = computePortfolio(included, tasks, today);
  let models = included.map((project) => projectModel(project, tasks, weeklyReports, today));
  models = applyNarrative(models, narrative);

  const count = (tone) => models.filter((model) => model.health.tone === tone).length;
  const in30 = models.reduce(
    (sum, model) =>
      sum + model.milestonesUpcoming.filter((item) => item.date && item.date >= today && daysBetween(today, item.date) <= 30).length,
    0
  );

  return {
    today,
    dateLabel: shortDate(today),
    title: cleanSlideText(title, 80) || "Portfolio Status Report",
    description:
      cleanSlideText(description, 240) ||
      `Status, progress, risks and next steps for ${models.length} active project${models.length === 1 ? "" : "s"}.`,
    preparedBy: cleanSlideText(preparedBy, 60),
    headline: cleanSlideText(narrative?.headline, 200),
    summary: cleanSlideText(narrative?.summary, 420),
    kpis: [
      { label: "Active projects", value: String(models.length) },
      { label: "On track", value: String(count("green") + count("blue")), tone: "green" },
      { label: "At risk", value: String(count("amber")), tone: "amber" },
      { label: "Off track", value: String(count("red")), tone: "red" },
      { label: "Work complete", value: `${portfolio.percentDone}%` },
      { label: "Milestones in 30 days", value: String(in30) },
    ],
    projects: models,
  };
}

/** Compact input for Claude: one entry per project, keyed p1, p2... */
export function buildDeckAiInput(model) {
  return {
    today: model.today,
    projects: model.projects.slice(0, 20).map((project, index) => ({
      key: `p${index + 1}`,
      name: project.name,
      health: project.health.label,
      percentComplete: project.percentComplete,
      percentPlannedByToday: project.percentPlanned,
      target: project.target || undefined,
      forecast: project.forecast || undefined,
      slipDays: project.slipDays || undefined,
      counts: project.counts,
      nextMilestone: project.nextMilestone ? `${project.nextMilestone.title} (${project.nextMilestone.date || "no date"})` : undefined,
      lastReport: project.statusLine || undefined,
      facts: {
        updates: project.keyUpdates,
        risks: project.risks,
        upcoming: project.nextSteps,
        decisions: project.decisions,
      },
    })),
  };
}
