// Export formats. All of them run in the browser.

import * as XLSX from "xlsx";
import Papa from "papaparse";
import { XMLBuilder } from "fast-xml-parser";

export function triggerDownload(content, filename, mimeType) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFileName(value, fallback = "planner") {
  const cleaned = String(value || fallback)
    .trim()
    .replace(/[^a-z0-9-_ ]/gi, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
  return cleaned || fallback;
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

/** Restricts a workspace to some projects (empty list = everything). */
export function scopeWorkspace(workspace, projectIds = []) {
  if (!projectIds.length) return workspace;
  const keep = new Set(projectIds);
  const byProject = (item) => keep.has(item.projectId);
  return {
    ...workspace,
    projects: workspace.projects.filter((project) => keep.has(project.id)),
    sprints: (workspace.sprints || []).filter(byProject),
    tasks: (workspace.tasks || []).filter(byProject),
    baselineSnapshots: (workspace.baselineSnapshots || []).filter((snapshot) => !snapshot.projectId || keep.has(snapshot.projectId)),
    weeklyReports: (workspace.weeklyReports || []).filter(byProject),
    projectDocuments: (workspace.projectDocuments || []).filter(byProject),
  };
}

/* ------------------------------------------------------------- JSON backup */

export function buildJsonBackup(workspace) {
  return JSON.stringify(
    {
      format: "project-planner-backup",
      version: 2,
      exportedAt: new Date().toISOString(),
      projects: workspace.projects || [],
      sprints: workspace.sprints || [],
      tasks: workspace.tasks || [],
      plannerSettings: workspace.plannerSettings || { schedulingMode: "manual" },
      baselineSnapshots: workspace.baselineSnapshots || [],
      weeklyReports: workspace.weeklyReports || [],
      projectDocuments: workspace.projectDocuments || [],
    },
    null,
    2
  );
}

/* ------------------------------------------------------- CSV / Excel rows */

export function taskRows(workspace) {
  const projectNames = Object.fromEntries((workspace.projects || []).map((project) => [project.id, project.name]));
  const sprintNames = Object.fromEntries((workspace.sprints || []).map((sprint) => [sprint.id, sprint.name]));
  const titles = Object.fromEntries((workspace.tasks || []).map((task) => [task.id, task.title]));

  return (workspace.tasks || []).map((task) => ({
    id: task.id || "",
    projectId: task.projectId || "",
    projectName: projectNames[task.projectId] || "",
    sprintId: task.sprintId || "",
    sprintName: sprintNames[task.sprintId] || "",
    parentTaskId: task.parentTaskId || "",
    parentTitle: titles[task.parentTaskId] || "",
    dependencyIds: (task.dependencyIds || []).join("|"),
    title: task.title || "",
    owner: task.owner || "",
    priority: task.priority || "Medium",
    status: task.status || "Not Started",
    plannedStart: task.plannedStart || "",
    plannedEnd: task.plannedEnd || "",
    actualStart: task.actualStart || "",
    actualEnd: task.actualEnd || "",
    baselineStart: task.baselineStart || "",
    baselineEnd: task.baselineEnd || "",
    durationDays: Number(task.durationDays || 1),
    plannedProgress: Number(task.plannedProgress || 0),
    actualProgress: Number(task.actualProgress || 0),
    isMilestone: task.isMilestone ? "TRUE" : "FALSE",
    notes: task.notes || "",
  }));
}

export function buildCsv(workspace) {
  // Byte order mark so Excel opens UTF-8 (accents, emoji) correctly.
  return `\uFEFF${Papa.unparse(taskRows(workspace))}`;
}

export function buildWorkbook(workspace) {
  const workbook = XLSX.utils.book_new();
  const projects = (workspace.projects || []).map((project) => ({
    id: project.id,
    name: project.name,
    owner: project.owner || "",
    description: project.description || "",
    status: project.status || "Active",
    startDate: project.startDate || "",
    targetEndDate: project.targetEndDate || "",
  }));
  const sprints = (workspace.sprints || []).map((sprint) => ({
    id: sprint.id,
    projectId: sprint.projectId,
    name: sprint.name,
    startDate: sprint.startDate || "",
    endDate: sprint.endDate || "",
    goal: sprint.goal || "",
  }));

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(projects), "Projects");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(taskRows(workspace)), "Tasks");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sprints), "Sprints");
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([{ schedulingMode: workspace.plannerSettings?.schedulingMode || "manual" }]),
    "Settings"
  );
  return workbook;
}

