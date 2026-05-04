import pptxgen from "pptxgenjs";

const COLORS = {
  navy: "0F172A",
  blue: "2563EB",
  blueLight: "DBEAFE",
  green: "16A34A",
  greenLight: "DCFCE7",
  amber: "D97706",
  amberLight: "FEF3C7",
  red: "DC2626",
  redLight: "FEE2E2",
  slate: "475569",
  slate2: "64748B",
  border: "CBD5E1",
  softBorder: "E2E8F0",
  bg: "F8FAFC",
  white: "FFFFFF",
  card: "FFFFFF",
  muted: "F1F5F9",

  onTrackBg: "F0FDF4",
  atRiskBg: "FFFBEB",
  delayedBg: "FEF2F2",
  unknownBg: "EFF6FF",
};

function safeText(value, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function cleanText(value, fallback = "Not updated.") {
  if (value === null || value === undefined || String(value).trim() === "") {
    return fallback;
  }

  return String(value).trim();
}

function truncateText(value, maxLength = 220) {
  const text = cleanText(value, "");
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function formatDate(value) {
  if (!value) return "-";

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function getShapes(pptx) {
  return {
    rect: pptx.ShapeType?.rect || "rect",
    roundRect: pptx.ShapeType?.roundRect || "roundRect",
  };
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}

function getProjectTasks(projectId, tasks = []) {
  return tasks.filter((task) => task.projectId === projectId);
}

function getProjectSprints(projectId, sprints = []) {
  return sprints.filter((sprint) => sprint.projectId === projectId);
}

function getProjectDocuments(projectId, projectDocuments = []) {
  return projectDocuments.filter(
    (document) => document.projectId === projectId
  );
}

function getLatestProjectReport(projectId, weeklyReports = []) {
  return weeklyReports
    .filter((report) => report.projectId === projectId)
    .sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.submittedAt || a.reportDate || 0);
      const dateB = new Date(b.updatedAt || b.submittedAt || b.reportDate || 0);
      return dateB - dateA;
    })[0];
}

function getTaskStats(projectTasks = []) {
  const totalTasks = projectTasks.length;

  const completedTasks = projectTasks.filter((task) =>
    ["Completed", "Done", "Closed"].includes(task.status)
  ).length;

  const inProgressTasks = projectTasks.filter((task) =>
    ["In Progress", "Ongoing"].includes(task.status)
  ).length;

  const blockedTasks = projectTasks.filter((task) =>
    ["Blocked", "On Hold"].includes(task.status)
  ).length;

  const milestones = projectTasks.filter((task) => task.isMilestone).length;

  const totalActualProgress = projectTasks.reduce(
    (sum, task) => sum + Number(task.actualProgress || 0),
    0
  );

  const totalPlannedProgress = projectTasks.reduce(
    (sum, task) => sum + Number(task.plannedProgress || 0),
    0
  );

  const averageActualProgress =
    totalTasks > 0 ? Math.round(totalActualProgress / totalTasks) : 0;

  const averagePlannedProgress =
    totalTasks > 0 ? Math.round(totalPlannedProgress / totalTasks) : 0;

  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    blockedTasks,
    milestones,
    averageProgress: averageActualProgress,
    averageActualProgress,
    averagePlannedProgress,
  };
}

function getProgressMetrics(projectTasks, latestReport) {
  const stats = getTaskStats(projectTasks);

  const plannedProgress =
    latestReport?.plannedProgress !== undefined &&
    latestReport?.plannedProgress !== null &&
    latestReport?.plannedProgress !== ""
      ? clampPercent(latestReport.plannedProgress)
      : clampPercent(stats.averagePlannedProgress);

  const actualProgress =
    latestReport?.actualProgress !== undefined &&
    latestReport?.actualProgress !== null &&
    latestReport?.actualProgress !== ""
      ? clampPercent(latestReport.actualProgress)
      : clampPercent(stats.averageActualProgress);

  const gap = actualProgress - plannedProgress;

  return {
    plannedProgress,
    actualProgress,
    gap,
    gapLabel: gap >= 0 ? `+${gap}%` : `${gap}%`,
  };
}

function getHealthStyle({ latestReport, project, stats, progressMetrics }) {
  const rawStatus = String(
    latestReport?.overallStatus || project.status || ""
  ).toLowerCase();

  const gap = Number(progressMetrics.gap || 0);

  if (
    rawStatus.includes("red") ||
    rawStatus.includes("delayed") ||
    rawStatus.includes("blocked") ||
    gap <= -15
  ) {
    return {
      label: "Delayed",
      fill: COLORS.redLight,
      color: COLORS.red,
      accent: COLORS.red,
      background: COLORS.delayedBg,
      message:
        "Project needs attention due to delay, blockers, or progress gap.",
    };
  }

  if (
    rawStatus.includes("amber") ||
    rawStatus.includes("yellow") ||
    rawStatus.includes("risk") ||
    rawStatus.includes("at risk") ||
    stats.blockedTasks > 0 ||
    gap < 0
  ) {
    return {
      label: "At Risk",
      fill: COLORS.amberLight,
      color: COLORS.amber,
      accent: COLORS.amber,
      background: COLORS.atRiskBg,
      message:
        "Project has visible risk indicators and should be monitored closely.",
    };
  }

  if (
    rawStatus.includes("green") ||
    rawStatus.includes("active") ||
    rawStatus.includes("on track") ||
    gap >= 0
  ) {
    return {
      label: "On Track",
      fill: COLORS.greenLight,
      color: COLORS.green,
      accent: COLORS.green,
      background: COLORS.onTrackBg,
      message: "Project is moving as planned or ahead of planned progress.",
    };
  }

  return {
    label: "Not Updated",
    fill: COLORS.blueLight,
    color: COLORS.blue,
    accent: COLORS.blue,
    background: COLORS.unknownBg,
    message: "Project health has not been clearly updated.",
  };
}

