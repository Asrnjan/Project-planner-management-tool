function safeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function cleanValue(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function toBool(value) {
  const text = cleanValue(value).toLowerCase();
  return ["true", "yes", "y", "1"].includes(text);
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function buildProjectNameMap(projects = []) {
  const map = new Map();
  projects.forEach((project) => {
    if (project?.name) {
      map.set(project.name.trim().toLowerCase(), project);
    }
  });
  return map;
}

export function buildSprintKey(projectId, sprintName) {
  return `${projectId}::${cleanValue(sprintName).toLowerCase()}`;
}

export function flattenTasksForCsv({
  tasks = [],
  projects = [],
  sprints = [],
}) {
  const projectById = Object.fromEntries(projects.map((p) => [p.id, p]));
  const sprintById = Object.fromEntries(sprints.map((s) => [s.id, s]));
  const taskById = Object.fromEntries(tasks.map((t) => [t.id, t]));

  return tasks.map((task, index) => ({
    Row: index + 1,
    "Task ID": task.id || "",
    Project: projectById[task.projectId]?.name || "",
    Sprint: sprintById[task.sprintId]?.name || "",
    "Task Name": task.title || "",
    "Parent Task": task.parentTaskId ? taskById[task.parentTaskId]?.title || "" : "",
    Owner: task.owner || "",
    Priority: task.priority || "Medium",
    Status: task.status || "Not Started",
    Milestone: task.isMilestone ? "Yes" : "No",
    "Planned Start": task.plannedStart || "",
    "Planned End": task.plannedEnd || "",
    "Actual Start": task.actualStart || "",
    "Actual End": task.actualEnd || "",
    "Duration Days": task.durationDays ?? 1,
    "Planned Progress": task.plannedProgress ?? 0,
    "Actual Progress": task.actualProgress ?? 0,
    Predecessors: Array.isArray(task.dependencyIds) ? task.dependencyIds.join(",") : "",
    "Manual Lock": task.isManualLocked ? "Yes" : "No",
  }));
}

export function normalizePlannerJson(raw) {
  return {
    projects: Array.isArray(raw?.projects) ? raw.projects : [],
    sprints: Array.isArray(raw?.sprints) ? raw.sprints : [],
    tasks: Array.isArray(raw?.tasks) ? raw.tasks : [],
    plannerSettings: raw?.plannerSettings || {},
    baselineSnapshots: Array.isArray(raw?.baselineSnapshots)
      ? raw.baselineSnapshots
      : [],
  };
}

export function convertCsvRowsToPlannerData(rows = [], existingData = {}) {
  const existingProjects = Array.isArray(existingData?.projects) ? existingData.projects : [];
  const existingSprints = Array.isArray(existingData?.sprints) ? existingData.sprints : [];
  const existingTasks = Array.isArray(existingData?.tasks) ? existingData.tasks : [];

  const projectNameMap = buildProjectNameMap(existingProjects);

  const projects = [...existingProjects];
  const sprints = [...existingSprints];

  const sprintMap = new Map();
  existingSprints.forEach((sprint) => {
    sprintMap.set(buildSprintKey(sprint.projectId, sprint.name), sprint);
  });

  const normalizedRows = rows
    .map((row, index) => ({
      sourceIndex: index,
      rowNumber: index + 1,
      projectName: cleanValue(row.Project),
      sprintName: cleanValue(row.Sprint),
      title: cleanValue(row["Task Name"] || row.Title || row.Task),
      parentTaskTitle: cleanValue(row["Parent Task"]),
      owner: cleanValue(row.Owner),
      priority: cleanValue(row.Priority) || "Medium",
      status: cleanValue(row.Status) || "Not Started",
      isMilestone: toBool(row.Milestone),
      plannedStart: cleanValue(row["Planned Start"]),
      plannedEnd: cleanValue(row["Planned End"]),
      actualStart: cleanValue(row["Actual Start"]),
      actualEnd: cleanValue(row["Actual End"]),
      durationDays: toNumber(row["Duration Days"], 1),
      plannedProgress: toNumber(row["Planned Progress"], 0),
      actualProgress: toNumber(row["Actual Progress"], 0),
      predecessorText: cleanValue(row.Predecessors),
      isManualLocked: toBool(row["Manual Lock"]),
    }))
    .filter((row) => row.title);

  normalizedRows.forEach((row) => {
    if (!row.projectName) return;

    const existingProject = projectNameMap.get(row.projectName.toLowerCase());
    if (existingProject) return;

    const project = {
      id: safeId(),
      name: row.projectName,
      owner: "",
      description: "",
      status: "Active",
      startDate: "",
      targetEndDate: "",
    };

    projects.push(project);
    projectNameMap.set(row.projectName.toLowerCase(), project);
  });

  normalizedRows.forEach((row) => {
    if (!row.projectName || !row.sprintName) return;

    const project = projectNameMap.get(row.projectName.toLowerCase());
    if (!project) return;

    const key = buildSprintKey(project.id, row.sprintName);
    if (sprintMap.has(key)) return;

    const sprint = {
      id: safeId(),
      projectId: project.id,
      name: row.sprintName,
      goal: "",
      status: "Planned",
      startDate: "",
      endDate: "",
    };

    sprints.push(sprint);
    sprintMap.set(key, sprint);
  });

  const importedTasks = [];
  const rowTaskMap = new Map();
  const titleTaskMap = new Map();

  normalizedRows.forEach((row) => {
    const project =
      projectNameMap.get(row.projectName.toLowerCase()) || projects[0] || null;

    const sprint =
      row.sprintName && project
        ? sprintMap.get(buildSprintKey(project.id, row.sprintName))
        : null;

    const task = {
      id: safeId(),
      projectId: project?.id || "",
      sprintId: sprint?.id || "",
      parentTaskId: "",
      title: row.title,
      owner: row.owner,
      priority: row.priority,
      status: row.status,
      plannedStart: row.plannedStart,
      plannedEnd: row.plannedEnd,
      actualStart: row.actualStart,
      actualEnd: row.actualEnd,
      plannedProgress: row.plannedProgress,
      actualProgress: row.actualProgress,
      durationDays: Math.max(1, row.durationDays),
      isMilestone: row.isMilestone,
      isManualLocked: row.isManualLocked,
      dependencyIds: [],
      dependencyRules: [],
    };

    importedTasks.push(task);
    rowTaskMap.set(String(row.rowNumber), task);

    const titleKey = row.title.toLowerCase();
    if (!titleTaskMap.has(titleKey)) {
      titleTaskMap.set(titleKey, task);
    }
  });

  normalizedRows.forEach((row, idx) => {
    const task = importedTasks[idx];
    if (!task) return;

    if (row.parentTaskTitle) {
      const parent = titleTaskMap.get(row.parentTaskTitle.toLowerCase());
      if (parent && parent.id !== task.id) {
        task.parentTaskId = parent.id;
      }
    }

    if (row.predecessorText) {
      const parts = row.predecessorText
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);

      const dependencyIds = [];

      parts.forEach((part) => {
        const byRow = rowTaskMap.get(part);
        if (byRow && byRow.id !== task.id) {
          dependencyIds.push(byRow.id);
          return;
        }

        const byTitle = titleTaskMap.get(part.toLowerCase());
        if (byTitle && byTitle.id !== task.id) {
          dependencyIds.push(byTitle.id);
        }
      });

      task.dependencyIds = [...new Set(dependencyIds)];
    }
  });

  return {
    projects,
    sprints,
    tasks: [...existingTasks, ...importedTasks],
    plannerSettings: existingData?.plannerSettings || {},
    baselineSnapshots: Array.isArray(existingData?.baselineSnapshots)
      ? existingData.baselineSnapshots
      : [],
  };
}