/* ----------------------------------------------------- MS Project XML */

function hierarchyOrder(tasks) {
  const ids = new Set(tasks.map((task) => task.id));
  const children = new Map();
  tasks.forEach((task) => {
    const parent = ids.has(task.parentTaskId) ? task.parentTaskId : "";
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(task);
  });

  const ordered = [];
  const visit = (parentId, prefix, level) => {
    (children.get(parentId) || []).forEach((task, index) => {
      const outline = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
      ordered.push({ task, outline, level, hasChildren: children.has(task.id) });
      visit(task.id, outline, level + 1);
    });
  };
  visit("", "", 1);
  return ordered;
}

export function buildMsProjectXml(workspace) {
  const projects = workspace.projects || [];
  const multiple = projects.length > 1;

  // With several projects, each becomes a top-level summary task.
  const tasks = [
    ...(multiple
      ? projects.map((project) => ({ id: `__project_${project.id}`, title: project.name, parentTaskId: "", projectId: project.id }))
      : []),
    ...(workspace.tasks || []).map((task) => ({
      ...task,
      parentTaskId: task.parentTaskId || (multiple ? `__project_${task.projectId}` : ""),
    })),
  ];

  const ordered = hierarchyOrder(tasks);
  const uidById = new Map(ordered.map((entry, index) => [entry.task.id, index + 1]));

  const owners = [...new Set((workspace.tasks || []).flatMap((task) => String(task.owner || "").split(",").map((name) => name.trim()).filter(Boolean)))];
  const resourceUid = new Map(owners.map((name, index) => [name, index + 1]));

  const dt = (date, time) => (date ? `${date}T${time}` : undefined);

  const xmlTasks = ordered.map(({ task, outline, level, hasChildren }) => {
    const days = Math.max(task.isMilestone ? 0 : 1, Number(task.durationDays || 1));
    const entry = {
      UID: uidById.get(task.id),
      ID: uidById.get(task.id),
      Name: task.title || "Task",
      Type: 1,
      IsNull: 0,
      WBS: task.wbs || outline,
      OutlineNumber: outline,
      OutlineLevel: level,
      Start: dt(task.plannedStart, "08:00:00"),
      Finish: dt(task.plannedEnd || task.plannedStart, task.isMilestone ? "08:00:00" : "17:00:00"),
      Duration: `PT${days * 8}H0M0S`,
      DurationFormat: 7,
      Milestone: task.isMilestone ? 1 : 0,
      Summary: hasChildren ? 1 : 0,
      PercentComplete: Math.round(Number(task.actualProgress || 0)),
      ActualStart: dt(task.actualStart, "08:00:00"),
      ActualFinish: dt(task.actualEnd, "17:00:00"),
      Notes: task.notes || undefined,
    };
    const links = (task.dependencyIds || [])
      .map((id) => uidById.get(id))
      .filter(Boolean)
      .map((uid) => ({ PredecessorUID: uid, Type: 1 }));
    if (links.length) entry.PredecessorLink = links;
    return entry;
  });

  let assignmentUid = 0;
  const assignments = [];
  ordered.forEach(({ task }) => {
    String(task.owner || "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .forEach((name) => {
        assignmentUid += 1;
        assignments.push({ UID: assignmentUid, TaskUID: uidById.get(task.id), ResourceUID: resourceUid.get(name), Units: 1 });
      });
  });

  const starts = (workspace.tasks || []).map((task) => task.plannedStart).filter(Boolean).sort();
  const title = multiple ? "Project portfolio" : projects[0]?.name || "Project plan";

  const document = {
    "?xml": { "@_version": "1.0", "@_encoding": "UTF-8", "@_standalone": "yes" },
    Project: {
      "@_xmlns": "http://schemas.microsoft.com/project",
      Name: `${title}.xml`,
      Title: title,
      Manager: multiple ? undefined : projects[0]?.owner || undefined,
      StartDate: dt(projects[0]?.startDate || starts[0], "08:00:00"),
      ScheduleFromStart: 1,
      MinutesPerDay: 480,
      MinutesPerWeek: 2400,
      DaysPerMonth: 20,
      Tasks: { Task: xmlTasks },
      Resources: { Resource: owners.map((name) => ({ UID: resourceUid.get(name), ID: resourceUid.get(name), Name: name, Type: 1 })) },
      Assignments: { Assignment: assignments },
    },
  };

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    suppressEmptyNode: true,
    suppressUnpairedNode: false,
  });
  return builder.build(document);
}

