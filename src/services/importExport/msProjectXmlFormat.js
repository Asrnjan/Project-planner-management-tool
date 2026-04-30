import { XMLBuilder, XMLParser } from "fast-xml-parser";

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

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseDurationToDays(durationText) {
  const text = cleanValue(durationText);
  if (!text) return 1;

  const match = text.match(/PT(\d+)H(\d+)M(\d+)S/);
  if (!match) return 1;

  const hours = Number(match[1] || 0);
  if (hours <= 0) return 1;

  return Math.max(1, Math.round(hours / 8));
}

function durationDaysToMsProjectDuration(days) {
  const safeDays = Math.max(1, Number(days || 1));
  const hours = safeDays * 8;
  return `PT${hours}H0M0S`;
}

function formatDateForXml(dateText) {
  const value = cleanValue(dateText);
  if (!value) return "";
  return `${value}T08:00:00`;
}

function normalizeTaskList(tasks = []) {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const childrenMap = new Map();

  tasks.forEach((task) => {
    const parentId = task.parentTaskId || "";
    if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
    childrenMap.get(parentId).push(task);
  });

  const ordered = [];

  function walk(task, outlineLevel = 1, prefix = "") {
    const siblings = childrenMap.get(task.parentTaskId || "") || [];
    const index = siblings.findIndex((s) => s.id === task.id) + 1;
    const outlineNumber = prefix ? `${prefix}.${index}` : `${index}`;

    ordered.push({
      ...task,
      outlineLevel,
      outlineNumber,
    });

    const children = childrenMap.get(task.id) || [];
    children.forEach((child) => walk(child, outlineLevel + 1, outlineNumber));
  }

  const roots = tasks.filter(
    (task) => !task.parentTaskId || !taskMap.has(task.parentTaskId)
  );

  roots.forEach((root) => walk(root, 1, ""));

  return ordered;
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

export function exportPlannerAsMsProjectXml(data) {
  const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
  const projects = Array.isArray(data?.projects) ? data.projects : [];
  const projectName = projects[0]?.name || "Planner Export";

  const orderedTasks = normalizeTaskList(tasks);
  const uidByTaskId = Object.fromEntries(
    orderedTasks.map((task, index) => [task.id, index + 1])
  );

  const xmlTasks = [
    {
      UID: 0,
      ID: 0,
      Name: projectName,
      Type: 1,
      IsNull: 0,
      OutlineLevel: 0,
      OutlineNumber: 0,
      Summary: 1,
    },
    ...orderedTasks.map((task, index) => {
      const isSummary = tasks.some((t) => t.parentTaskId === task.id);

      return {
        UID: uidByTaskId[task.id],
        ID: index + 1,
        Name: task.title || "Untitled Task",
        Type: 1,
        IsNull: 0,
        CreateDate: new Date().toISOString(),
        WBS: task.outlineNumber,
        OutlineNumber: task.outlineNumber,
        OutlineLevel: task.outlineLevel,
        Priority: 500,
        Start: formatDateForXml(task.plannedStart),
        Finish: formatDateForXml(task.plannedEnd),
        Duration: durationDaysToMsProjectDuration(task.durationDays || 1),
        DurationFormat: 39,
        Milestone: task.isMilestone ? 1 : 0,
        Summary: isSummary ? 1 : 0,
        PercentComplete: Number(task.actualProgress || task.plannedProgress || 0),
        Notes: task.owner ? `Owner: ${task.owner}` : "",
        PredecessorLink: (task.dependencyIds || []).map((depId) => ({
          PredecessorUID: uidByTaskId[depId],
          Type: 1,
          LinkLag: 0,
          LagFormat: 7,
        })),
      };
    }),
  ];

  const projectXmlObject = {
    Project: {
      "@_xmlns": "http://schemas.microsoft.com/project",
      SaveVersion: 14,
      Name: projectName,
      Title: projectName,
      Company: "Planner",
      CreationDate: new Date().toISOString(),
      ScheduleFromStart: 1,
      StartDate:
        formatDateForXml(
          orderedTasks.find((t) => t.plannedStart)?.plannedStart || ""
        ) || new Date().toISOString(),
      FinishDate:
        formatDateForXml(
          [...orderedTasks].reverse().find((t) => t.plannedEnd)?.plannedEnd || ""
        ) || new Date().toISOString(),
      Tasks: {
        Task: xmlTasks,
      },
    },
  };

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    suppressEmptyNode: true,
  });

  return builder.build(projectXmlObject);
}

