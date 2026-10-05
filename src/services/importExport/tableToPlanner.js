// Converts spreadsheet-like rows from any tool into planner data using a
// column mapping (see columnMapper.js).

import { normalizePriority, normalizeTaskStatus } from "../../domain/vocabulary";
import {
  cleanText,
  detectDateOrder,
  parseBoolean,
  parseDate,
  parseDurationDays,
  parsePercent,
  splitList,
} from "./values";

const DATE_FIELDS = ["plannedStart", "plannedEnd", "actualStart", "actualEnd"];
const DAY_MS = 24 * 60 * 60 * 1000;

function makeId(prefix) {
  const random =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

function dayDiff(from, to) {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS);
}

function splitDateRange(value) {
  const text = String(value ?? "").trim();
  if (!text) return ["", ""];
  const parts = text.split(/\s+(?:-|–|—|to|until|→)\s+|\s*(?:–|—|→)\s*/i).filter(Boolean);
  if (parts.length >= 2) return [parts[0], parts[parts.length - 1]];
  return [text, ""];
}

function projectNameFromFile(fileName) {
  const base = String(fileName || "").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "Imported project";
}

/**
 * @param {object[]} rows
 * @param {Record<string,string>} mapping header -> field
 * @param {{ fileName?: string, existingProjects?: object[], dateOrder?: "dmy"|"mdy" }} options
 */
