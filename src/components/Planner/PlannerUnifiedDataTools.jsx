import { useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileInput,
  FileOutput,
  Info,
  Upload,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  exportMsProjectXml,
  importMsProjectFile,
} from "../../services/msProjectService";

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

function downloadText(filename, text, mimeType = "text/plain") {
  const blob = new Blob([text], {
    type: mimeType,
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

function cleanFileName(value, fallback = "planner-export") {
  return String(value || fallback)
    .replace(/[^a-z0-9-_]/gi, "_")
    .toLowerCase();
}

function getBaseFileName(exportData) {
  const firstProjectName = exportData?.projects?.[0]?.name || "planner-export";
  return cleanFileName(firstProjectName);
}

function csvEscape(value) {
  const text = String(value ?? "");

  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function rowsToCsv(rows) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);

  return [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => csvEscape(row[header])).join(",")
    ),
  ].join("\n");
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);

  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = [];
    let current = "";
    let insideQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const nextChar = line[index + 1];

      if (char === '"' && insideQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === "," && !insideQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    values.push(current);

    return headers.reduce((row, header, index) => {
      row[header] = values[index] || "";
      return row;
    }, {});
  });
}

function taskToRow(task) {
  return {
    id: task.id || "",
    projectId: task.projectId || "",
    sprintId: task.sprintId || "",
    parentTaskId: task.parentTaskId || "",
    dependencyIds: Array.isArray(task.dependencyIds)
      ? task.dependencyIds.join("|")
      : "",
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
    plannedProgress: Number(task.plannedProgress || 0),
    actualProgress: Number(task.actualProgress || 0),
    isMilestone: task.isMilestone ? "TRUE" : "FALSE",
  };
}

function rowToTask(row, index) {
  return {
    id: row.id || `task-csv-${Date.now()}-${index}`,
    projectId: row.projectId || "",
    sprintId: row.sprintId || "",
    parentTaskId: row.parentTaskId || "",
    dependencyIds: row.dependencyIds
      ? String(row.dependencyIds)
          .split("|")
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
    title: row.title || row.Task || row.task || `Imported Task ${index + 1}`,
    owner: row.owner || "",
    priority: row.priority || "Medium",
    status: row.status || "Not Started",
    plannedStart: row.plannedStart || row.start || row.Start || "",
    plannedEnd: row.plannedEnd || row.end || row.End || "",
    actualStart: row.actualStart || "",
    actualEnd: row.actualEnd || "",
    baselineStart: row.baselineStart || "",
    baselineEnd: row.baselineEnd || "",
    plannedProgress: Number(row.plannedProgress || row.progress || 0),
    actualProgress: Number(row.actualProgress || 0),
    isMilestone:
      String(row.isMilestone || "").toLowerCase() === "true" ||
      String(row.isMilestone || "") === "1",
  };
}

function projectToRow(project) {
  return {
    id: project.id || "",
    name: project.name || "",
    owner: project.owner || "",
    description: project.description || "",
    status: project.status || "Active",
    startDate: project.startDate || "",
    targetEndDate: project.targetEndDate || "",
  };
}

function rowToProject(row, index) {
  return {
    id: row.id || `project-xlsx-${Date.now()}-${index}`,
    name:
      row.name || row.Project || row.project || `Imported Project ${index + 1}`,
    owner: row.owner || "",
    description: row.description || "",
    status: row.status || "Active",
    startDate: row.startDate || "",
    targetEndDate: row.targetEndDate || "",
  };
}

function sprintToRow(sprint) {
  return {
    id: sprint.id || "",
    projectId: sprint.projectId || "",
    name: sprint.name || "",
    startDate: sprint.startDate || "",
    endDate: sprint.endDate || "",
    goal: sprint.goal || "",
  };
}

function rowToSprint(row, index) {
  return {
    id: row.id || `sprint-xlsx-${Date.now()}-${index}`,
    projectId: row.projectId || "",
    name:
      row.name || row.Sprint || row.sprint || `Imported Sprint ${index + 1}`,
    startDate: row.startDate || "",
    endDate: row.endDate || "",
    goal: row.goal || "",
  };
}

function getAcceptedFileTypes(format) {
  if (format === "json") return ".json";
  if (format === "xlsx") return ".xlsx,.xls";
  if (format === "csv") return ".csv";
  if (format === "msproject") return ".mpp,.xml";
  return "*";
}

