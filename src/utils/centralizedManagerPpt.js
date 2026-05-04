import pptxgen from "pptxgenjs";

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

  const averageProgress =
    totalTasks > 0 ? Math.round(totalActualProgress / totalTasks) : 0;

  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    blockedTasks,
    milestones,
    averageProgress,
  };
}

function addFooter(slide, text) {
  slide.addText(text, {
    x: 0.5,
    y: 7.05,
    w: 12.25,
    h: 0.25,
    fontSize: 7.5,
    color: "666666",
    align: "right",
  });
}

function addTopBar(slide, shapes) {
  slide.addShape(shapes.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.16,
    fill: { color: "111827" },
    line: { color: "111827" },
  });
}

function addMetricBox(slide, shapes, label, value, x, y, w, h) {
  slide.addShape(shapes.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.06,
    fill: { color: "F8FAFC" },
    line: { color: "CBD5E1", width: 1 },
  });

  slide.addText(String(value), {
    x,
    y: y + 0.09,
    w,
    h: 0.28,
    fontSize: 15,
    bold: true,
    color: "111827",
    align: "center",
    fit: "shrink",
  });

  slide.addText(label, {
    x: x + 0.05,
    y: y + 0.43,
    w: w - 0.1,
    h: 0.22,
    fontSize: 7.2,
    color: "4B5563",
    align: "center",
    fit: "shrink",
  });
}

function addSectionBox(slide, shapes, title, body, x, y, w, h) {
  slide.addShape(shapes.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.05,
    fill: { color: "F9FAFB" },
    line: { color: "E5E7EB", width: 1 },
  });

  slide.addText(title, {
    x: x + 0.14,
    y: y + 0.12,
    w: w - 0.28,
    h: 0.22,
    fontSize: 9.2,
    bold: true,
    color: "111827",
    fit: "shrink",
  });

  slide.addText(cleanText(body), {
    x: x + 0.14,
    y: y + 0.43,
    w: w - 0.28,
    h: h - 0.52,
    fontSize: 7.8,
    color: "374151",
    valign: "top",
    fit: "shrink",
    breakLine: false,
  });
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

function addCoverSlide(pptx, shapes, projects, tasks) {
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };

  addTopBar(slide, shapes);

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

  slide.addText("Centralized Projects Report", {
    x: 0.75,
    y: 1.1,
    w: 11.8,
    h: 0.55,
    fontSize: 30,
    bold: true,
    color: "111827",
    fit: "shrink",
  });

  slide.addText("Combined project-wise management update", {
    x: 0.78,
    y: 1.78,
    w: 11.4,
    h: 0.35,
    fontSize: 14,
    color: "4B5563",
  });

  slide.addShape(shapes.roundRect, {
    x: 0.78,
    y: 2.45,
    w: 11.8,
    h: 2.05,
    rectRadius: 0.08,
    fill: { color: "F8FAFC" },
    line: { color: "E5E7EB" },
  });

  addMetricBox(slide, shapes, "Live Projects", activeProjects.length, 1.15, 2.85, 2.15, 0.85);
  addMetricBox(slide, shapes, "Total Tasks", totalTasks, 3.8, 2.85, 2.15, 0.85);
  addMetricBox(slide, shapes, "Completed Tasks", completedTasks, 6.45, 2.85, 2.15, 0.85);
  addMetricBox(slide, shapes, "Overall Completion", `${progress}%`, 9.1, 2.85, 2.15, 0.85);

  slide.addText(`Generated on: ${generatedDate}`, {
    x: 0.82,
    y: 5.2,
    w: 11.6,
    h: 0.32,
    fontSize: 11,
    color: "374151",
  });

  slide.addText(
    "This report gives a consolidated view of live projects, project-wise updates, POC progress, proposal status, and documentation readiness.",
    {
      x: 0.82,
      y: 5.7,
      w: 11.7,
      h: 0.6,
      fontSize: 10.5,
      color: "4B5563",
      fit: "shrink",
    }
  );

  addFooter(slide, "Slide 1 | Cover");
}