export function rowsToPlannerData(rows, mapping, options = {}) {
  const fieldToHeader = {};
  Object.entries(mapping).forEach(([header, field]) => {
    if (field && field !== "ignore" && !fieldToHeader[field]) fieldToHeader[field] = header;
  });

  const warnings = [];
  if (!fieldToHeader.title) {
    throw new Error("Choose which column holds the task name before importing.");
  }

  const read = (row, field) => (fieldToHeader[field] ? row[fieldToHeader[field]] : undefined);

  const dateSamples = [];
  rows.slice(0, 300).forEach((row) => {
    DATE_FIELDS.forEach((field) => dateSamples.push(read(row, field)));
    if (fieldToHeader.dateRange) dateSamples.push(...splitDateRange(read(row, "dateRange")));
  });
  const dateOrder = options.dateOrder || detectDateOrder(dateSamples);

  // Projects
  const existingByName = new Map(
    (options.existingProjects || []).map((project) => [project.name.trim().toLowerCase(), project])
  );
  const projectsByName = new Map();
  const fallbackName = options.defaultProjectName || projectNameFromFile(options.fileName);

  function projectFor(name) {
    const label = cleanText(name, 120) || fallbackName;
    const key = label.toLowerCase();
    if (!projectsByName.has(key)) {
      const existing = existingByName.get(key);
      projectsByName.set(key, existing ? { ...existing, __existing: true } : {
        id: makeId("project"),
        name: label,
        owner: "",
        description: `Imported from ${options.fileName || "a file"}.`,
        status: "Active",
        startDate: "",
        targetEndDate: "",
      });
    }
    return projectsByName.get(key);
  }

  // Sprints
  const sprintsByKey = new Map();
  function sprintFor(projectId, name) {
    const label = cleanText(name, 120);
    if (!label) return "";
    const key = `${projectId}::${label.toLowerCase()}`;
    if (!sprintsByKey.has(key)) {
      sprintsByKey.set(key, { id: makeId("sprint"), projectId, name: label, startDate: "", endDate: "", goal: "" });
    }
    return sprintsByKey.get(key).id;
  }

  const tasks = [];
  let skipped = 0;
  let undated = 0;

  rows.forEach((row, index) => {
    const title = cleanText(read(row, "title"), 300);
    if (!title) {
      if (Object.values(row).some((value) => String(value ?? "").trim() !== "")) skipped += 1;
      return;
    }

    const project = projectFor(read(row, "project"));

    let plannedStart = parseDate(read(row, "plannedStart"), dateOrder);
    let plannedEnd = parseDate(read(row, "plannedEnd"), dateOrder);
    if (fieldToHeader.dateRange) {
      const [from, to] = splitDateRange(read(row, "dateRange"));
      plannedStart = plannedStart || parseDate(from, dateOrder);
      plannedEnd = plannedEnd || parseDate(to, dateOrder) || plannedStart;
    }

    let durationDays = parseDurationDays(read(row, "durationDays"));
    if (plannedStart && plannedEnd && plannedEnd < plannedStart) {
      [plannedStart, plannedEnd] = [plannedEnd, plannedStart];
    }
    if (plannedStart && plannedEnd) {
      durationDays = dayDiff(plannedStart, plannedEnd) + 1;
    } else if (plannedStart && durationDays > 0) {
      plannedEnd = addDays(plannedStart, durationDays - 1);
    } else if (plannedEnd && durationDays > 0) {
      plannedStart = addDays(plannedEnd, -(durationDays - 1));
    } else if (plannedEnd && !plannedStart) {
      plannedStart = plannedEnd;
      durationDays = 1;
    } else if (plannedStart && !plannedEnd) {
      plannedEnd = plannedStart;
      durationDays = 1;
    }
    if (!plannedStart) undated += 1;

    const rawProgress = read(row, "actualProgress");
    const actualProgressInput = rawProgress === undefined || rawProgress === "" ? null : parsePercent(rawProgress);
    const rawStatus = read(row, "status");
    // A bare "completed" column holds yes/no or a date rather than a status.
    const status =
      fieldToHeader.status && normalizeHeaderValue(fieldToHeader.status) === "completed"
        ? parseBoolean(rawStatus) || parseDate(rawStatus, dateOrder)
          ? "Done"
          : normalizeTaskStatus("", actualProgressInput)
        : normalizeTaskStatus(rawStatus, actualProgressInput);

    const tags = splitList(read(row, "tags"));
    const isMilestone =
      parseBoolean(read(row, "isMilestone")) ||
      tags.some((tag) => tag.toLowerCase() === "milestone") ||
      /^0\s*(d|days?)?$/i.test(String(read(row, "durationDays") ?? "").trim());

    tasks.push({
      id: makeId("task"),
      projectId: project.id,
      sprintId: sprintFor(project.id, read(row, "sprint")),
      parentTaskId: "",
      dependencyIds: [],
      title,
      owner: splitList(read(row, "owner")).join(", ").slice(0, 120),
      priority: normalizePriority(read(row, "priority")),
      status,
      plannedStart,
      plannedEnd: isMilestone ? plannedStart || plannedEnd : plannedEnd,
      actualStart: parseDate(read(row, "actualStart"), dateOrder),
      actualEnd: parseDate(read(row, "actualEnd"), dateOrder),
      durationDays: isMilestone ? 1 : Math.max(1, durationDays || 1),
      plannedProgress: parsePercent(read(row, "plannedProgress")),
      actualProgress: actualProgressInput ?? (status === "Done" ? 100 : 0),
      isMilestone,
      wbs: cleanText(read(row, "wbs"), 40),
      externalId: cleanText(read(row, "externalId"), 80),
      notes: cleanText(read(row, "notes"), 2000),
      tags: tags.filter((tag) => tag.toLowerCase() !== "milestone").slice(0, 10),
      __row: index + 1,
      __parent: cleanText(read(row, "parent"), 300),
      __predecessors: cleanText(read(row, "predecessors"), 500),
    });
  });

  // Lookups for hierarchy and dependencies.
  const byRow = new Map();
  const byWbs = new Map();
  const byExternal = new Map();
  const byTitle = new Map();
  tasks.forEach((task) => {
    byRow.set(String(task.__row), task);
    if (task.wbs) byWbs.set(`${task.projectId}::${task.wbs}`, task);
    if (task.externalId) byExternal.set(task.externalId.toLowerCase(), task);
    const titleKey = `${task.projectId}::${task.title.toLowerCase()}`;
    if (!byTitle.has(titleKey)) byTitle.set(titleKey, task);
  });

  // Rows referring to a parent that is not itself a row (e.g. Jira epics) get
  // a summary task created for them.
  const createdParents = new Map();

  tasks.forEach((task) => {
    let parent = null;
    if (task.__parent) {
      parent =
        byExternal.get(task.__parent.toLowerCase()) ||
        byTitle.get(`${task.projectId}::${task.__parent.toLowerCase()}`) ||
        null;
      if (!parent) {
        const key = `${task.projectId}::${task.__parent.toLowerCase()}`;
        if (!createdParents.has(key)) {
          createdParents.set(key, {
            id: makeId("task"),
            projectId: task.projectId,
            sprintId: "",
            parentTaskId: "",
            dependencyIds: [],
            title: task.__parent,
            owner: "",
            priority: "Medium",
            status: "Not Started",
            plannedStart: "",
            plannedEnd: "",
            durationDays: 1,
            isSummaryTask: true,
          });
        }
        parent = createdParents.get(key);
      }
    } else if (task.wbs && task.wbs.includes(".")) {
      const parentWbs = task.wbs.split(".").slice(0, -1).join(".");
      parent = byWbs.get(`${task.projectId}::${parentWbs}`) || null;
    }
    if (parent && parent.id !== task.id) task.parentTaskId = parent.id;
  });

  let unresolvedDependencies = 0;
  tasks.forEach((task) => {
    if (!task.__predecessors) return;
    const ids = [];
    task.__predecessors.split(/[,;]+/).forEach((token) => {
      const raw = token.trim();
      if (!raw) return;
      // MS Project style "12FS+2d" or "1.2SS": strip the link type and lag.
      const reference = raw.replace(/\s*(FS|SS|FF|SF)([+-]\s*\d+(\.\d+)?\s*\w*)?$/i, "").trim();
      const target =
        byWbs.get(`${task.projectId}::${reference}`) ||
        (/^\d+$/.test(reference) ? byRow.get(reference) : null) ||
        byExternal.get(reference.toLowerCase()) ||
        byTitle.get(`${task.projectId}::${reference.toLowerCase()}`);
      if (target && target.id !== task.id) ids.push(target.id);
      else unresolvedDependencies += 1;
    });
    task.dependencyIds = [...new Set(ids)];
  });

  const allTasks = [...createdParents.values(), ...tasks].map((task) => {
    const { __row, __parent, __predecessors, ...rest } = task;
    void __row;
    void __parent;
    void __predecessors;
    return rest;
  });

  // Project and sprint date ranges from their tasks.
  const projects = [...projectsByName.values()].map((project) => {
    const { __existing, ...rest } = project;
    if (__existing) return { ...rest, __existing: true };
    const dated = allTasks.filter((task) => task.projectId === project.id && task.plannedStart);
    const starts = dated.map((task) => task.plannedStart).sort();
    const ends = dated.map((task) => task.plannedEnd || task.plannedStart).sort();
    return { ...rest, startDate: starts[0] || "", targetEndDate: ends[ends.length - 1] || "" };
  });

  const sprints = [...sprintsByKey.values()].map((sprint) => {
    const dated = allTasks.filter((task) => task.sprintId === sprint.id && task.plannedStart);
    const starts = dated.map((task) => task.plannedStart).sort();
    const ends = dated.map((task) => task.plannedEnd || task.plannedStart).sort();
    return { ...sprint, startDate: starts[0] || "", endDate: ends[ends.length - 1] || "" };
  });

  if (skipped) warnings.push(`${skipped} row${skipped === 1 ? "" : "s"} had no task name and were skipped.`);
  if (undated) warnings.push(`${undated} task${undated === 1 ? " has" : "s have"} no dates. Add them later in the schedule to see them on the timeline.`);
  if (unresolvedDependencies) {
    warnings.push(`${unresolvedDependencies} dependency reference${unresolvedDependencies === 1 ? "" : "s"} could not be matched to a task and ${unresolvedDependencies === 1 ? "was" : "were"} left out.`);
  }
  if (createdParents.size) {
    warnings.push(`${createdParents.size} parent group${createdParents.size === 1 ? " was" : "s were"} created from the parent column (for example epics).`);
  }

  return {
    data: {
      projects: projects.filter((project) => !project.__existing),
      sprints,
      tasks: allTasks,
    },
    reusedProjects: projects.filter((project) => project.__existing).map((project) => project.name),
    dateOrder,
    warnings,
  };
}

function normalizeHeaderValue(header) {
  return String(header || "").trim().toLowerCase();
}