function getStatusStyle(status = "") {
  const normalized = String(status).toLowerCase();

  if (
    normalized.includes("red") ||
    normalized.includes("blocked") ||
    normalized.includes("delayed")
  ) {
    return {
      fill: COLORS.redLight,
      color: COLORS.red,
      label: status || "Red",
    };
  }

  if (
    normalized.includes("amber") ||
    normalized.includes("yellow") ||
    normalized.includes("risk")
  ) {
    return {
      fill: COLORS.amberLight,
      color: COLORS.amber,
      label: status || "Amber",
    };
  }

  if (
    normalized.includes("green") ||
    normalized.includes("active") ||
    normalized.includes("on track")
  ) {
    return {
      fill: COLORS.greenLight,
      color: COLORS.green,
      label: status || "Green",
    };
  }

  return {
    fill: COLORS.blueLight,
    color: COLORS.blue,
    label: status || "Not Updated",
  };
}

function makeProjectStatusText(project, latestReport) {
  return (
    latestReport?.currentStatus ||
    latestReport?.executiveSummary ||
    latestReport?.overallHealthNotes ||
    project.description ||
    "Current project status has not been updated."
  );
}

function makeMajorMilestoneText(projectTasks, latestReport) {
  const completedMilestones = projectTasks
    .filter(
      (task) =>
        task.isMilestone &&
        ["Completed", "Done", "Closed"].includes(task.status)
    )
    .map((task) => task.title)
    .slice(0, 4)
    .join(", ");

  return (
    latestReport?.majorMilestoneAchieved ||
    latestReport?.milestonesCompleted ||
    completedMilestones ||
    "No completed milestone has been updated."
  );
}

function makeUpcomingMilestoneText(projectTasks, latestReport) {
  const upcomingMilestones = projectTasks
    .filter(
      (task) =>
        task.isMilestone &&
        !["Completed", "Done", "Closed"].includes(task.status)
    )
    .map((task) => task.title)
    .slice(0, 4)
    .join(", ");

  return (
    latestReport?.upcomingMilestone ||
    latestReport?.milestonesNextWeek ||
    upcomingMilestones ||
    "No upcoming milestone has been updated."
  );
}

function makeIssuesText(latestReport) {
  return (
    latestReport?.outstandingIssuesJustification ||
    latestReport?.issues ||
    "No outstanding issues have been reported."
  );
}

function makeRiskText(latestReport) {
  return (
    latestReport?.potentialRisk ||
    latestReport?.risks ||
    "No major potential risk has been reported."
  );
}

function makeChallengesText(latestReport) {
  return (
    latestReport?.challengesFaced ||
    latestReport?.supportNeeded ||
    "No team challenges have been updated."
  );
}

function makeAchievementsText(latestReport) {
  return latestReport?.achievements || "No achievements have been updated.";
}

function makeTeamText(project, latestReport, projectTasks) {
  if (latestReport?.teamMembers) return latestReport.teamMembers;

  const owners = Array.from(
    new Set(
      projectTasks
        .map((task) => task.owner)
        .filter(Boolean)
        .map((owner) => owner.trim())
    )
  );

  if (owners.length > 0) return owners.slice(0, 8).join(", ");

  return project.owner || "Team members have not been updated.";
}

function getProjectHealthDetails(project, tasks, sprints, weeklyReports) {
  const projectTasks = getProjectTasks(project.id, tasks);
  const projectSprints = getProjectSprints(project.id, sprints);
  const latestReport = getLatestProjectReport(project.id, weeklyReports);
  const stats = getTaskStats(projectTasks);
  const progressMetrics = getProgressMetrics(projectTasks, latestReport);
  const health = getHealthStyle({
    latestReport,
    project,
    stats,
    progressMetrics,
  });

  return {
    project,
    projectTasks,
    projectSprints,
    latestReport,
    stats,
    progressMetrics,
    health,
  };
}

function getPortfolioHealthData(projects, tasks, sprints, weeklyReports) {
  const activeProjects = projects.filter(
    (project) => project.status !== "Archived"
  );

  const projectDetails = activeProjects.map((project) =>
    getProjectHealthDetails(project, tasks, sprints, weeklyReports)
  );

  const onTrack = projectDetails.filter(
    (item) => item.health.label === "On Track"
  ).length;

  const atRisk = projectDetails.filter(
    (item) => item.health.label === "At Risk"
  ).length;

  const delayed = projectDetails.filter(
    (item) => item.health.label === "Delayed"
  ).length;

  const notUpdated = projectDetails.filter(
    (item) => item.health.label === "Not Updated"
  ).length;

  const plannedTotal = projectDetails.reduce(
    (sum, item) => sum + item.progressMetrics.plannedProgress,
    0
  );

  const actualTotal = projectDetails.reduce(
    (sum, item) => sum + item.progressMetrics.actualProgress,
    0
  );

  const plannedAverage =
    projectDetails.length > 0
      ? Math.round(plannedTotal / projectDetails.length)
      : 0;

  const actualAverage =
    projectDetails.length > 0
      ? Math.round(actualTotal / projectDetails.length)
      : 0;

  return {
    activeProjects,
    projectDetails,
    onTrack,
    atRisk,
    delayed,
    notUpdated,
    plannedAverage,
    actualAverage,
    gap: actualAverage - plannedAverage,
    gapLabel:
      actualAverage - plannedAverage >= 0
        ? `+${actualAverage - plannedAverage}%`
        : `${actualAverage - plannedAverage}%`,
  };
}

function addFooter(slide, text) {
  slide.addText(text, {
    x: 0.5,
    y: 7.05,
    w: 12.25,
    h: 0.25,
    fontSize: 7.2,
    color: COLORS.slate2,
    align: "right",
    fit: "shrink",
  });
}