function addLiveProjectsSlide(pptx, shapes, projects) {
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };

  addTopBar(slide, shapes);

  slide.addText("Live Projects Overview", {
    x: 0.5,
    y: 0.42,
    w: 12.2,
    h: 0.38,
    fontSize: 22,
    bold: true,
    color: "111827",
  });

  slide.addText(
    "List of active projects with planned start and target completion dates",
    {
      x: 0.52,
      y: 0.88,
      w: 12,
      h: 0.24,
      fontSize: 9.5,
      color: "4B5563",
    }
  );

  const activeProjects = projects.filter(
    (project) => project.status !== "Archived"
  );

  const rows = [
    [
      { text: "Project", options: { bold: true } },
      { text: "Owner", options: { bold: true } },
      { text: "Status", options: { bold: true } },
      { text: "Start Date", options: { bold: true } },
      { text: "Target End Date", options: { bold: true } },
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
    y: 1.4,
    w: 12.2,
    h: 5.2,
    border: { type: "solid", color: "CBD5E1", pt: 0.5 },
    fill: { color: "FFFFFF" },
    color: "111827",
    fontSize: 8.3,
    valign: "mid",
    fit: "shrink",
    margin: 0.06,
    autoFit: false,
    colW: [4.0, 2.0, 1.7, 2.0, 2.5],
  });

  addFooter(slide, "Slide 2 | Live Projects Overview");
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
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };

  addTopBar(slide, shapes);

  const projectTasks = getProjectTasks(project.id, tasks);
  const projectSprints = getProjectSprints(project.id, sprints);
  const latestReport = getLatestProjectReport(project.id, weeklyReports);
  const stats = getTaskStats(projectTasks);

  const projectStatus = latestReport?.overallStatus || project.status || "Not Updated";

  slide.addText(project.name || `Project ${projectIndex + 1}`, {
    x: 0.5,
    y: 0.33,
    w: 9.4,
    h: 0.38,
    fontSize: 20,
    bold: true,
    color: "111827",
    fit: "shrink",
  });

  slide.addText(`Status: ${projectStatus}`, {
    x: 10.1,
    y: 0.38,
    w: 2.7,
    h: 0.3,
    fontSize: 10,
    bold: true,
    color: "111827",
    align: "right",
    fit: "shrink",
  });

  slide.addText(
    `Owner: ${safeText(project.owner)} | Start: ${formatDate(
      project.startDate
    )} | Target End: ${formatDate(project.targetEndDate)}`,
    {
      x: 0.52,
      y: 0.8,
      w: 12.1,
      h: 0.25,
      fontSize: 8.4,
      color: "4B5563",
      fit: "shrink",
    }
  );

  addMetricBox(slide, shapes, "Tasks", stats.totalTasks, 0.55, 1.18, 1.5, 0.72);
  addMetricBox(slide, shapes, "Completed", stats.completedTasks, 2.2, 1.18, 1.5, 0.72);
  addMetricBox(slide, shapes, "In Progress", stats.inProgressTasks, 3.85, 1.18, 1.5, 0.72);
  addMetricBox(slide, shapes, "Blocked", stats.blockedTasks, 5.5, 1.18, 1.5, 0.72);
  addMetricBox(slide, shapes, "Sprints", projectSprints.length, 7.15, 1.18, 1.5, 0.72);
  addMetricBox(slide, shapes, "Milestones", stats.milestones, 8.8, 1.18, 1.5, 0.72);
  addMetricBox(slide, shapes, "Progress", `${stats.averageProgress}%`, 10.45, 1.18, 1.5, 0.72);

  addSectionBox(slide, shapes, "Current Status", makeProjectStatusText(project, latestReport), 0.55, 2.12, 3.0, 1.0);
  addSectionBox(slide, shapes, "Major Milestone Achieved", makeMajorMilestoneText(projectTasks, latestReport), 3.75, 2.12, 3.0, 1.0);
  addSectionBox(slide, shapes, "Upcoming Milestone", makeUpcomingMilestoneText(projectTasks, latestReport), 6.95, 2.12, 3.0, 1.0);
  addSectionBox(slide, shapes, "Potential Risk", makeRiskText(latestReport), 10.15, 2.12, 2.65, 1.0);

  addSectionBox(slide, shapes, "Outstanding Issues with Justification", makeIssuesText(latestReport), 0.55, 3.35, 4.0, 1.15);
  addSectionBox(slide, shapes, "Challenges Faced by Team", makeChallengesText(latestReport), 4.75, 3.35, 4.0, 1.15);
  addSectionBox(slide, shapes, "Achievements", makeAchievementsText(latestReport), 8.95, 3.35, 3.85, 1.15);

  addSectionBox(slide, shapes, "Team Members", makeTeamText(project, latestReport, projectTasks), 0.55, 4.75, 4.0, 1.0);
  addSectionBox(slide, shapes, "Next Steps", latestReport?.nextWeekPlan || "Next steps have not been updated.", 4.75, 4.75, 4.0, 1.0);
  addSectionBox(slide, shapes, "Manager Remarks", latestReport?.pmRemarks || latestReport?.leadershipMessage || "No manager remarks available.", 8.95, 4.75, 3.85, 1.0);

  addFooter(
    slide,
    `Slide ${projectIndex + 3} | Project ${projectIndex + 1} of ${totalProjects}`
  );
}