export function importPlannerFromMsProjectXml(text, existingData = {}) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: true,
    trimValues: true,
  });

  const parsed = parser.parse(text);
  const projectNode = parsed?.Project;

  if (!projectNode) {
    throw new Error("Invalid MS Project XML file.");
  }

  const xmlTasks = toArray(projectNode?.Tasks?.Task).filter(
    (task) => Number(task?.UID) !== 0
  );

  const existingProjects = Array.isArray(existingData?.projects) ? existingData.projects : [];
  const existingSprints = Array.isArray(existingData?.sprints) ? existingData.sprints : [];
  const existingTasks = Array.isArray(existingData?.tasks) ? existingData.tasks : [];

  const projects = [...existingProjects];
  const projectNameMap = buildProjectNameMap(projects);

  const projectName = cleanValue(projectNode?.Name) || "Imported MS Project";
  let project = projectNameMap.get(projectName.toLowerCase());

  if (!project) {
    project = {
      id: safeId(),
      name: projectName,
      owner: "",
      description: "",
      status: "Active",
      startDate: "",
      targetEndDate: "",
    };
    projects.push(project);
    projectNameMap.set(projectName.toLowerCase(), project);
  }

  const importedTasks = [];
  const taskIdByUid = {};
  const outlineMap = new Map();

  xmlTasks.forEach((taskNode) => {
    const uid = String(taskNode?.UID ?? "");
    const title = cleanValue(taskNode?.Name) || "Untitled Task";
    const outlineNumber = cleanValue(taskNode?.OutlineNumber);
    const outlineLevel = toNumber(taskNode?.OutlineLevel, 1);
    const start = cleanValue(taskNode?.Start).slice(0, 10);
    const finish = cleanValue(taskNode?.Finish).slice(0, 10);
    const percentComplete = toNumber(taskNode?.PercentComplete, 0);
    const durationDays = parseDurationToDays(taskNode?.Duration);
    const isMilestone = toNumber(taskNode?.Milestone, 0) === 1;

    const importedTask = {
      id: safeId(),
      projectId: project.id,
      sprintId: "",
      parentTaskId: "",
      title,
      owner: "",
      priority: "Medium",
      status:
        percentComplete >= 100
          ? "Done"
          : percentComplete > 0
          ? "In Progress"
          : "Not Started",
      plannedStart: start,
      plannedEnd: finish,
      actualStart: "",
      actualEnd: "",
      plannedProgress: percentComplete,
      actualProgress: percentComplete,
      durationDays,
      isMilestone,
      isManualLocked: false,
      dependencyIds: [],
      dependencyRules: [],
      _xmlUid: uid,
      _outlineNumber: outlineNumber,
      _outlineLevel: outlineLevel,
      _predecessors: toArray(taskNode?.PredecessorLink)
        .map((p) => String(p?.PredecessorUID ?? ""))
        .filter(Boolean),
    };

    importedTasks.push(importedTask);
    taskIdByUid[uid] = importedTask.id;

    if (outlineNumber) {
      outlineMap.set(outlineNumber, importedTask);
    }
  });

  importedTasks.forEach((task) => {
    if (!task._outlineNumber) return;

    const parentOutline = task._outlineNumber.includes(".")
      ? task._outlineNumber.split(".").slice(0, -1).join(".")
      : "";

    if (parentOutline && outlineMap.has(parentOutline)) {
      task.parentTaskId = outlineMap.get(parentOutline).id;
    }

    task.dependencyIds = task._predecessors
      .map((uid) => taskIdByUid[uid])
      .filter(Boolean);

    delete task._xmlUid;
    delete task._outlineNumber;
    delete task._outlineLevel;
    delete task._predecessors;
  });

  return {
    projects,
    sprints: [...existingSprints],
    tasks: [...existingTasks, ...importedTasks],
    plannerSettings: existingData?.plannerSettings || {},
    baselineSnapshots: Array.isArray(existingData?.baselineSnapshots)
      ? existingData.baselineSnapshots
      : [],
  };
}