function addSlideHeader(
  slide,
  shapes,
  title,
  subtitle = "",
  section = "",
  background = COLORS.bg
) {
  slide.background = { color: background };

  slide.addShape(shapes.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.18,
    fill: { color: COLORS.navy },
    line: { color: COLORS.navy },
  });

  slide.addText(section || "CENTRALIZED REPORT", {
    x: 0.55,
    y: 0.36,
    w: 3.5,
    h: 0.22,
    fontSize: 7.4,
    bold: true,
    color: COLORS.blue,
    charSpace: 1.2,
    fit: "shrink",
  });

  slide.addText(title, {
    x: 0.55,
    y: 0.62,
    w: 8.8,
    h: 0.42,
    fontSize: 22,
    bold: true,
    color: COLORS.navy,
    fit: "shrink",
  });

  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.57,
      y: 1.08,
      w: 10.8,
      h: 0.25,
      fontSize: 9.2,
      color: COLORS.slate,
      fit: "shrink",
    });
  }

  slide.addText(formatDate(new Date()), {
    x: 10.55,
    y: 0.55,
    w: 2.15,
    h: 0.24,
    fontSize: 8.5,
    color: COLORS.slate,
    align: "right",
    fit: "shrink",
  });
}

function addMetricCard(
  slide,
  shapes,
  label,
  value,
  x,
  y,
  w,
  h,
  color = COLORS.blue
) {
  slide.addShape(shapes.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: COLORS.card },
    line: { color: COLORS.softBorder, width: 1 },
  });

  slide.addShape(shapes.rect, {
    x: x + 0.14,
    y: y + 0.14,
    w: 0.12,
    h: h - 0.28,
    fill: { color },
    line: { color },
  });

  slide.addText(String(value), {
    x: x + 0.35,
    y: y + 0.14,
    w: w - 0.48,
    h: 0.3,
    fontSize: 15,
    bold: true,
    color: COLORS.navy,
    fit: "shrink",
  });

  slide.addText(label, {
    x: x + 0.35,
    y: y + 0.5,
    w: w - 0.48,
    h: 0.18,
    fontSize: 6.8,
    color: COLORS.slate,
    fit: "shrink",
  });
}

function addStatusChip(slide, shapes, status, x, y, w = 1.25) {
  const style = getStatusStyle(status);

  slide.addShape(shapes.roundRect, {
    x,
    y,
    w,
    h: 0.34,
    rectRadius: 0.08,
    fill: { color: style.fill },
    line: { color: style.fill },
  });

  slide.addText(style.label, {
    x: x + 0.06,
    y: y + 0.08,
    w: w - 0.12,
    h: 0.18,
    fontSize: 7.4,
    bold: true,
    color: style.color,
    align: "center",
    fit: "shrink",
  });
}

function addHealthChip(slide, shapes, health, x, y, w = 1.45) {
  slide.addShape(shapes.roundRect, {
    x,
    y,
    w,
    h: 0.34,
    rectRadius: 0.08,
    fill: { color: health.fill },
    line: { color: health.fill },
  });

  slide.addText(health.label, {
    x: x + 0.06,
    y: y + 0.08,
    w: w - 0.12,
    h: 0.18,
    fontSize: 7.6,
    bold: true,
    color: health.color,
    align: "center",
    fit: "shrink",
  });
}

function addProgressBar(slide, shapes, percentage, x, y, w, h, color) {
  const safePercent = clampPercent(percentage);
  const filledWidth = (w * safePercent) / 100;
  const barColor =
    color ||
    (safePercent >= 75
      ? COLORS.green
      : safePercent >= 40
      ? COLORS.blue
      : COLORS.amber);

  slide.addShape(shapes.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.04,
    fill: { color: COLORS.muted },
    line: { color: COLORS.muted },
  });

  if (filledWidth > 0) {
    slide.addShape(shapes.roundRect, {
      x,
      y,
      w: filledWidth,
      h,
      rectRadius: 0.04,
      fill: { color: barColor },
      line: { color: barColor },
    });
  }

  slide.addText(`${safePercent}%`, {
    x: x + w + 0.08,
    y: y - 0.04,
    w: 0.55,
    h: 0.2,
    fontSize: 7,
    bold: true,
    color: COLORS.navy,
    fit: "shrink",
  });
}

function addProgressComparisonCard(
  slide,
  shapes,
  progressMetrics,
  health,
  x,
  y,
  w,
  h
) {
  slide.addShape(shapes.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: COLORS.white },
    line: { color: COLORS.softBorder, width: 1 },
  });

  slide.addShape(shapes.rect, {
    x,
    y,
    w: 0.08,
    h,
    fill: { color: health.accent },
    line: { color: health.accent },
  });

  slide.addText("Actual vs Planned Progress", {
    x: x + 0.22,
    y: y + 0.13,
    w: 3.2,
    h: 0.22,
    fontSize: 8.8,
    bold: true,
    color: COLORS.navy,
    fit: "shrink",
  });

  addHealthChip(slide, shapes, health, x + w - 1.72, y + 0.1, 1.42);

  slide.addText("Planned", {
    x: x + 0.24,
    y: y + 0.53,
    w: 0.75,
    h: 0.18,
    fontSize: 6.8,
    bold: true,
    color: COLORS.slate,
    fit: "shrink",
  });

  addProgressBar(
    slide,
    shapes,
    progressMetrics.plannedProgress,
    x + 1.05,
    y + 0.58,
    w - 2.25,
    0.09,
    COLORS.blue
  );

  slide.addText("Actual", {
    x: x + 0.24,
    y: y + 0.83,
    w: 0.75,
    h: 0.18,
    fontSize: 6.8,
    bold: true,
    color: COLORS.slate,
    fit: "shrink",
  });

  addProgressBar(
    slide,
    shapes,
    progressMetrics.actualProgress,
    x + 1.05,
    y + 0.88,
    w - 2.25,
    0.09,
    health.accent
  );

  slide.addShape(shapes.roundRect, {
    x: x + 0.24,
    y: y + 1.13,
    w: 1.6,
    h: 0.32,
    rectRadius: 0.08,
    fill: { color: health.fill },
    line: { color: health.fill },
  });

  slide.addText(`Gap: ${progressMetrics.gapLabel}`, {
    x: x + 0.3,
    y: y + 1.2,
    w: 1.48,
    h: 0.18,
    fontSize: 7.2,
    bold: true,
    color: health.color,
    align: "center",
    fit: "shrink",
  });

  slide.addText(health.message, {
    x: x + 2.05,
    y: y + 1.18,
    w: w - 2.35,
    h: 0.22,
    fontSize: 6.8,
    color: COLORS.slate,
    fit: "shrink",
  });
}

