// Reads an uploaded file into either ready planner data ("planner") or a
// table that still needs column mapping ("table").

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { XMLParser } from "fast-xml-parser";
import { autoMapColumns, mappingQuality, normalizeHeader } from "./columnMapper";
import { normalizePriority, normalizeTaskStatus } from "../../domain/vocabulary";
import { cleanText, parseBoolean, parseDate, parseDurationDays, parsePercent } from "./values";

export const ACCEPTED_EXTENSIONS = [
  ".csv", ".tsv", ".txt", ".xlsx", ".xlsm", ".xls", ".ods", ".json", ".xml", ".mpp",
];

const MAX_FILE_BYTES = 25 * 1024 * 1024;

function makeId(prefix) {
  const random =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

export function fileExtension(name) {
  const match = String(name || "").toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : "";
}

/* ------------------------------------------------------------------ tables */

/**
 * Finds the header row in a grid (some sheets have a title or blank rows on
 * top) and converts the rest to objects keyed by header.
 */
export function gridToTable(grid) {
  const rowsArray = grid.filter((row) => Array.isArray(row));
  let headerIndex = 0;
  let bestScore = -1;

  rowsArray.slice(0, 15).forEach((row, index) => {
    const cells = row.map((cell) => String(cell ?? "").trim());
    const filled = cells.filter(Boolean);
    if (filled.length < 2) return;
    const textCells = filled.filter((cell) => !/^[\d.,/%: -]+$/.test(cell)).length;
    const mapping = autoMapColumns(filled);
    const recognised = Object.values(mapping).filter((field) => field !== "ignore").length;
    const score = recognised * 3 + textCells + (mapping && Object.values(mapping).includes("title") ? 5 : 0);
    if (score > bestScore) {
      bestScore = score;
      headerIndex = index;
    }
  });

  const rawHeaders = (rowsArray[headerIndex] || []).map((cell) => String(cell ?? "").trim());
  const seen = new Map();
  const headers = rawHeaders.map((header, index) => {
    const base = header || `Column ${index + 1}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count ? `${base} (${count + 1})` : base;
  });

  const rows = rowsArray
    .slice(headerIndex + 1)
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])))
    .filter((row) => Object.values(row).some((value) => String(value ?? "").trim() !== ""));

  // Drop columns that are empty in every row.
  const usedHeaders = headers.filter((header) => rows.some((row) => String(row[header] ?? "").trim() !== ""));

  return { headers: usedHeaders, rows };
}

function tableResult(table, extra = {}) {
  const mapping = autoMapColumns(table.headers, table.rows.slice(0, 20));
  return {
    kind: "table",
    headers: table.headers,
    rows: table.rows,
    mapping,
    quality: mappingQuality(mapping),
    ...extra,
  };
}

/* ------------------------------------------- the app's own export formats */

const OWN_TASK_HEADERS = ["id", "projectid", "title"];

function isOwnTaskTable(headers) {
  const normalized = headers.map((header) => header.toLowerCase());
  return OWN_TASK_HEADERS.every((header) => normalized.includes(header));
}

function ownRowToTask(row) {
  const list = (value) =>
    String(value ?? "")
      .split(/[|,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  return {
    id: cleanText(row.id) || makeId("task"),
    projectId: cleanText(row.projectId),
    sprintId: cleanText(row.sprintId),
    parentTaskId: cleanText(row.parentTaskId),
    dependencyIds: list(row.dependencyIds),
    title: cleanText(row.title, 300),
    owner: cleanText(row.owner),
    priority: normalizePriority(row.priority),
    status: normalizeTaskStatus(row.status, row.actualProgress),
    plannedStart: parseDate(row.plannedStart),
    plannedEnd: parseDate(row.plannedEnd),
    actualStart: parseDate(row.actualStart),
    actualEnd: parseDate(row.actualEnd),
    baselineStart: parseDate(row.baselineStart),
    baselineEnd: parseDate(row.baselineEnd),
    durationDays: parseDurationDays(row.durationDays) || 1,
    plannedProgress: parsePercent(row.plannedProgress),
    actualProgress: parsePercent(row.actualProgress),
    isMilestone: parseBoolean(row.isMilestone),
    notes: cleanText(row.notes, 2000),
  };
}

function ownTasksToPlanner(rows, fileName) {
  const tasks = rows.map(ownRowToTask).filter((task) => task.title);
  const projectIds = [...new Set(tasks.map((task) => task.projectId).filter(Boolean))];
  const fallbackId = projectIds[0] || makeId("project");
  const namesById = new Map();
  rows.forEach((row) => {
    const name = cleanText(row.projectName, 200);
    if (name && row.projectId && !namesById.has(row.projectId)) namesById.set(row.projectId, name);
  });
  const baseName = fileName.replace(/\.[^.]+$/, "") || "Imported project";
  const projects = (projectIds.length ? projectIds : [fallbackId]).map((id, index) => ({
    id,
    name: namesById.get(id) || (projectIds.length > 1 ? `${baseName} ${index + 1}` : baseName),
    status: "Active",
  }));
  const sprints = new Map();
  rows.forEach((row) => {
    const id = cleanText(row.sprintId);
    if (id && !sprints.has(id)) {
      sprints.set(id, {
        id,
        projectId: cleanText(row.projectId) || fallbackId,
        name: cleanText(row.sprintName, 200) || "Sprint",
        startDate: "",
        endDate: "",
        goal: "",
      });
    }
  });

  return {
    projects,
    sprints: [...sprints.values()],
    tasks: tasks.map((task) => ({ ...task, projectId: task.projectId || fallbackId })),
  };
}

/* ---------------------------------------------------------------- readers */

async function readCsv(file) {
  let text = await file.text();
  text = text.replace(/^\uFEFF/, "");
  const parsed = Papa.parse(text, { skipEmptyLines: "greedy", delimiter: "" });
  if (!parsed.data.length) throw new Error("This file is empty.");
  if (parsed.errors?.length && parsed.data.length < 2) {
    throw new Error(`Could not read this CSV file: ${parsed.errors[0].message}`);
  }
  const table = gridToTable(parsed.data);

  if (isOwnTaskTable(table.headers)) {
    return { kind: "planner", label: "Planner task list (CSV)", data: ownTasksToPlanner(table.rows, file.name) };
  }
  return tableResult(table, { label: "CSV table" });
}

function sheetGrid(sheet) {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "", blankrows: false });
}

async function readWorkbook(file) {
  const buffer = await file.arrayBuffer();
  // Dates stay as Excel serial numbers: converting them to JS Date objects
  // can shift them by a day depending on the browser's time zone.
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });

  // The app's own Excel export: Projects / Tasks / Sprints sheets.
  const names = workbook.SheetNames;
  const lower = names.map((name) => name.toLowerCase());
  const tasksSheetName = names[lower.indexOf("tasks")];
  if (tasksSheetName) {
    const taskTable = gridToTable(sheetGrid(workbook.Sheets[tasksSheetName]));
    if (isOwnTaskTable(taskTable.headers)) {
      const projectsName = names[lower.indexOf("projects")];
      const sprintsName = names[lower.indexOf("sprints")];
      const projectRows = projectsName ? gridToTable(sheetGrid(workbook.Sheets[projectsName])).rows : [];
      const sprintRows = sprintsName ? gridToTable(sheetGrid(workbook.Sheets[sprintsName])).rows : [];
      const base = ownTasksToPlanner(taskTable.rows, file.name);
      const projects = projectRows.length
        ? projectRows.map((row) => ({
            id: cleanText(row.id) || makeId("project"),
            name: cleanText(row.name, 200) || "Imported project",
            owner: cleanText(row.owner),
            description: cleanText(row.description, 2000),
            status: cleanText(row.status) || "Active",
            startDate: parseDate(row.startDate),
            targetEndDate: parseDate(row.targetEndDate),
          }))
        : base.projects;
      const sprints = sprintRows.map((row) => ({
        id: cleanText(row.id) || makeId("sprint"),
        projectId: cleanText(row.projectId),
        name: cleanText(row.name, 200) || "Sprint",
        startDate: parseDate(row.startDate),
        endDate: parseDate(row.endDate),
        goal: cleanText(row.goal, 500),
      }));
      return {
        kind: "planner",
        label: "Planner workbook (Excel)",
        data: { projects, sprints: sprints.length ? sprints : base.sprints, tasks: base.tasks },
      };
    }
  }

  // Any other workbook: offer every sheet, pre-select the most task-like one.
  const sheets = names
    .map((name) => {
      const table = gridToTable(sheetGrid(workbook.Sheets[name]));
      const mapping = autoMapColumns(table.headers, table.rows.slice(0, 20));
      const recognised = Object.values(mapping).filter((field) => field !== "ignore").length;
      return { name, table, score: recognised * 10 + Math.min(table.rows.length, 500) / 50 };
    })
    .filter((sheet) => sheet.table.rows.length > 0);

  if (!sheets.length) throw new Error("This workbook has no data rows.");
  sheets.sort((a, b) => b.score - a.score);

  const best = sheets[0];
  return tableResult(best.table, {
    label: `Excel sheet "${best.name}"`,
    sheetName: best.name,
    sheets: sheets.map((sheet) => ({ name: sheet.name, headers: sheet.table.headers, rows: sheet.table.rows })),
  });
}

/* ------------------------------------------------------------------- JSON */

function pickName(value) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(pickName).filter(Boolean).join(", ");
  return value.displayName || value.name || value.fullName || value.title || value.value || value.key || value.email || "";
}

/** Flattens nested API objects (Jira, Asana, ClickUp, Linear...) to one level. */
export function flattenRecord(record) {
  const flat = {};
  const visit = (object, prefix, depth) => {
    Object.entries(object || {}).forEach(([key, value]) => {
      const label = prefix && prefix !== "fields" ? `${prefix} ${key}` : key;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const name = pickName(value);
        if (name !== "" && typeof name !== "object") flat[label] = name;
        else if (depth < 2) visit(value, label, depth + 1);
      } else if (Array.isArray(value)) {
        flat[label] = value.map(pickName).filter((item) => item !== "" && typeof item !== "object").join(", ");
      } else {
        flat[label] = value;
      }
    });
  };
  visit(record, "", 0);
  return flat;
}

function findRecordArray(json) {
  if (Array.isArray(json)) return json;
  const preferred = ["tasks", "issues", "items", "data", "records", "rows", "cards", "results", "nodes"];
  for (const key of preferred) {
    if (Array.isArray(json?.[key]) && json[key].some((item) => item && typeof item === "object")) {
      return json[key];
    }
  }
  let best = null;
  Object.values(json || {}).forEach((value) => {
    if (Array.isArray(value) && value.length && typeof value[0] === "object") {
      if (!best || value.length > best.length) best = value;
    }
  });
  return best;
}

function trelloToPlanner(board) {
  const projectId = makeId("project");
  const lists = new Map((board.lists || []).map((list) => [list.id, list]));
  const members = new Map((board.members || []).map((member) => [member.id, member.fullName || member.username]));
  const labels = new Map((board.labels || []).map((label) => [label.id, label.name || label.color]));
  const tasks = [];

  (board.cards || [])
    .filter((card) => !card.closed && !lists.get(card.idList)?.closed)
    .forEach((card) => {
      const listName = lists.get(card.idList)?.name || "";
      const id = makeId("task");
      const done = Boolean(card.dueComplete) || normalizeTaskStatus(listName) === "Done";
      tasks.push({
        id,
        projectId,
        parentTaskId: "",
        dependencyIds: [],
        title: cleanText(card.name, 300) || "Untitled card",
        owner: (card.idMembers || []).map((memberId) => members.get(memberId)).filter(Boolean).join(", "),
        status: done ? "Done" : normalizeTaskStatus(listName),
        priority: "Medium",
        plannedStart: parseDate(card.start) || parseDate(card.due),
        plannedEnd: parseDate(card.due) || parseDate(card.start),
        actualProgress: done ? 100 : 0,
        notes: cleanText(card.desc, 2000),
        tags: [listName, ...(card.idLabels || []).map((labelId) => labels.get(labelId))].filter(Boolean),
      });

      (board.checklists || [])
        .filter((checklist) => checklist.idCard === card.id)
        .forEach((checklist) => {
          (checklist.checkItems || []).forEach((item) => {
            tasks.push({
              id: makeId("task"),
              projectId,
              parentTaskId: id,
              dependencyIds: [],
              title: cleanText(item.name, 300),
              status: item.state === "complete" ? "Done" : "Not Started",
              priority: "Medium",
              plannedStart: parseDate(item.due),
              plannedEnd: parseDate(item.due),
              actualProgress: item.state === "complete" ? 100 : 0,
            });
          });
        });
    });

  return {
    projects: [{ id: projectId, name: cleanText(board.name, 200) || "Trello board", description: cleanText(board.desc, 2000), status: "Active" }],
    sprints: [],
    tasks,
  };
}

async function readJson(file) {
  let json;
  try {
    json = JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("This JSON file could not be read. It may be damaged or not JSON.");
  }

  if (json && Array.isArray(json.projects) && Array.isArray(json.tasks)) {
    return { kind: "planner", label: "Planner backup (JSON)", data: json };
  }
  if (json && Array.isArray(json.cards) && Array.isArray(json.lists)) {
    return { kind: "planner", label: "Trello board export", data: trelloToPlanner(json) };
  }

  const records = findRecordArray(json);
  if (!records || !records.length) {
    throw new Error("No list of tasks was found in this JSON file.");
  }

  const rows = records.filter((record) => record && typeof record === "object").map(flattenRecord);
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))].slice(0, 80);
  return tableResult({ headers, rows }, { label: "JSON records" });
}

/* -------------------------------------------------------- MS Project XML */

const asArray = (value) => (value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]);

export function msProjectXmlToPlanner(xmlText, fileName = "") {
  const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true });
  let doc;
  try {
    doc = parser.parse(xmlText);
  } catch {
    throw new Error("This XML file could not be read.");
  }
  const project = doc?.Project;
  if (!project?.Tasks) {
    throw new Error("This XML file is not a Microsoft Project export (no <Project><Tasks>).");
  }

  const projectId = makeId("project");
  const resources = new Map(asArray(project.Resources?.Resource).map((resource) => [String(resource.UID), cleanText(resource.Name)]));
  const ownersByTask = new Map();
  asArray(project.Assignments?.Assignment).forEach((assignment) => {
    const name = resources.get(String(assignment.ResourceUID));
    if (!name) return;
    const list = ownersByTask.get(String(assignment.TaskUID)) || [];
    list.push(name);
    ownersByTask.set(String(assignment.TaskUID), list);
  });

  const rawTasks = asArray(project.Tasks.Task).filter(
    (task) => String(task.UID) !== "0" && String(task.IsNull || "0") !== "1" && cleanText(task.Name)
  );
  const idByUid = new Map(rawTasks.map((task) => [String(task.UID), makeId("task")]));
  const idByOutline = new Map(rawTasks.map((task) => [String(task.OutlineNumber || ""), idByUid.get(String(task.UID))]));

  const tasks = rawTasks.map((task) => {
    const outline = String(task.OutlineNumber || "");
    const parentOutline = outline.includes(".") ? outline.split(".").slice(0, -1).join(".") : "";
    const percent = parsePercent(task.PercentComplete);
    const isMilestone = String(task.Milestone) === "1";
    const plannedStart = parseDate(task.Start);
    const plannedEnd = parseDate(task.Finish) || plannedStart;
    return {
      id: idByUid.get(String(task.UID)),
      projectId,
      parentTaskId: parentOutline ? idByOutline.get(parentOutline) || "" : "",
      dependencyIds: asArray(task.PredecessorLink)
        .map((link) => idByUid.get(String(link.PredecessorUID)))
        .filter(Boolean),
      title: cleanText(task.Name, 300),
      owner: (ownersByTask.get(String(task.UID)) || []).join(", "),
      priority: Number(task.Priority) >= 700 ? "High" : Number(task.Priority) && Number(task.Priority) < 300 ? "Low" : "Medium",
      status: normalizeTaskStatus("", percent),
      plannedStart,
      plannedEnd: isMilestone ? plannedStart : plannedEnd,
      actualStart: parseDate(task.ActualStart),
      actualEnd: parseDate(task.ActualFinish),
      baselineStart: parseDate(asArray(task.Baseline)[0]?.Start),
      baselineEnd: parseDate(asArray(task.Baseline)[0]?.Finish),
      durationDays: isMilestone ? 1 : Math.max(1, parseDurationDays(task.Duration) || 1),
      actualProgress: percent,
      plannedProgress: 0,
      isMilestone,
      isSummaryTask: String(task.Summary) === "1",
      wbs: cleanText(task.WBS || outline, 40),
      outlineNumber: outline,
      externalId: String(task.ID || ""),
      externalUid: String(task.UID || ""),
      notes: cleanText(task.Notes, 2000),
    };
  });

  const starts = tasks.map((task) => task.plannedStart).filter(Boolean).sort();
  const ends = tasks.map((task) => task.plannedEnd).filter(Boolean).sort();

  return {
    projects: [
      {
        id: projectId,
        name: cleanText(project.Title || project.Name, 200).replace(/\.xml$/i, "") || fileName.replace(/\.[^.]+$/, "") || "MS Project plan",
        owner: cleanText(project.Manager || project.Author),
        description: "Imported from Microsoft Project.",
        status: "Active",
        startDate: parseDate(project.StartDate) || starts[0] || "",
        targetEndDate: parseDate(project.FinishDate) || ends[ends.length - 1] || "",
      },
    ],
    sprints: [],
    tasks,
  };
}

/* ------------------------------------------------------------------ entry */

/**
 * @param {File} file
 * @param {{ importMpp?: (file: File) => Promise<object> }} options
 */
export async function readImportFile(file, options = {}) {
  if (!file) throw new Error("No file selected.");
  if (file.size > MAX_FILE_BYTES) throw new Error("This file is larger than 25 MB.");
  if (file.size === 0) throw new Error("This file is empty.");

  const ext = fileExtension(file.name);

  if ([".csv", ".tsv", ".txt"].includes(ext)) return readCsv(file);
  if ([".xlsx", ".xlsm", ".xls", ".ods"].includes(ext)) return readWorkbook(file);
  if (ext === ".json") return readJson(file);
  if (ext === ".xml") {
    return { kind: "planner", label: "Microsoft Project XML", data: msProjectXmlToPlanner(await file.text(), file.name) };
  }
  if (ext === ".mpp") {
    if (!options.importMpp) throw new Error("Native .mpp files need the converter server.");
    const data = await options.importMpp(file);
    return { kind: "planner", label: "Microsoft Project (.mpp)", data };
  }

  throw new Error(
    `"${ext || file.name}" files are not supported. Use Excel, CSV, JSON, MS Project XML or .mpp.`
  );
}

export { normalizeHeader };
