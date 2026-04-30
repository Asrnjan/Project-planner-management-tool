import * as XLSX from "xlsx";
import { exportPlannerAsJson, importPlannerFromJson } from "./jsonFormat";
import { exportPlannerAsCsv, importPlannerFromCsv } from "./csvFormat";
import { exportPlannerAsXlsx, importPlannerFromXlsx } from "./xlsxFormat";
import {
  exportPlannerAsMsProjectXml,
  importPlannerFromMsProjectXml,
} from "./msProjectXmlFormat";

function triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function uniqueById(items = []) {
  const map = new Map();
  items.forEach((item) => {
    if (!item?.id) return;
    map.set(item.id, item);
  });
  return [...map.values()];
}

function mergePlannerData(existing = {}, imported = {}) {
  return {
    projects: uniqueById([
      ...(Array.isArray(existing.projects) ? existing.projects : []),
      ...(Array.isArray(imported.projects) ? imported.projects : []),
    ]),
    sprints: uniqueById([
      ...(Array.isArray(existing.sprints) ? existing.sprints : []),
      ...(Array.isArray(imported.sprints) ? imported.sprints : []),
    ]),
    tasks: uniqueById([
      ...(Array.isArray(existing.tasks) ? existing.tasks : []),
      ...(Array.isArray(imported.tasks) ? imported.tasks : []),
    ]),
    plannerSettings: {
      ...(existing.plannerSettings || {}),
      ...(imported.plannerSettings || {}),
    },
    baselineSnapshots: uniqueById([
      ...(Array.isArray(existing.baselineSnapshots) ? existing.baselineSnapshots : []),
      ...(Array.isArray(imported.baselineSnapshots) ? imported.baselineSnapshots : []),
    ]),
  };
}

function countMilestones(tasks = []) {
  return tasks.filter((task) => task?.isMilestone).length;
}

export function summarizePlannerData(data = {}) {
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const sprints = Array.isArray(data.sprints) ? data.sprints : [];
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const baselineSnapshots = Array.isArray(data.baselineSnapshots)
    ? data.baselineSnapshots
    : [];

  return {
    projects: projects.length,
    sprints: sprints.length,
    tasks: tasks.length,
    milestones: countMilestones(tasks),
    baselines: baselineSnapshots.length,
  };
}

export function buildImportWarnings(format, importedData, mode) {
  const warnings = [];
  const summary = summarizePlannerData(importedData);

  if (format === "csv") {
    warnings.push("CSV is task-focused and may not preserve full hierarchy fidelity.");
    warnings.push("CSV predecessors are interpreted from row numbers or titles.");
  }

  if (format === "xlsx") {
    warnings.push("Excel import uses Projects, Sprints, and Tasks sheets when present.");
  }

  if (format === "xml") {
    warnings.push("MS Project XML preserves core schedule data, but not every advanced project setting.");
    warnings.push("Sprint mapping may be partial because MS Project XML has no native sprint concept.");
  }

  if (format === "json") {
    warnings.push("JSON is the highest-fidelity backup format for this planner.");
  }

  if (mode === "replace") {
    warnings.push("Replace mode will overwrite the current in-app dataset with the imported dataset.");
  } else {
    warnings.push("Merge mode will append imported records and keep current records.");
  }

  if (summary.tasks === 0) {
    warnings.push("No tasks were found in the selected file.");
  }

  return warnings;
}

export function buildImportPreview(currentData, importedData) {
  const current = summarizePlannerData(currentData);
  const imported = summarizePlannerData(importedData);

  return {
    current,
    imported,
    delta: {
      projects: imported.projects - current.projects,
      sprints: imported.sprints - current.sprints,
      tasks: imported.tasks - current.tasks,
      milestones: imported.milestones - current.milestones,
      baselines: imported.baselines - current.baselines,
    },
  };
}

export function downloadJsonExport(data, filename = "planner-export.json") {
  const content = exportPlannerAsJson(data);
  triggerDownload(content, filename, "application/json");
}

export function downloadCsvExport(data, filename = "planner-tasks.csv") {
  const content = exportPlannerAsCsv(data);
  triggerDownload(content, filename, "text/csv;charset=utf-8;");
}

export function downloadXlsxExport(data, filename = "planner-export.xlsx") {
  const workbook = exportPlannerAsXlsx(data);
  XLSX.writeFile(workbook, filename);
}

export function downloadMsProjectXmlExport(
  data,
  filename = "planner-msproject.xml"
) {
  const content = exportPlannerAsMsProjectXml(data);
  triggerDownload(content, filename, "application/xml");
}

export async function importByFormat(file, format, existingData = {}, mode = "merge") {
  const safeMode = mode === "replace" ? "replace" : "merge";

  if (format === "xlsx") {
    if (safeMode === "replace") {
      return importPlannerFromXlsx(file, {});
    }
    return importPlannerFromXlsx(file, existingData);
  }

  const text = await file.text();

  if (format === "json") {
    const imported = importPlannerFromJson(text);
    if (safeMode === "replace") return imported;
    return mergePlannerData(existingData, imported);
  }

  if (format === "csv") {
    if (safeMode === "replace") {
      return importPlannerFromCsv(text, {});
    }
    return importPlannerFromCsv(text, existingData);
  }

  if (format === "xml") {
    if (safeMode === "replace") {
      return importPlannerFromMsProjectXml(text, {});
    }
    return importPlannerFromMsProjectXml(text, existingData);
  }

  throw new Error(`Unsupported import format: ${format}`);
}