function addPocSlide(pptx, shapes, projects, weeklyReports) {
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };

  addTopBar(slide, shapes);

  slide.addText("Proof of Concepts Update", {
    x: 0.5,
    y: 0.4,
    w: 12.2,
    h: 0.38,
    fontSize: 22,
    bold: true,
    color: "111827",
  });

  slide.addText(
    "Consolidated view of POC progress across scope, development, internal demo, final demo, and next steps.",
    {
      x: 0.52,
      y: 0.88,
      w: 12,
      h: 0.25,
      fontSize: 9.3,
      color: "4B5563",
    }
  );

  const pocFields = [
    {
      title: "Scope Definition & Acceptance Criteria Status",
      explanation:
        "Items where scope, requirements, success criteria, and acceptance points are still being finalized.",
      key: "pocScopeAcceptanceStatus",
    },
    {
      title: "POC Development",
      explanation:
        "Items where actual development work has started and the team is building the required solution.",
      key: "pocDevelopmentStatus",
    },
    {
      title: "POC Internal Demo & Feedback Incorporation",
      explanation:
        "Items reviewed internally and updated based on feedback received.",
      key: "pocInternalDemoStatus",
    },
    {
      title: "POC Final Demo",
      explanation:
        "Completed POC presented to stakeholders for final review and confirmation.",
      key: "pocFinalDemoStatus",
    },
    {
      title: "Next Steps",
      explanation:
        "Immediate actions required to move POCs forward, including closures, approvals, demos, and next-phase planning.",
      key: "pocNextSteps",
    },
  ];

  const activeProjects = projects.filter(
    (project) => project.status !== "Archived"
  );

  pocFields.forEach((field, index) => {
    const x = index % 2 === 0 ? 0.55 : 6.9;
    const y = index < 2 ? 1.45 : index < 4 ? 3.05 : 4.65;
    const w = index === 4 ? 12.25 : 5.9;
    const h = index === 4 ? 1.45 : 1.25;

    const projectUpdates = activeProjects
      .map((project) => {
        const report = getLatestProjectReport(project.id, weeklyReports);
        const value = report?.[field.key];

        if (!value) return null;

        return `${project.name}: ${value}`;
      })
      .filter(Boolean)
      .join("\n");

    addSectionBox(
      slide,
      shapes,
      field.title,
      `${field.explanation}\n\n${
        projectUpdates || "No project-level POC update has been added yet."
      }`,
      x,
      y,
      w,
      h
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
  slide.background = { color: "FFFFFF" };

  addTopBar(slide, shapes);

  slide.addText("Proposals & Documentation Update", {
    x: 0.5,
    y: 0.4,
    w: 12.2,
    h: 0.38,
    fontSize: 22,
    bold: true,
    color: "111827",
  });

  slide.addText(
    "Project-wise view of proposals prepared, documentation status, and documents added to the tool.",
    {
      x: 0.52,
      y: 0.88,
      w: 12,
      h: 0.25,
      fontSize: 9.3,
      color: "4B5563",
    }
  );

  const activeProjects = projects.filter(
    (project) => project.status !== "Archived"
  );

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
    y: 1.35,
    w: 12.25,
    h: 5.4,
    border: { type: "solid", color: "CBD5E1", pt: 0.5 },
    fill: { color: "FFFFFF" },
    color: "111827",
    fontSize: 7.7,
    valign: "mid",
    fit: "shrink",
    margin: 0.05,
    autoFit: false,
    colW: [2.7, 2.3, 2.5, 3.3, 1.45],
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

  const activeProjects = projects.filter(
    (project) => project.status !== "Archived"
  );

  addCoverSlide(pptx, shapes, projects, tasks);
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