function addSectionCard(
  slide,
  shapes,
  title,
  body,
  x,
  y,
  w,
  h,
  accent = COLORS.blue
) {
  slide.addShape(shapes.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: COLORS.card },
    line: { color: COLORS.softBorder, width: 1 },
  });

  slide.addShape(shapes.rect, {
    x,
    y,
    w: 0.07,
    h,
    fill: { color: accent },
    line: { color: accent },
  });

  slide.addText(title, {
    x: x + 0.18,
    y: y + 0.12,
    w: w - 0.32,
    h: 0.22,
    fontSize: 7.6,
    bold: true,
    color: COLORS.navy,
    fit: "shrink",
  });

  slide.addText(truncateText(body, 220), {
    x: x + 0.18,
    y: y + 0.42,
    w: w - 0.32,
    h: Math.max(0.2, h - 0.5),
    fontSize: 6.5,
    color: COLORS.slate,
    valign: "top",
    fit: "shrink",
    breakLine: false,
  });
}

function addCoverSlide(pptx, shapes, projects, tasks, weeklyReports) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.bg };

  const activeProjects = projects.filter(
    (project) => project.status !== "Archived"
  );

  const completedTasks = tasks.filter((task) =>
    ["Completed", "Done", "Closed"].includes(task.status)
  ).length;

  const totalTasks = tasks.length;
  const progress =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const generatedDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  slide.addShape(shapes.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color: COLORS.bg },
    line: { color: COLORS.bg },
  });

  slide.addShape(shapes.rect, {
    x: 0,
    y: 0,
    w: 4.15,
    h: 7.5,
    fill: { color: COLORS.navy },
    line: { color: COLORS.navy },
  });

  slide.addShape(shapes.roundRect, {
    x: 0.58,
    y: 0.75,
    w: 2.2,
    h: 0.36,
    rectRadius: 0.08,
    fill: { color: COLORS.blue },
    line: { color: COLORS.blue },
  });

  slide.addText("MANAGER REPORT", {
    x: 0.72,
    y: 0.84,
    w: 1.95,
    h: 0.18,
    fontSize: 7,
    bold: true,
    color: COLORS.white,
    align: "center",
    charSpace: 1,
    fit: "shrink",
  });

  slide.addText("Centralized\nProjects\nReport", {
    x: 0.6,
    y: 1.55,
    w: 3.0,
    h: 1.55,
    fontSize: 30,
    bold: true,
    color: COLORS.white,
    breakLine: false,
    fit: "shrink",
  });

  slide.addText(
    "Combined view of project progress, actual vs planned, POC updates, proposal status and documentation readiness.",
    {
      x: 0.64,
      y: 3.42,
      w: 2.92,
      h: 0.75,
      fontSize: 10,
      color: "CBD5E1",
      fit: "shrink",
    }
  );

  slide.addText(`Generated on ${generatedDate}`, {
    x: 0.64,
    y: 6.55,
    w: 2.9,
    h: 0.25,
    fontSize: 8.5,
    color: "CBD5E1",
    fit: "shrink",
  });

  slide.addText("Portfolio Snapshot", {
    x: 4.75,
    y: 0.72,
    w: 7.5,
    h: 0.45,
    fontSize: 24,
    bold: true,
    color: COLORS.navy,
    fit: "shrink",
  });

  slide.addText(
    "A clean management-level summary of all active project streams.",
    {
      x: 4.78,
      y: 1.24,
      w: 7.6,
      h: 0.26,
      fontSize: 10.2,
      color: COLORS.slate,
      fit: "shrink",
    }
  );

  addMetricCard(
    slide,
    shapes,
    "Live Projects",
    activeProjects.length,
    4.78,
    1.9,
    1.85,
    0.9,
    COLORS.blue
  );

  addMetricCard(
    slide,
    shapes,
    "Total Tasks",
    totalTasks,
    6.9,
    1.9,
    1.85,
    0.9,
    COLORS.green
  );

  addMetricCard(
    slide,
    shapes,
    "Completed",
    completedTasks,
    9.02,
    1.9,
    1.85,
    0.9,
    COLORS.amber
  );

  addMetricCard(
    slide,
    shapes,
    "Reports",
    weeklyReports.length,
    11.14,
    1.9,
    1.85,
    0.9,
    COLORS.red
  );

  slide.addShape(shapes.roundRect, {
    x: 4.78,
    y: 3.25,
    w: 8.18,
    h: 1.05,
    rectRadius: 0.08,
    fill: { color: COLORS.card },
    line: { color: COLORS.softBorder },
  });

  slide.addText("Overall Task Completion", {
    x: 5.05,
    y: 3.5,
    w: 3.2,
    h: 0.22,
    fontSize: 9.2,
    bold: true,
    color: COLORS.navy,
    fit: "shrink",
  });

  addProgressBar(slide, shapes, progress, 5.05, 3.9, 6.6, 0.12);

  slide.addText("Report Coverage", {
    x: 4.82,
    y: 4.78,
    w: 2.2,
    h: 0.25,
    fontSize: 11,
    bold: true,
    color: COLORS.navy,
    fit: "shrink",
  });

  slide.addText(
    "This deck provides a project-wise view with actual vs planned progress, schedule health, milestones, risks, issues, achievements, team notes, POC stages, proposal updates and document readiness.",
    {
      x: 4.82,
      y: 5.15,
      w: 7.9,
      h: 0.85,
      fontSize: 10,
      color: COLORS.slate,
      fit: "shrink",
    }
  );

  addFooter(slide, "Slide 1 | Cover");
}

