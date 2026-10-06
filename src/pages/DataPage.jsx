import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  Info,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

import { usePlannerStore } from "../store/usePlannerStore";
import { confirmAction, notify } from "../ui/feedback";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  PageHeader,
  cx,
  inputClass,
} from "../ui/primitives";
import {
  ACCEPTED_EXTENSIONS,
  CONVERTED_EXTENSIONS,
  fileExtension,
  readImportFile,
} from "../services/importExport/readers";
import { FIELD_LABELS, MAPPABLE_FIELDS, autoMapColumns, mappingQuality } from "../services/importExport/columnMapper";
import { rowsToPlannerData } from "../services/importExport/tableToPlanner";
import { EXPORT_FORMATS, exportWorkspace, scopeWorkspace, triggerDownload } from "../services/importExport/exporters";
import { convertProjectFile, getConverterStatus } from "../services/msProjectService";
import { runAi, getAiStatus } from "../services/aiService";
import { buildColumnMappingInput } from "../domain/aiContext";
import { buildSampleWorkspace } from "../data/sampleWorkspace";

const SOURCES = ["Excel", "CSV", "Google Sheets", "Jira", "Asana", "Trello", "Monday.com", "ClickUp", "Smartsheet", "MS Project (.mpp/.xml)", "Primavera P6", "GanttProject", "ProjectLibre", "Planner backups"];

const TEMPLATE_CSV =
  "\uFEFFProject,Task Name,Parent Task,Assigned To,Status,Priority,Start Date,Due Date,% Complete,Milestone,Depends On,Notes\n" +
  "Website Relaunch,Discovery,,Priya,Done,High,2025-01-06,2025-01-17,100,No,,\n" +
  "Website Relaunch,Stakeholder interviews,Discovery,Priya,Done,Medium,2025-01-06,2025-01-10,100,No,,\n" +
  "Website Relaunch,Design sign-off,,Amara,Not Started,High,2025-01-24,2025-01-24,0,Yes,2,Milestone\n";

function summarize(data) {
  const tasks = data?.tasks || [];
  return {
    projects: (data?.projects || []).length,
    sprints: (data?.sprints || []).length,
    tasks: tasks.length,
    milestones: tasks.filter((task) => task.isMilestone).length,
    dated: tasks.filter((task) => task.plannedStart).length,
    reports: (data?.weeklyReports || []).length,
  };
}

function DropZone({ onFile, busy }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      className={cx(
        "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition",
        dragging ? "border-indigo-400 bg-indigo-50" : "border-slate-300 bg-slate-50/50"
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
        {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileUp className="h-6 w-6" />}
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">
        {busy ? "Reading your file..." : "Drop a file here, or choose one"}
      </p>
      <p className="mt-1 max-w-lg text-xs text-slate-500">
        Excel (.xlsx, .xls, .ods), CSV/TSV, JSON, Microsoft Project (.mpp, .xml), Primavera
        (.xer), GanttProject (.gan) or ProjectLibre (.pod). Columns are matched automatically;
        you can adjust them before anything is imported.
      </p>
      <Button className="mt-4" variant="primary" icon={Upload} onClick={() => inputRef.current?.click()} disabled={busy}>
        Choose file
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(",")}
        className="hidden"
        data-testid="import-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      <div className="mt-5 flex flex-wrap justify-center gap-1.5">
        {SOURCES.map((source) => (
          <span key={source} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-500 ring-1 ring-slate-200">
            {source}
          </span>
        ))}
      </div>
    </div>
  );
}