function formatLabel(format) {
  if (format === "json") return "Planner Backup JSON";
  if (format === "xlsx") return "Excel Workbook XLSX";
  if (format === "csv") return "CSV Task List";
  if (format === "msproject") return "Microsoft Project MPP/XML";
  return "Selected Format";
}

export default function PlannerUnifiedDataTools({ exportData, onImportData }) {
  const fileInputRef = useRef(null);

  const [format, setFormat] = useState("json");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function importJson(file) {
    const text = await file.text();
    const parsed = JSON.parse(text);

    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      sprints: Array.isArray(parsed.sprints) ? parsed.sprints : [],
      plannerSettings:
        parsed.plannerSettings && typeof parsed.plannerSettings === "object"
          ? parsed.plannerSettings
          : { schedulingMode: "manual" },
      baselineSnapshots: Array.isArray(parsed.baselineSnapshots)
        ? parsed.baselineSnapshots
        : [],
    };
  }

  async function importCsv(file) {
    const text = await file.text();
    const rows = parseCsv(text);
    const tasks = rows.map(rowToTask);

    const projectId =
      tasks.find((task) => task.projectId)?.projectId ||
      `project-csv-${Date.now()}`;

    const normalizedTasks = tasks.map((task) => ({
      ...task,
      projectId: task.projectId || projectId,
    }));

    const project = {
      id: projectId,
      name: file.name.replace(/\.[^/.]+$/, "") || "Imported CSV Project",
      owner: "",
      description: "Imported from CSV task list.",
      status: "Active",
      startDate:
        normalizedTasks
          .map((task) => task.plannedStart)
          .filter(Boolean)
          .sort()[0] || "",
      targetEndDate:
        normalizedTasks
          .map((task) => task.plannedEnd)
          .filter(Boolean)
          .sort()
          .reverse()[0] || "",
    };

    return {
      projects: [project],
      tasks: normalizedTasks,
      sprints: [],
      plannerSettings: { schedulingMode: "manual" },
      baselineSnapshots: [],
    };
  }

  async function importXlsx(file) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    const projectsSheet = workbook.Sheets.Projects;
    const tasksSheet =
      workbook.Sheets.Tasks || workbook.Sheets[workbook.SheetNames[0]];
    const sprintsSheet = workbook.Sheets.Sprints;
    const settingsSheet = workbook.Sheets.Settings;
    const baselineSheet = workbook.Sheets.Baselines;

    const projectRows = projectsSheet
      ? XLSX.utils.sheet_to_json(projectsSheet)
      : [];
    const taskRows = tasksSheet ? XLSX.utils.sheet_to_json(tasksSheet) : [];
    const sprintRows = sprintsSheet
      ? XLSX.utils.sheet_to_json(sprintsSheet)
      : [];

    const projects = projectRows.map(rowToProject);
    const tasks = taskRows.map(rowToTask);
    const sprints = sprintRows.map(rowToSprint);

    const fallbackProjectId =
      projects[0]?.id ||
      tasks.find((task) => task.projectId)?.projectId ||
      `project-xlsx-${Date.now()}`;

    const finalProjects =
      projects.length > 0
        ? projects
        : [
            {
              id: fallbackProjectId,
              name:
                file.name.replace(/\.[^/.]+$/, "") ||
                "Imported Excel Project",
              owner: "",
              description: "Imported from Excel workbook.",
              status: "Active",
              startDate:
                tasks
                  .map((task) => task.plannedStart)
                  .filter(Boolean)
                  .sort()[0] || "",
              targetEndDate:
                tasks
                  .map((task) => task.plannedEnd)
                  .filter(Boolean)
                  .sort()
                  .reverse()[0] || "",
            },
          ];

    const finalTasks = tasks.map((task) => ({
      ...task,
      projectId: task.projectId || fallbackProjectId,
    }));

    let plannerSettings = { schedulingMode: "manual" };

    if (settingsSheet) {
      const settingsRows = XLSX.utils.sheet_to_json(settingsSheet);
      const firstSettings = settingsRows[0];

      if (firstSettings?.schedulingMode) {
        plannerSettings = {
          schedulingMode: firstSettings.schedulingMode,
        };
      }
    }

    let baselineSnapshots = [];

    if (baselineSheet) {
      baselineSnapshots = XLSX.utils.sheet_to_json(baselineSheet);
    }

    return {
      projects: finalProjects,
      tasks: finalTasks,
      sprints,
      plannerSettings,
      baselineSnapshots,
    };
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    const confirmed = window.confirm(
      "Importing this file will replace your current planner data. Please make sure you have saved your current work. Continue?"
    );

    if (!confirmed) {
      event.target.value = "";
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      let plannerData;

      if (format === "json") {
        plannerData = await importJson(file);
      }

      if (format === "csv") {
        plannerData = await importCsv(file);
      }

      if (format === "xlsx") {
        plannerData = await importXlsx(file);
      }

      if (format === "msproject") {
        plannerData = await importMsProjectFile(file);
      }

      onImportData(plannerData);

      setMessage(
        `Imported ${formatLabel(format)} successfully. Projects: ${
          plannerData.projects?.length || 0
        }, Tasks: ${plannerData.tasks?.length || 0}, Sprints: ${
          plannerData.sprints?.length || 0
        }.`
      );
    } catch (error) {
      setMessage(error.message || "Import failed.");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  async function exportJsonFile() {
    downloadJson(`${getBaseFileName(exportData)}-backup.json`, exportData);
  }

  async function exportCsvFile() {
    const rows = (exportData.tasks || []).map(taskToRow);
    const csv = rowsToCsv(rows);
    downloadText(`${getBaseFileName(exportData)}-tasks.csv`, csv, "text/csv");
  }

  async function exportXlsxFile() {
    const workbook = XLSX.utils.book_new();

    const projectRows = (exportData.projects || []).map(projectToRow);
    const taskRows = (exportData.tasks || []).map(taskToRow);
    const sprintRows = (exportData.sprints || []).map(sprintToRow);
    const settingsRows = [
      {
        schedulingMode: exportData.plannerSettings?.schedulingMode || "manual",
      },
    ];
    const baselineRows = exportData.baselineSnapshots || [];

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(projectRows),
      "Projects"
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(taskRows),
      "Tasks"
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(sprintRows),
      "Sprints"
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(settingsRows),
      "Settings"
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(baselineRows),
      "Baselines"
    );

    XLSX.writeFile(workbook, `${getBaseFileName(exportData)}-planner.xlsx`);
  }

  async function handleExport() {
    try {
      setLoading(true);
      setMessage("");

      if (format === "json") {
        await exportJsonFile();
      }

      if (format === "csv") {
        await exportCsvFile();
      }

      if (format === "xlsx") {
        await exportXlsxFile();
      }

      if (format === "msproject") {
        await exportMsProjectXml(exportData);
      }

      setMessage(`${formatLabel(format)} exported successfully.`);
    } catch (error) {
      setMessage(error.message || "Export failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            <Info className="h-3.5 w-3.5" />
            Data Exchange
          </div>

          <h3 className="mt-2 text-base font-semibold tracking-tight text-slate-900">
            Import or export files
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Select a format, then import or export.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={format}
            onChange={(event) => {
              setFormat(event.target.value);
              setMessage("");
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-slate-400 focus:bg-white"
          >
            <option value="json">Planner Backup JSON</option>
            <option value="xlsx">Excel Workbook XLSX</option>
            <option value="csv">CSV Task List</option>
            <option value="msproject">Microsoft Project MPP/XML</option>
          </select>

          <button
            type="button"
            onClick={openFilePicker}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            Import
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            Export
          </button>

          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {showDetails ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            Details
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept={getAcceptedFileTypes(format)}
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>

      {showDetails ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            <div className="mb-1 inline-flex items-center gap-1.5 font-semibold text-slate-800">
              <FileInput className="h-3.5 w-3.5" />
              Import
            </div>

            <div>
              JSON, XLSX, CSV, MPP, and MS Project XML are supported.
              Importing replaces the current planner data after confirmation.
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            <div className="mb-1 inline-flex items-center gap-1.5 font-semibold text-slate-800">
              <FileOutput className="h-3.5 w-3.5" />
              Export
            </div>

            <div>
              Export supports JSON, XLSX, CSV, and MS Project XML. Native MPP
              export is not included; MS Project XML can be opened in Microsoft
              Project.
            </div>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          {message}
        </div>
      ) : null}
    </section>
  );
}