/* -------------------------------------------------------------- iCalendar */

function icsEscape(text) {
  return String(text || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function icsDate(iso, offsetDays = 0) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + offsetDays));
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

/** Calendar file with milestones and task due dates (opens in Outlook, Google, Apple). */
export function buildIcs(workspace, { milestonesOnly = false } = {}) {
  const projectNames = Object.fromEntries((workspace.projects || []).map((project) => [project.id, project.name]));
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Project Planner//EN", "CALSCALE:GREGORIAN"];

  (workspace.tasks || [])
    .filter((task) => (milestonesOnly ? task.isMilestone : true))
    .filter((task) => task.plannedEnd || task.plannedStart)
    .forEach((task) => {
      const due = task.plannedEnd || task.plannedStart;
      const start = task.isMilestone ? due : task.plannedStart || due;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${task.id}@project-planner`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${icsDate(start)}`,
        `DTEND;VALUE=DATE:${icsDate(due, 1)}`,
        `SUMMARY:${icsEscape(`${task.isMilestone ? "◆ " : ""}${task.title}`)}`,
        `DESCRIPTION:${icsEscape(`${projectNames[task.projectId] || ""}${task.owner ? ` · ${task.owner}` : ""} · ${task.status}`)}`,
        "END:VEVENT"
      );
    });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/* ------------------------------------------------------------- dispatcher */

export const EXPORT_FORMATS = [
  { id: "json", label: "Full backup (JSON)", description: "Everything, including reports and documents. Use this to restore or move your workspace.", ext: "json" },
  { id: "xlsx", label: "Excel workbook", description: "Projects, tasks and sprints on separate sheets. Re-imports without loss.", ext: "xlsx" },
  { id: "csv", label: "CSV task list", description: "One row per task. Opens in any spreadsheet or BI tool.", ext: "csv" },
  { id: "msproject", label: "Microsoft Project XML", description: "Open in Microsoft Project, ProjectLibre, GanttProject or Smartsheet.", ext: "xml" },
  { id: "ics", label: "Calendar (.ics)", description: "Milestones and due dates for Outlook, Google or Apple Calendar.", ext: "ics" },
];

export function exportWorkspace(workspace, formatId, baseName) {
  const name = `${safeFileName(baseName)}-${stamp()}`;
  switch (formatId) {
    case "json":
      return triggerDownload(buildJsonBackup(workspace), `${name}.json`, "application/json");
    case "csv":
      return triggerDownload(buildCsv(workspace), `${name}.csv`, "text/csv;charset=utf-8");
    case "xlsx":
      return XLSX.writeFile(buildWorkbook(workspace), `${name}.xlsx`);
    case "msproject":
      return triggerDownload(buildMsProjectXml(workspace), `${name}.xml`, "application/xml");
    case "ics":
      return triggerDownload(buildIcs(workspace), `${name}.ics`, "text/calendar;charset=utf-8");
    default:
      throw new Error(`Unknown export format: ${formatId}`);
  }
}