function addExecutiveSummarySlide(pptx, shapes, portfolioData) {
  const slide = pptx.addSlide();

  addSlideHeader(
    slide,
    shapes,
    "Executive Summary",
    "Portfolio-level health summary with planned progress, actual progress and overall gap.",
    "EXECUTIVE SUMMARY",
    COLORS.bg
  );

  const gapColor =
    portfolioData.gap >= 0
      ? COLORS.green
      : portfolioData.gap <= -15
      ? COLORS.red
      : COLORS.amber;

  addMetricCard(
    slide,
    shapes,
    "Active Projects",
    portfolioData.activeProjects.length,
    0.55,
    1.55,
    2.1,
    0.85,
    COLORS.blue
  );

  addMetricCard(
    slide,
    shapes,
    "On Track",
    portfolioData.onTrack,
    2.9,
    1.55,
    2.1,
    0.85,
    COLORS.green
  );

  addMetricCard(
    slide,
    shapes,
    "At Risk",
    portfolioData.atRisk,
    5.25,
    1.55,
    2.1,
    0.85,
    COLORS.amber
  );

  addMetricCard(
    slide,
    shapes,
    "Delayed",
    portfolioData.delayed,
    7.6,
    1.55,
    2.1,
    0.85,
    COLORS.red
  );

  addMetricCard(
    slide,
    shapes,
    "Overall Gap",
    portfolioData.gapLabel,
    9.95,
    1.55,
    2.1,
    0.85,
    gapColor
  );

  slide.addShape(shapes.roundRect, {
    x: 0.55,
    y: 2.75,
    w: 12.25,
    h: 1.55,
    rectRadius: 0.08,
    fill: { color: COLORS.white },
    line: { color: COLORS.softBorder },
  });

  slide.addText("Portfolio Actual vs Planned", {
    x: 0.85,
    y: 3.0,
    w: 3.2,
    h: 0.22,
    fontSize: 10,
    bold: true,
    color: COLORS.navy,
    fit: "shrink",
  });

  slide.addText("Planned", {
    x: 0.85,
    y: 3.45,
    w: 0.8,
    h: 0.18,
    fontSize: 7.2,
    bold: true,
    color: COLORS.slate,
    fit: "shrink",
  });

  addProgressBar(
    slide,
    shapes,
    portfolioData.plannedAverage,
    1.75,
    3.5,
    9.6,
    0.1,
    COLORS.blue
  );

  slide.addText("Actual", {
    x: 0.85,
    y: 3.8,
    w: 0.8,
    h: 0.18,
    fontSize: 7.2,
    bold: true,
    color: COLORS.slate,
    fit: "shrink",
  });

  addProgressBar(
    slide,
    shapes,
    portfolioData.actualAverage,
    1.75,
    3.85,
    9.6,
    0.1,
    gapColor
  );

  addSectionCard(
    slide,
    shapes,
    "Management View",
    `Across ${portfolioData.activeProjects.length} active projects, ${portfolioData.onTrack} are on track, ${portfolioData.atRisk} are at risk, and ${portfolioData.delayed} are delayed. Overall actual progress is ${portfolioData.actualAverage}% against planned progress of ${portfolioData.plannedAverage}%.`,
    0.55,
    4.75,
    5.95,
    1.15,
    COLORS.blue
  );

  addSectionCard(
    slide,
    shapes,
    "Immediate Focus",
    portfolioData.atRisk + portfolioData.delayed > 0
      ? "Review projects marked as At Risk or Delayed. Validate blockers, support needed, revised timelines and next actions."
      : "No major portfolio risk is visible from the available project data. Continue monitoring progress and weekly updates.",
    6.85,
    4.75,
    5.95,
    1.15,
    portfolioData.atRisk + portfolioData.delayed > 0 ? COLORS.red : COLORS.green
  );

  addFooter(slide, "Slide 2 | Executive Summary");
}

function addProjectHealthMatrixSlide(pptx, shapes, portfolioData) {
  const slide = pptx.addSlide();

  addSlideHeader(
    slide,
    shapes,
    "Project Health Matrix",
    "Compact comparison of planned progress, actual progress, gap, health and next milestone.",
    "PORTFOLIO MATRIX",
    COLORS.bg
  );

  const rows = [
    [
      { text: "Project", options: { bold: true } },
      { text: "Owner", options: { bold: true } },
      { text: "Planned", options: { bold: true } },
      { text: "Actual", options: { bold: true } },
      { text: "Gap", options: { bold: true } },
      { text: "Health", options: { bold: true } },
      { text: "Next Milestone", options: { bold: true } },
    ],
    ...portfolioData.projectDetails.slice(0, 13).map((item) => [
      safeText(item.project.name),
      safeText(item.project.owner),
      `${item.progressMetrics.plannedProgress}%`,
      `${item.progressMetrics.actualProgress}%`,
      item.progressMetrics.gapLabel,
      item.health.label,
      truncateText(makeUpcomingMilestoneText(item.projectTasks, item.latestReport), 80),
    ]),
  ];

  slide.addTable(rows, {
    x: 0.55,
    y: 1.55,
    w: 12.25,
    h: 5.2,
    border: { type: "solid", color: COLORS.border, pt: 0.5 },
    fill: { color: COLORS.white },
    color: COLORS.navy,
    fontSize: 7.1,
    valign: "mid",
    fit: "shrink",
    margin: 0.05,
    autoFit: false,
    colW: [2.5, 1.45, 1.05, 1.05, 0.85, 1.2, 4.15],
    rowH: 0.34,
  });

  addFooter(slide, "Slide 3 | Project Health Matrix");
}

