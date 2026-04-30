import * as XLSX from "xlsx";

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

function buildProjectNameMap(projects = []) {
  const map = new Map();
  projects.forEach((project) => {
    if (project?.name) {
      map.set(project.name.trim().toLowerCase(), project);
    }
  });
  return map;
}

function buildSprintKey(projectId, sprintName) {
  return `${projectId}::${cleanValue(sprintName).toLowerCase()}`;
}

function flattenProjects(projects = []) {
  return projects.map((project) => ({
    "Project ID": project.id || "",
    Name: project.name || "",
    Owner: project.owner || "",
    Description: project.description || "",
    Status: project.status || "Active",
    "Start Date": project.startDate || "",
    "Target End Date": project.targetEndDate || "",
  }));
}

function flattenSprints(sprints = [], projects = []) {
  const projectById = Object.fromEntries(projects.map((p) => [p.id, p]));

  return sprints.map((sprint) => ({
    "Sprint ID": sprint.id || "",
    Project: projectById[sprint.projectId]?.name || "",
    Name: sprint.name || "",
    Goal: sprint.goal || "",
    Status: sprint.status || "Planned",
    "Start Date": sprint.startDate || "",
    "End Date": sprint.endDate || "",
  }));
}

function flattenTasks(tasks = [], projects = [], sprints = []) {
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

export function exportPlannerAsXlsx(data) {
  const workbook = XLSX.utils.book_new();

  const projectsSheet = XLSX.utils.json_to_sheet(flattenProjects(data.projects || []));
  const sprintsSheet = XLSX.utils.json_to_sheet(
    flattenSprints(data.sprints || [], data.projects || [])
  );
  const tasksSheet = XLSX.utils.json_to_sheet(
    flattenTasks(data.tasks || [], data.projects || [], data.sprints || [])
  );

  XLSX.utils.book_append_sheet(workbook, projectsSheet, "Projects");
  XLSX.utils.book_append_sheet(workbook, sprintsSheet, "Sprints");
  XLSX.utils.book_append_sheet(workbook, tasksSheet, "Tasks");

  return workbook;
}

export async function importPlannerFromXlsx(file, existingData = {}) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const projectsRows = workbook.Sheets.Projects
    ? XLSX.utils.sheet_to_json(workbook.Sheets.Projects, { defval: "" })
    : [];
  const sprintsRows = workbook.Sheets.Sprints
    ? XLSX.utils.sheet_to_json(workbook.Sheets.Sprints, { defval: "" })
    : [];
  const tasksRows = workbook.Sheets.Tasks
    ? XLSX.utils.sheet_to_json(workbook.Sheets.Tasks, { defval: "" })
    : [];

  const existingProjects = Array.isArray(existingData?.projects) ? existingData.projects : [];
  const existingSprints = Array.isArray(existingData?.sprints) ? existingData.sprints : [];
  const existingTasks = Array.isArray(existingData?.tasks) ? existingData.tasks : [];

  const projects = [...existingProjects];
  const sprints = [...existingSprints];
  const tasks = [...existingTasks];

  const projectNameMap = buildProjectNameMap(projects);

  projectsRows.forEach((row) => {
    const name = cleanValue(row.Name);
    if (!name) return;

    if (projectNameMap.has(name.toLowerCase())) return;

    const project = {
      id: cleanValue(row["Project ID"]) || safeId(),
      name,
      owner: cleanValue(row.Owner),
      description: cleanValue(row.Description),
      status: cleanValue(row.Status) || "Active",
      startDate: cleanValue(row["Start Date"]),
      targetEndDate: cleanValue(row["Target End Date"]),
    };

    projects.push(project);
    projectNameMap.set(name.toLowerCase(), project);
  });

  const sprintMap = new Map();
  sprints.forEach((sprint) => {
    sprintMap.set(buildSprintKey(sprint.projectId, sprint.name), sprint);
  });

  sprintsRows.forEach((row) => {
    const projectName = cleanValue(row.Project);
    const sprintName = cleanValue(row.Name);
    if (!projectName || !sprintName) return;

    const project = projectNameMap.get(projectName.toLowerCase());
    if (!project) return;

    const key = buildSprintKey(project.id, sprintName);
    if (sprintMap.has(key)) return;

    const sprint = {
      id: cleanValue(row["Sprint ID"]) || safeId(),
      projectId: project.id,
      name: sprintName,
      goal: cleanValue(row.Goal),
      status: cleanValue(row.Status) || "Planned",
      startDate: cleanValue(row["Start Date"]),
      endDate: cleanValue(row["End Date"]),
    };

    sprints.push(sprint);
    sprintMap.set(key, sprint);
  });

  const importedTasks = [];
  const rowTaskMap = new Map();
  const titleTaskMap = new Map();

  tasksRows.forEach((row, index) => {
    const projectName = cleanValue(row.Project);
    const sprintName = cleanValue(row.Sprint);
    const title = cleanValue(row["Task Name"]);

    if (!title) return;

    const project =
      projectNameMap.get(projectName.toLowerCase()) || projects[0] || null;

    const sprint =
      sprintName && project
        ? sprintMap.get(buildSprintKey(project.id, sprintName))
        : null;

    const task = {
      id: cleanValue(row["Task ID"]) || safeId(),
      projectId: project?.id || "",
      sprintId: sprint?.id || "",
      parentTaskId: "",
      title,
      owner: cleanValue(row.Owner),
      priority: cleanValue(row.Priority) || "Medium",
      status: cleanValue(row.Status) || "Not Started",
      plannedStart: cleanValue(row["Planned Start"]),
      plannedEnd: cleanValue(row["Planned End"]),
      actualStart: cleanValue(row["Actual Start"]),
      actualEnd: cleanValue(row["Actual End"]),
      plannedProgress: toNumber(row["Planned Progress"], 0),
      actualProgress: toNumber(row["Actual Progress"], 0),
      durationDays: Math.max(1, toNumber(row["Duration Days"], 1)),
      isMilestone: toBool(row.Milestone),
      isManualLocked: toBool(row["Manual Lock"]),
      dependencyIds: [],
      dependencyRules: [],
    };

    importedTasks.push(task);
    rowTaskMap.set(String(index + 1), task);

    const titleKey = title.toLowerCase();
    if (!titleTaskMap.has(titleKey)) {
      titleTaskMap.set(titleKey, task);
    }
  });

  tasksRows.forEach((row, index) => {
    const task = importedTasks[index];
    if (!task) return;

    const parentTaskTitle = cleanValue(row["Parent Task"]);
    if (parentTaskTitle) {
      const parent = titleTaskMap.get(parentTaskTitle.toLowerCase());
      if (parent && parent.id !== task.id) {
        task.parentTaskId = parent.id;
      }
    }

    const predecessorText = cleanValue(row.Predecessors);
    if (predecessorText) {
      const parts = predecessorText
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
    tasks: [...tasks, ...importedTasks],
    plannerSettings: existingData?.plannerSettings || {},
    baselineSnapshots: Array.isArray(existingData?.baselineSnapshots)
      ? existingData.baselineSnapshots
      : [],
  };
}