function MappingTable({ parsed, mapping, onChange }) {
  const sample = parsed.rows.slice(0, 3);
  const used = Object.values(mapping).filter((field) => field !== "ignore");

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
          <tr>
            <th className="px-3 py-2">Column in your file</th>
            <th className="px-3 py-2">Example values</th>
            <th className="px-3 py-2">Import as</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {parsed.headers.map((header) => {
            const field = mapping[header] || "ignore";
            return (
              <tr key={header} className={field === "ignore" ? "text-slate-400" : ""}>
                <td className="px-3 py-2 font-medium text-slate-800">{header}</td>
                <td className="max-w-[260px] truncate px-3 py-2 text-xs text-slate-500">
                  {sample.map((row) => String(row[header] ?? "")).filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-3 py-2">
                  <label className="sr-only" htmlFor={`map-${header}`}>
                    Field for {header}
                  </label>
                  <select
                    id={`map-${header}`}
                    value={field}
                    onChange={(event) => onChange(header, event.target.value)}
                    className={cx(inputClass, "py-1.5", field === "title" ? "border-indigo-300 bg-indigo-50" : "")}
                  >
                    {MAPPABLE_FIELDS.map((option) => (
                      <option
                        key={option}
                        value={option}
                        disabled={option !== "ignore" && option !== field && used.includes(option)}
                      >
                        {FIELD_LABELS[option]}
                        {option !== "ignore" && option !== field && used.includes(option) ? " (used)" : ""}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ImportWizard() {
  const navigate = useNavigate();
  const projects = usePlannerStore((state) => state.projects);
  const tasksCount = usePlannerStore((state) => state.tasks.length);
  const importPlannerData = usePlannerStore((state) => state.importPlannerData);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [mapping, setMapping] = useState({});
  const [dateOrder, setDateOrder] = useState("");
  const [mode, setMode] = useState("merge");
  const [targetProjectId, setTargetProjectId] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  async function handleFile(nextFile) {
    setBusy(true);
    setError("");
    setParsed(null);
    try {
      if (CONVERTED_EXTENSIONS.includes(fileExtension(nextFile.name))) {
        const converter = await getConverterStatus();
        if (converter.status === "building") {
          notify.info("Preparing the file converter. This happens once and can take a minute or two...", { duration: 15000 });
        }
      }
      const result = await readImportFile(nextFile, { convertFile: convertProjectFile });
      setFile(nextFile);
      setParsed(result);
      setMapping(result.mapping || {});
      setDateOrder("");
      setTargetProjectId("");
    } catch (err) {
      setError(err.message || "Could not read this file.");
    } finally {
      setBusy(false);
    }
  }

  function selectSheet(name) {
    const sheet = parsed.sheets.find((item) => item.name === name);
    if (!sheet) return;
    const nextMapping = autoMapColumns(sheet.headers, sheet.rows.slice(0, 20));
    setParsed({
      ...parsed,
      headers: sheet.headers,
      rows: sheet.rows,
      sheetName: name,
      label: `Excel sheet "${name}"`,
      mapping: nextMapping,
      quality: mappingQuality(nextMapping),
    });
    setMapping(nextMapping);
  }

  async function askClaudeToMap() {
    setAiBusy(true);
    try {
      const status = await getAiStatus();
      if (!status.configured) {
        notify.warning("Claude isn't connected on this server, so columns stay as matched automatically.");
        return;
      }
      const response = await runAi("map_columns", buildColumnMappingInput(parsed.headers, parsed.rows));
      const next = Object.fromEntries(parsed.headers.map((header) => [header, "ignore"]));
      const usedFields = new Set();
      (response.result.mappings || []).forEach(({ column, field }) => {
        if (!(column in next)) return;
        if (field !== "ignore" && usedFields.has(field)) return;
        next[column] = field;
        if (field !== "ignore") usedFields.add(field);
      });
      setMapping(next);
      notify.success("Claude matched the columns. Check them, then import.");
    } catch (err) {
      notify.error(err.message);
    } finally {
      setAiBusy(false);
    }
  }

  const conversion = useMemo(() => {
    if (!parsed) return null;
    if (parsed.kind === "planner") return { data: parsed.data, warnings: [] };
    try {
      return rowsToPlannerData(parsed.rows, mapping, {
        fileName: file?.name,
        existingProjects: mode === "merge" ? projects : [],
        dateOrder: dateOrder || undefined,
      });
    } catch (err) {
      return { error: err.message };
    }
  }, [parsed, mapping, file, mode, projects, dateOrder]);

  const finalData = useMemo(() => {
    if (!conversion?.data) return null;
    if (!targetProjectId || parsed?.kind !== "table") return conversion.data;
    // Put everything into one existing project.
    return {
      ...conversion.data,
      projects: [],
      sprints: conversion.data.sprints.map((sprint) => ({ ...sprint, projectId: targetProjectId })),
      tasks: conversion.data.tasks.map((task) => ({ ...task, projectId: targetProjectId })),
    };
  }, [conversion, targetProjectId, parsed]);

  const stats = finalData ? summarize(finalData) : null;

  async function runImport() {
    if (!finalData) return;
    if (mode === "replace" && (projects.length || tasksCount)) {
      const ok = await confirmAction({
        title: "Replace your whole workspace?",
        message: `Your ${projects.length} current project(s) and ${tasksCount} task(s) will be removed and replaced by this file. Download a backup first if you might need them.`,
        confirmLabel: "Replace everything",
      });
      if (!ok) return;
    }
    importPlannerData(finalData, { mode });
    notify.success(`Imported ${stats.tasks} tasks${stats.projects ? ` into ${stats.projects} project(s)` : ""}.`);
    const firstProjectId = targetProjectId || finalData.projects?.[0]?.id || finalData.tasks?.[0]?.projectId || "";
    setParsed(null);
    setFile(null);
    navigate(firstProjectId ? `/planner?projectId=${encodeURIComponent(firstProjectId)}&tab=schedule` : "/");
  }

  return (
    <Card>
      <CardHeader icon={Upload} title="Import" subtitle="Bring in a plan from another tool or restore a backup." />
      <div className="space-y-5 px-5 py-4">
        {!parsed ? <DropZone onFile={handleFile} busy={busy} /> : null}

        {error ? (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        ) : null}

        {parsed ? (
          <div className="space-y-5" data-testid="import-review">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
                <div>
                  <div className="text-sm font-semibold text-slate-900">{file?.name}</div>
                  <div className="text-xs text-slate-500">Detected: {parsed.label}</div>
                </div>
              </div>
              <Button size="sm" icon={RotateCcw} onClick={() => { setParsed(null); setFile(null); }}>
                Choose another file
              </Button>
            </div>

            {parsed.kind === "table" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">1. Check the column matches</h3>
                    <p className="text-xs text-slate-500">
                      {parsed.rows.length} rows found. Only "Task name" is required.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {parsed.sheets?.length > 1 ? (
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        Sheet
                        <select value={parsed.sheetName} onChange={(event) => selectSheet(event.target.value)} className={cx(inputClass, "w-auto py-1.5")}>
                          {parsed.sheets.map((sheet) => (
                            <option key={sheet.name}>{sheet.name}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      Dates like 03/04/2025 mean
                      <select value={dateOrder || conversion?.dateOrder || "dmy"} onChange={(event) => setDateOrder(event.target.value)} className={cx(inputClass, "w-auto py-1.5")}>
                        <option value="dmy">3 April</option>
                        <option value="mdy">March 4</option>
                      </select>
                    </label>
                    <Button size="sm" variant="ai" icon={aiBusy ? Loader2 : Sparkles} onClick={askClaudeToMap} disabled={aiBusy}>
                      Ask Claude to match
                    </Button>
                  </div>
                </div>
                <MappingTable
                  parsed={parsed}
                  mapping={mapping}
                  onChange={(header, field) => setMapping((prev) => ({ ...prev, [header]: field }))}
                />
              </div>
            ) : null}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                {parsed.kind === "table" ? "2. " : "1. "}Choose how to import
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { id: "merge", title: "Add to my workspace", text: "Keeps everything you have and adds the imported projects and tasks." },
                  { id: "replace", title: "Replace my workspace", text: "Removes current projects first. Use this to restore a full backup." },
                ].map((option) => (
                  <label
                    key={option.id}
                    className={cx(
                      "flex cursor-pointer gap-3 rounded-xl border p-3",
                      mode === option.id ? (option.id === "replace" ? "border-red-300 bg-red-50" : "border-indigo-300 bg-indigo-50") : "border-slate-200"
                    )}
                  >
                    <input type="radio" name="import-mode" value={option.id} checked={mode === option.id} onChange={() => setMode(option.id)} className="mt-1" />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{option.title}</span>
                      <span className="block text-xs text-slate-600">{option.text}</span>
                    </span>
                  </label>
                ))}
              </div>
              {parsed.kind === "table" && mode === "merge" && projects.length ? (
                <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                  Put all tasks into
                  <select value={targetProjectId} onChange={(event) => setTargetProjectId(event.target.value)} className={cx(inputClass, "w-auto")}>
                    <option value="">{conversion?.data?.projects?.length > 1 ? "the projects named in the file" : "a new project"}</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        existing project: {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            {conversion?.error ? (
              <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{conversion.error}</p>
            ) : null}

            {stats ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">{parsed.kind === "table" ? "3. " : "2. "}Preview</h3>
                <div className="flex flex-wrap gap-2" data-testid="import-stats">
                  <Badge tone="blue">{stats.projects} new project{stats.projects === 1 ? "" : "s"}</Badge>
                  <Badge tone="blue">{stats.tasks} tasks</Badge>
                  <Badge>{stats.dated} with dates</Badge>
                  <Badge>{stats.milestones} milestones</Badge>
                  <Badge>{stats.sprints} sprints</Badge>
                  {stats.reports ? <Badge>{stats.reports} reports</Badge> : null}
                  {conversion.reusedProjects?.length ? <Badge tone="violet">adds to: {conversion.reusedProjects.join(", ")}</Badge> : null}
                </div>
                {conversion.warnings?.length ? (
                  <ul className="space-y-1 text-xs text-amber-800">
                    {conversion.warnings.map((warning) => (
                      <li key={warning} className="flex gap-1.5">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {warning}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 text-left font-semibold text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Task</th>
                        <th className="px-3 py-2">Owner</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Start</th>
                        <th className="px-3 py-2">Due</th>
                        <th className="px-3 py-2">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {finalData.tasks.slice(0, 8).map((task) => (
                        <tr key={task.id}>
                          <td className="max-w-[280px] truncate px-3 py-1.5 font-medium text-slate-800">
                            {task.parentTaskId ? "↳ " : ""}
                            {task.isMilestone ? "◆ " : ""}
                            {task.title}
                          </td>
                          <td className="px-3 py-1.5">{task.owner || "—"}</td>
                          <td className="px-3 py-1.5">{task.status}</td>
                          <td className="px-3 py-1.5">{task.plannedStart || "—"}</td>
                          <td className="px-3 py-1.5">{task.plannedEnd || "—"}</td>
                          <td className="px-3 py-1.5">{task.actualProgress ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={mode === "replace" ? "danger" : "primary"}
                    icon={CheckCircle2}
                    onClick={runImport}
                    disabled={!stats.tasks && !stats.projects}
                    data-testid="import-confirm"
                  >
                    {mode === "replace" ? "Replace and import" : `Import ${stats.tasks} tasks`}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
          Not sure how to lay out your spreadsheet?
          <button
            type="button"
            className="font-semibold text-indigo-600 hover:underline"
            onClick={() => triggerDownload(TEMPLATE_CSV, "project-import-template.csv", "text/csv;charset=utf-8")}
          >
            Download a template
          </button>
        </div>
      </div>
    </Card>
  );
}

function ExportPanel() {
  const state = usePlannerStore();
  const [scope, setScope] = useState("");

  const workspace = {
    projects: state.projects,
    sprints: state.sprints,
    tasks: state.tasks,
    plannerSettings: state.plannerSettings,
    baselineSnapshots: state.baselineSnapshots,
    weeklyReports: state.weeklyReports,
    projectDocuments: state.projectDocuments,
  };

  function run(formatId) {
    try {
      const scoped = scopeWorkspace(workspace, scope ? [scope] : []);
      const name = scope ? state.projects.find((project) => project.id === scope)?.name : "workspace";
      exportWorkspace(scoped, formatId, name);
      notify.success("Export downloaded.");
    } catch (err) {
      notify.error(err.message || "Export failed.");
    }
  }

  return (
    <Card>
      <CardHeader
        icon={Download}
        title="Export"
        subtitle="Download your data in the format you need."
        actions={
          <label className="flex items-center gap-2 text-xs text-slate-600">
            Include
            <select value={scope} onChange={(event) => setScope(event.target.value)} className={cx(inputClass, "w-auto py-1.5")}>
              <option value="">All projects</option>
              {state.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        }
      />
      <ul className="grid gap-3 px-5 py-4 sm:grid-cols-2">
        {EXPORT_FORMATS.map((format) => (
          <li key={format.id} className="flex flex-col rounded-xl border border-slate-200 p-3">
            <div className="text-sm font-semibold text-slate-900">
              {format.label} <span className="font-normal text-slate-400">.{format.ext}</span>
            </div>
            <p className="mt-0.5 flex-1 text-xs text-slate-500">{format.description}</p>
            <Button
              size="sm"
              className="mt-3 self-start"
              icon={Download}
              onClick={() => run(format.id)}
              disabled={!state.projects.length}
              data-testid={`export-${format.id}`}
            >
              Download
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function WorkspacePanel() {
  const storageMode = usePlannerStore((state) => state.storageMode);
  const projects = usePlannerStore((state) => state.projects);
  const importPlannerData = usePlannerStore((state) => state.importPlannerData);

  async function clearAll() {
    const ok = await confirmAction({
      title: "Delete all projects and tasks?",
      message:
        storageMode === "cloud"
          ? "Everything in your account will be deleted, including from the cloud. This cannot be undone."
          : "Everything stored in this browser will be deleted. This cannot be undone.",
      confirmLabel: "Delete everything",
    });
    if (!ok) return;
    importPlannerData(
      { projects: [], sprints: [], tasks: [], baselineSnapshots: [], weeklyReports: [], projectDocuments: [] },
      { mode: "replace" }
    );
    notify.success("Workspace cleared.");
  }

  return (
    <Card>
      <CardHeader icon={Info} title="Workspace" subtitle={storageMode === "cloud" ? "Synced to your account." : "Stored in this browser only."} />
      <div className="space-y-3 px-5 py-4 text-sm text-slate-600">
        {storageMode !== "cloud" ? (
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            Clearing your browser data deletes this workspace. Download a full backup (JSON)
            regularly.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            icon={Sparkles}
            onClick={() => {
              importPlannerData(buildSampleWorkspace(), { mode: "merge" });
              notify.success("Sample projects added.");
            }}
          >
            Add sample projects
          </Button>
          <Button variant="danger" icon={Trash2} onClick={clearAll} disabled={!projects.length}>
            Delete all data
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function DataPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Data"
        title="Import & Export"
        description="Bring plans in from almost any tool, and take your data anywhere. Nothing is imported until you confirm."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1.6fr_1fr]">
        <ImportWizard />
        <div className="space-y-6">
          <ExportPanel />
          <WorkspacePanel />
        </div>
      </div>
    </div>
  );
}