function addAttentionRequiredSlide(pptx, shapes, portfolioData) {
  const slide = pptx.addSlide();

  addSlideHeader(
    slide,
    shapes,
    "At Risk / Delayed Projects",
    "Focused view of projects that may need review, intervention or additional support.",
    "ATTENTION REQUIRED",
    COLORS.bg
  );

  const attentionProjects = portfolioData.projectDetails.filter(
    (item) => item.health.label === "At Risk" || item.health.label === "Delayed"
  );

  if (attentionProjects.length === 0) {
    addSectionCard(
      slide,
      shapes,
      "No Immediate Attention Required",
      "No active project is currently marked as At Risk or Delayed based on the available planned vs actual progress, blockers and status updates.",
      0.9,
      2.4,
      11.5,
      1.4,
      COLORS.green
    );

    addFooter(slide, "Slide 4 | Attention Required");
    return;
  }

  const rows = [
    [
      { text: "Project", options: { bold: true } },
      { text: "Health", options: { bold: true } },
      { text: "Gap", options: { bold: true } },
      { text: "Blocked", options: { bold: true } },
      { text: "Reason / Risk", options: { bold: true } },
      { text: "Next Action", options: { bold: true } },
    ],
    ...attentionProjects.slice(0, 10).map((item) => [
      safeText(item.project.name),
      item.health.label,
      item.progressMetrics.gapLabel,
      String(item.stats.blockedTasks),
      truncateText(makeRiskText(item.latestReport), 90),
      truncateText(
        item.latestReport?.nextWeekPlan ||
          item.latestReport?.supportNeeded ||
          "Review project plan and confirm recovery action.",
        100
      ),
    ]),
  ];

  slide.addTable(rows, {
    x: 0.55,
    y: 1.55,
    w: 12.25,
    h: 5.1,
    border: { type: "solid", color: COLORS.border, pt: 0.5 },
    fill: { color: COLORS.white },
    color: COLORS.navy,
    fontSize: 7.1,
    valign: "mid",
    fit: "shrink",
    margin: 0.05,
    autoFit: false,
    colW: [2.2, 1.1, 0.85, 0.8, 3.55, 3.75],
    rowH: 0.36,
  });

  addFooter(slide, "Slide 4 | Attention Required");
}

function addLiveProjectsSlide(pptx, shapes, projects) {
  const slide = pptx.addSlide();

  addSlideHeader(
    slide,
    shapes,
    "Live Projects Overview",
    "Active projects with owner, status, planned start and target completion dates.",
    "PORTFOLIO",
    COLORS.bg
  );

  const activeProjects = projects.filter(
    (project) => project.status !== "Archived"
  );

  addMetricCard(
    slide,
    shapes,
    "Active Projects",
    activeProjects.length,
    0.55,
    1.55,
    2.15,
    0.85,
    COLORS.blue
  );

  addMetricCard(
    slide,
    shapes,
    "Archived",
    projects.length - activeProjects.length,
    2.95,
    1.55,
    2.15,
    0.85,
    COLORS.slate
  );

  addMetricCard(
    slide,
    shapes,
    "Total Portfolio",
    projects.length,
    5.35,
    1.55,
    2.15,
    0.85,
    COLORS.green
  );

  const rows = [
    [
      { text: "Project", options: { bold: true } },
      { text: "Owner", options: { bold: true } },
      { text: "Status", options: { bold: true } },
      { text: "Start", options: { bold: true } },
      { text: "Target End", options: { bold: true } },
    ],
    ...activeProjects.map((project) => [
      safeText(project.name),
      safeText(project.owner),
      safeText(project.status),
      formatDate(project.startDate),
      formatDate(project.targetEndDate),
    ]),
  ];

  slide.addTable(rows, {
    x: 0.55,
    y: 2.72,
    w: 12.25,
    h: 3.92,
    border: { type: "solid", color: COLORS.border, pt: 0.5 },
    fill: { color: COLORS.white },
    color: COLORS.navy,
    fontSize: 8,
    valign: "mid",
    fit: "shrink",
    margin: 0.07,
    autoFit: false,
    colW: [4.0, 2.0, 1.7, 2.0, 2.55],
    rowH: 0.34,
  });

  addFooter(slide, "Slide 5 | Live Projects Overview");
}

