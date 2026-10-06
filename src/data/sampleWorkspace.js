// Demo workspace for first-time users. Dates are relative to today so the
// sample always shows a realistic mix of finished, active, late and future
// work.

function isoDate(offsetDays) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function makeIdFactory(prefix) {
  const stamp = Date.now().toString(36);
  let counter = 0;
  return (kind) => `${kind}-${prefix}-${stamp}-${(counter += 1)}`;
}

export function buildSampleWorkspace() {
  const id = makeIdFactory("sample");

  const launchId = id("project");
  const crmId = id("project");

  const projects = [
    {
      id: launchId,
      name: "Website Relaunch",
      owner: "Priya Shah",
      description:
        "Redesign and relaunch the marketing website with a new CMS, faster pages and a refreshed brand.",
      status: "Active",
      startDate: isoDate(-30),
      targetEndDate: isoDate(45),
    },
    {
      id: crmId,
      name: "CRM Migration",
      owner: "Daniel Okafor",
      description:
        "Move sales data from spreadsheets into the new CRM and train the sales team.",
      status: "At Risk",
      startDate: isoDate(-20),
      targetEndDate: isoDate(25),
    },
  ];

  const sprint1 = id("sprint");
  const sprint2 = id("sprint");
  const sprint3 = id("sprint");

  const sprints = [
    { id: sprint1, projectId: launchId, name: "Sprint 1 - Discovery", startDate: isoDate(-30), endDate: isoDate(-17), goal: "Agree scope, sitemap and design direction" },
    { id: sprint2, projectId: launchId, name: "Sprint 2 - Build", startDate: isoDate(-16), endDate: isoDate(-3), goal: "Templates and CMS set up" },
    { id: sprint3, projectId: launchId, name: "Sprint 3 - Content & QA", startDate: isoDate(-2), endDate: isoDate(11), goal: "Migrate content and test" },
  ];

  const t = {};
  const task = (key, fields) => {
    t[key] = { id: id("task"), ...fields };
  };

  task("discovery", { projectId: launchId, sprintId: sprint1, title: "Discovery & planning", owner: "Priya Shah", priority: "High", status: "Done", plannedStart: isoDate(-30), plannedEnd: isoDate(-18), actualStart: isoDate(-30), actualEnd: isoDate(-18), plannedProgress: 100, actualProgress: 100 });
  task("interviews", { projectId: launchId, sprintId: sprint1, parentKey: "discovery", title: "Stakeholder interviews", owner: "Priya Shah", priority: "Medium", status: "Done", plannedStart: isoDate(-30), plannedEnd: isoDate(-25), actualStart: isoDate(-30), actualEnd: isoDate(-24), plannedProgress: 100, actualProgress: 100 });
  task("sitemap", { projectId: launchId, sprintId: sprint1, parentKey: "discovery", deps: ["interviews"], title: "Sitemap & content audit", owner: "Leo Martins", priority: "Medium", status: "Done", plannedStart: isoDate(-24), plannedEnd: isoDate(-18), actualStart: isoDate(-23), actualEnd: isoDate(-18), plannedProgress: 100, actualProgress: 100 });
  task("design", { projectId: launchId, sprintId: sprint2, deps: ["sitemap"], title: "Visual design system", owner: "Amara Chen", priority: "High", status: "Done", plannedStart: isoDate(-17), plannedEnd: isoDate(-8), actualStart: isoDate(-17), actualEnd: isoDate(-6), plannedProgress: 100, actualProgress: 100 });
  task("signoff", { projectId: launchId, sprintId: sprint2, deps: ["design"], title: "Design sign-off", owner: "Priya Shah", priority: "High", status: "Done", plannedStart: isoDate(-6), plannedEnd: isoDate(-6), actualStart: isoDate(-5), actualEnd: isoDate(-5), plannedProgress: 100, actualProgress: 100, isMilestone: true, durationDays: 1 });
  task("cms", { projectId: launchId, sprintId: sprint2, deps: ["signoff"], title: "Set up CMS and page templates", owner: "Leo Martins", priority: "High", status: "In Progress", plannedStart: isoDate(-5), plannedEnd: isoDate(-1), actualStart: isoDate(-4), plannedProgress: 100, actualProgress: 70 });
  task("content", { projectId: launchId, sprintId: sprint3, deps: ["cms"], title: "Migrate 120 pages of content", owner: "Sofia Rossi", priority: "Medium", status: "In Progress", plannedStart: isoDate(-1), plannedEnd: isoDate(10), actualStart: isoDate(0), plannedProgress: 15, actualProgress: 5 });
  task("seo", { projectId: launchId, sprintId: sprint3, deps: ["cms"], title: "SEO redirects and metadata", owner: "", priority: "Medium", status: "Not Started", plannedStart: isoDate(3), plannedEnd: isoDate(9), plannedProgress: 0, actualProgress: 0 });
  task("qa", { projectId: launchId, sprintId: sprint3, deps: ["content", "seo"], title: "Cross-browser QA and accessibility audit", owner: "Amara Chen", priority: "High", status: "Not Started", plannedStart: isoDate(11), plannedEnd: isoDate(18), plannedProgress: 0, actualProgress: 0 });
  task("launch", { projectId: launchId, deps: ["qa"], title: "Go live", owner: "Priya Shah", priority: "Critical", status: "Not Started", plannedStart: isoDate(20), plannedEnd: isoDate(20), plannedProgress: 0, actualProgress: 0, isMilestone: true, durationDays: 1 });

  task("export", { projectId: crmId, title: "Export and clean spreadsheet data", owner: "Daniel Okafor", priority: "High", status: "Done", plannedStart: isoDate(-20), plannedEnd: isoDate(-12), actualStart: isoDate(-20), actualEnd: isoDate(-10), plannedProgress: 100, actualProgress: 100 });
  task("fields", { projectId: crmId, deps: ["export"], title: "Map fields to CRM objects", owner: "Hannah Weber", priority: "High", status: "Blocked", plannedStart: isoDate(-11), plannedEnd: isoDate(-4), actualStart: isoDate(-9), plannedProgress: 100, actualProgress: 40, notes: "Waiting for the CRM admin licence." });
  task("import", { projectId: crmId, deps: ["fields"], title: "Load data into CRM", owner: "Hannah Weber", priority: "High", status: "Not Started", plannedStart: isoDate(-3), plannedEnd: isoDate(4), plannedProgress: 60, actualProgress: 0 });
  task("training", { projectId: crmId, deps: ["import"], title: "Train the sales team", owner: "", priority: "Medium", status: "Not Started", plannedStart: isoDate(6), plannedEnd: isoDate(12), plannedProgress: 0, actualProgress: 0 });
  task("cutover", { projectId: crmId, deps: ["training"], title: "Retire spreadsheets", owner: "Daniel Okafor", priority: "Medium", status: "Not Started", plannedStart: isoDate(14), plannedEnd: isoDate(14), plannedProgress: 0, actualProgress: 0, isMilestone: true, durationDays: 1 });

  const tasks = Object.values(t).map((item) => {
    const { parentKey, deps, ...rest } = item;
    return {
      ...rest,
      parentTaskId: parentKey ? t[parentKey].id : "",
      dependencyIds: (deps || []).map((key) => t[key].id),
      isMilestone: Boolean(item.isMilestone),
    };
  });

  const weeklyReports = [
    {
      id: id("weekly-report"),
      projectId: launchId,
      reportingWeek: `Week of ${isoDate(-7)}`,
      reportDate: isoDate(-3),
      preparedBy: "Priya Shah",
      projectManager: "Priya Shah",
      overallStatus: "Amber",
      executiveSummary:
        "Design is signed off. CMS setup slipped by two days because of a hosting change, and content migration starts this week.",
      achievements: "Design system approved; staging site live.",
      nextWeekPlan: "Finish CMS templates and start content migration.",
      risks: "Content owners may not review pages in time.",
      mitigationPlan: "Weekly review slots booked with each content owner.",
      confidenceLevel: "Medium",
    },
  ];

  const projectDocuments = [
    {
      id: id("project-doc"),
      projectId: launchId,
      title: "Project charter",
      documentType: "Charter",
      version: "1.0",
      owner: "Priya Shah",
      status: "Approved",
      documentUrl: "",
      description: "Scope, goals and success measures for the relaunch.",
    },
  ];

  return {
    projects,
    sprints,
    tasks,
    plannerSettings: { schedulingMode: "manual" },
    baselineSnapshots: [],
    weeklyReports,
    projectDocuments,
  };
}