function addProjectUpdateSlide({
  pptx,
  shapes,
  project,
  projectIndex,
  totalProjects,
  tasks,
  sprints,
  weeklyReports,
}) {
  const projectTasks = getProjectTasks(project.id, tasks);
  const projectSprints = getProjectSprints(project.id, sprints);
  const latestReport = getLatestProjectReport(project.id, weeklyReports);
  const stats = getTaskStats(projectTasks);
  const progressMetrics = getProgressMetrics(projectTasks, latestReport);

  const health = getHealthStyle({
    latestReport,
    project,
    stats,
    progressMetrics,
  });

  const slide = pptx.addSlide();

  addSlideHeader(
    slide,
    shapes,
    project.name || `Project ${projectIndex + 1}`,
    `Owner: ${safeText(project.owner)} | Start: ${formatDate(
      project.startDate
    )} | Target End: ${formatDate(project.targetEndDate)}`,
    `PROJECT ${projectIndex + 1} OF ${totalProjects}`,
    health.background
  );

  slide.addShape(shapes.roundRect, {
    x: 9.1,
    y: 0.52,
    w: 3.65,
    h: 0.42,
    rectRadius: 0.08,
    fill: { color: COLORS.white },
    line: { color: COLORS.softBorder },
  });

  slide.addText("Health", {
    x: 9.26,
    y: 0.65,
    w: 0.58,
    h: 0.16,
    fontSize: 6.8,
    bold: true,
    color: COLORS.slate,
    align: "center",
    fit: "shrink",
  });

  addHealthChip(slide, shapes, health, 10.05, 0.56, 1.25);

  addStatusChip(
    slide,
    shapes,
    latestReport?.overallStatus || project.status || "Not Updated",
    11.45,
    0.56,
    1.15
  );

  addMetricCard(slide, shapes, "Tasks", stats.totalTasks, 0.55, 1.5, 1.45, 0.72, COLORS.blue);
  addMetricCard(slide, shapes, "Completed", stats.completedTasks, 2.15, 1.5, 1.45, 0.72, COLORS.green);
  addMetricCard(slide, shapes, "In Progress", stats.inProgressTasks, 3.75, 1.5, 1.45, 0.72, COLORS.amber);
  addMetricCard(slide, shapes, "Blocked", stats.blockedTasks, 5.35, 1.5, 1.45, 0.72, COLORS.red);
  addMetricCard(slide, shapes, "Sprints", projectSprints.length, 6.95, 1.5, 1.45, 0.72, COLORS.blue);
  addMetricCard(slide, shapes, "Milestones", stats.milestones, 8.55, 1.5, 1.45, 0.72, COLORS.green);
  addMetricCard(slide, shapes, "Gap", progressMetrics.gapLabel, 10.15, 1.5, 1.45, 0.72, health.accent);

  addProgressComparisonCard(
    slide,
    shapes,
    progressMetrics,
    health,
    0.55,
    2.45,
    12.25,
    1.48
  );

  addSectionCard(slide, shapes, "Current Status", makeProjectStatusText(project, latestReport), 0.55, 4.15, 3.0, 0.78, health.accent);
  addSectionCard(slide, shapes, "Major Milestone Achieved", makeMajorMilestoneText(projectTasks, latestReport), 3.75, 4.15, 3.0, 0.78, COLORS.green);
  addSectionCard(slide, shapes, "Upcoming Milestone", makeUpcomingMilestoneText(projectTasks, latestReport), 6.95, 4.15, 3.0, 0.78, COLORS.amber);
  addSectionCard(slide, shapes, "Potential Risk", makeRiskText(latestReport), 10.15, 4.15, 2.65, 0.78, COLORS.red);

  addSectionCard(slide, shapes, "Outstanding Issues with Justification", makeIssuesText(latestReport), 0.55, 5.15, 4.0, 0.85, COLORS.red);
  addSectionCard(slide, shapes, "Challenges Faced by Team", makeChallengesText(latestReport), 4.75, 5.15, 4.0, 0.85, COLORS.amber);
  addSectionCard(slide, shapes, "Achievements", makeAchievementsText(latestReport), 8.95, 5.15, 3.85, 0.85, COLORS.green);

  addSectionCard(slide, shapes, "Team Members", makeTeamText(project, latestReport, projectTasks), 0.55, 6.1, 4.0, 0.72, COLORS.blue);
  addSectionCard(slide, shapes, "Next Steps", latestReport?.nextWeekPlan || "Next steps have not been updated.", 4.75, 6.1, 4.0, 0.72, COLORS.navy);
  addSectionCard(slide, shapes, "Manager Remarks", latestReport?.pmRemarks || latestReport?.leadershipMessage || "No manager remarks available.", 8.95, 6.1, 3.85, 0.72, COLORS.slate);

  addFooter(
    slide,
    `Project ${projectIndex + 1} of ${totalProjects} | ${health.label}`
  );
}

function addPocSlide(pptx, shapes, projects, weeklyReports) {
  const slide = pptx.addSlide();

  addSlideHeader(
    slide,
    shapes,
    "Proof of Concept Updates",
    "Stage-wise consolidated progress for POC scope, development, demos, feedback and next steps.",
    "POC TRACKER",
    COLORS.bg
  );

  const pocFields = [
    {
      title: "Scope & Acceptance",
      key: "pocScopeAcceptanceStatus",
      accent: COLORS.blue,
    },
    {
      title: "Development",
      key: "pocDevelopmentStatus",
      accent: COLORS.green,
    },
    {
      title: "Internal Demo",
      key: "pocInternalDemoStatus",
      accent: COLORS.amber,
    },
    {
      title: "Final Demo",
      key: "pocFinalDemoStatus",
      accent: COLORS.red,
    },
    {
      title: "Next Steps",
      key: "pocNextSteps",
      accent: COLORS.navy,
    },
  ];

  const activeProjects = projects.filter(
    (project) => project.status !== "Archived"
  );

  pocFields.forEach((field, index) => {
    const x = 0.75 + index * 2.48;

    slide.addShape(shapes.roundRect, {
      x,
      y: 1.6,
      w: 2.05,
      h: 0.48,
      rectRadius: 0.08,
      fill: { color: field.accent },
      line: { color: field.accent },
    });

    slide.addText(field.title, {
      x: x + 0.1,
      y: 1.73,
      w: 1.85,
      h: 0.2,
      fontSize: 7.8,
      bold: true,
      color: COLORS.white,
      align: "center",
      fit: "shrink",
    });

    if (index < pocFields.length - 1) {
      slide.addText(">", {
        x: x + 2.1,
        y: 1.72,
        w: 0.32,
        h: 0.2,
        fontSize: 12,
        bold: true,
        color: COLORS.slate2,
        align: "center",
        fit: "shrink",
      });
    }
  });

  pocFields.forEach((field, index) => {
    const x = index % 2 === 0 ? 0.55 : 6.9;
    const y = index < 2 ? 2.55 : index < 4 ? 4.0 : 5.45;
    const w = index === 4 ? 12.25 : 5.9;
    const h = index === 4 ? 1.0 : 1.05;

    const projectUpdates = activeProjects
      .map((project) => {
        const report = getLatestProjectReport(project.id, weeklyReports);
        const value = report?.[field.key];

        if (!value) return null;

        return `${project.name}: ${value}`;
      })
      .filter(Boolean)
      .join("\n");

    addSectionCard(
      slide,
      shapes,
      field.title,
      projectUpdates || "No project-level POC update has been added yet.",
      x,
      y,
      w,
      h,
      field.accent
    );
  });

  addFooter(slide, "POC Consolidated Update");
}

function addProposalDocumentationSlide(
  pptx,
  shapes,
  projects,
  weeklyReports,
  projectDocuments
) {
  const slide = pptx.addSlide();

  addSlideHeader(
    slide,
    shapes,
    "Proposals & Documentation Update",
    "Project-wise proposal status, documentation status and documents added to the tool.",
    "DOCUMENTATION",
    COLORS.bg
  );

  const activeProjects = projects.filter(
    (project) => project.status !== "Archived"
  );

  const proposalUpdated = activeProjects.filter((project) => {
    const report = getLatestProjectReport(project.id, weeklyReports);
    return Boolean(report?.proposalStatus);
  }).length;

  const documentationUpdated = activeProjects.filter((project) => {
    const report = getLatestProjectReport(project.id, weeklyReports);
    return Boolean(report?.documentationStatus);
  }).length;

  addMetricCard(slide, shapes, "Projects", activeProjects.length, 0.55, 1.52, 2.1, 0.78, COLORS.blue);
  addMetricCard(slide, shapes, "Proposal Updates", proposalUpdated, 2.9, 1.52, 2.1, 0.78, COLORS.green);
  addMetricCard(slide, shapes, "Documentation Updates", documentationUpdated, 5.25, 1.52, 2.1, 0.78, COLORS.amber);
  addMetricCard(slide, shapes, "Documents Added", projectDocuments.length, 7.6, 1.52, 2.1, 0.78, COLORS.navy);

  const rows = [
    [
      { text: "Project", options: { bold: true } },
      { text: "Proposal Status", options: { bold: true } },
      { text: "Documentation Status", options: { bold: true } },
      { text: "Documents Added", options: { bold: true } },
      { text: "Latest Update", options: { bold: true } },
    ],
    ...activeProjects.map((project) => {
      const report = getLatestProjectReport(project.id, weeklyReports);
      const docs = getProjectDocuments(project.id, projectDocuments);

      const docNames = docs
        .slice(0, 4)
        .map((doc) => `${doc.title} (${doc.status || "Draft"})`)
        .join(", ");

      return [
        safeText(project.name),
        safeText(report?.proposalStatus, "Not updated"),
        safeText(report?.documentationStatus, "Not updated"),
        docNames || "No documents added",
        formatDate(report?.updatedAt || project.updatedAt),
      ];
    }),
  ];

  slide.addTable(rows, {
    x: 0.55,
    y: 2.65,
    w: 12.25,
    h: 4.0,
    border: { type: "solid", color: COLORS.border, pt: 0.5 },
    fill: { color: COLORS.white },
    color: COLORS.navy,
    fontSize: 7.5,
    valign: "mid",
    fit: "shrink",
    margin: 0.055,
    autoFit: false,
    colW: [2.7, 2.3, 2.5, 3.3, 1.45],
    rowH: 0.34,
  });

  addFooter(slide, "Proposals & Documentation Update");
}

export async function generateCentralizedManagerPpt({
  projects = [],
  tasks = [],
  sprints = [],
  weeklyReports = [],
  projectDocuments = [],
}) {
  const pptx = new pptxgen();
  const shapes = getShapes(pptx);

  pptx.defineLayout({
    name: "CUSTOM_WIDE",
    width: 13.333,
    height: 7.5,
  });

  pptx.layout = "CUSTOM_WIDE";
  pptx.author = "Project Planner";
  pptx.company = "Project Planner";
  pptx.subject = "Centralized Projects Report";
  pptx.title = "Centralized Projects Report";
  pptx.lang = "en-IN";

  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
    lang: "en-US",
  };

  const portfolioData = getPortfolioHealthData(
    projects,
    tasks,
    sprints,
    weeklyReports
  );

  const activeProjects = projects.filter(
    (project) => project.status !== "Archived"
  );

  addCoverSlide(pptx, shapes, projects, tasks, weeklyReports);
  addExecutiveSummarySlide(pptx, shapes, portfolioData);
  addProjectHealthMatrixSlide(pptx, shapes, portfolioData);
  addAttentionRequiredSlide(pptx, shapes, portfolioData);
  addLiveProjectsSlide(pptx, shapes, projects);

  activeProjects.forEach((project, index) => {
    addProjectUpdateSlide({
      pptx,
      shapes,
      project,
      projectIndex: index,
      totalProjects: activeProjects.length,
      tasks,
      sprints,
      weeklyReports,
    });
  });

  addPocSlide(pptx, shapes, projects, weeklyReports);

  addProposalDocumentationSlide(
    pptx,
    shapes,
    projects,
    weeklyReports,
    projectDocuments
  );

  const fileName = `Centralized_Projects_Report_${new Date()
    .toISOString()
    .slice(0, 10)}.pptx`;

  await pptx.writeFile({ fileName });
}