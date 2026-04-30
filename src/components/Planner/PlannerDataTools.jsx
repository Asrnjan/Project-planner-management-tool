import { useMemo, useRef, useState } from "react";
import {
  Download,
  Upload,
  DatabaseBackup,
  ChevronDown,
  FileJson,
  FileSpreadsheet,
  Sheet,
  FileCode2,
  AlertTriangle,
  CheckCircle2,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import {
  downloadJsonExport,
  downloadCsvExport,
  downloadXlsxExport,
  downloadMsProjectXmlExport,
  importByFormat,
  buildImportPreview,
  buildImportWarnings,
} from "../../services/importExport";

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function WarningList({ warnings }) {
  if (!warnings.length) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
        <AlertTriangle className="h-3.5 w-3.5" />
        Import Notes
      </div>
      <div className="space-y-1.5">
        {warnings.map((warning, index) => (
          <div key={index} className="text-xs text-amber-800">
            • {warning}
          </div>
        ))}
      </div>
    </div>
  );
}

function FormatHelp({ format }) {
  const text =
    format === "json"
      ? "Best for full planner backup and restore."
      : format === "csv"
      ? "Best for flat task list exchange and spreadsheet edits."
      : format === "xlsx"
      ? "Best for structured spreadsheet import/export with multiple sheets."
      : "Best for interchange with Microsoft Project style XML schedules.";

  return <div className="text-[11px] text-slate-500">{text}</div>;
}

export default function PlannerDataTools({
  exportData,
  onImportData,
}) {
  const fileInputRef = useRef(null);

  const [importFormat, setImportFormat] = useState("json");
  const [importMode, setImportMode] = useState("merge");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const [selectedFileName, setSelectedFileName] = useState("");
  const [pendingImportData, setPendingImportData] = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null);
  const [pendingWarnings, setPendingWarnings] = useState([]);
  const [isPreparingImport, setIsPreparingImport] = useState(false);

  const hasPendingImport = Boolean(pendingImportData);

  const currentCounts = useMemo(() => {
    return {
      projects: Array.isArray(exportData?.projects) ? exportData.projects.length : 0,
      sprints: Array.isArray(exportData?.sprints) ? exportData.sprints.length : 0,
      tasks: Array.isArray(exportData?.tasks) ? exportData.tasks.length : 0,
      milestones: Array.isArray(exportData?.tasks)
        ? exportData.tasks.filter((task) => task.isMilestone).length
        : 0,
    };
  }, [exportData]);

  function handleExportJson() {
    downloadJsonExport(exportData);
    setExportMenuOpen(false);
  }

  function handleExportCsv() {
    downloadCsvExport(exportData);
    setExportMenuOpen(false);
  }

  function handleExportXlsx() {
    downloadXlsxExport(exportData);
    setExportMenuOpen(false);
  }

  function handleExportXml() {
    downloadMsProjectXmlExport(exportData);
    setExportMenuOpen(false);
  }

  function resetPendingImport() {
    setSelectedFileName("");
    setPendingImportData(null);
    setPendingPreview(null);
    setPendingWarnings([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsPreparingImport(true);

    try {
      const imported = await importByFormat(file, importFormat, exportData, importMode);
      const preview = buildImportPreview(exportData, imported);
      const warnings = buildImportWarnings(importFormat, imported, importMode);

      setSelectedFileName(file.name);
      setPendingImportData(imported);
      setPendingPreview(preview);
      setPendingWarnings(warnings);
    } catch (error) {
      alert(error?.message || "Import failed.");
      resetPendingImport();
    } finally {
      setIsPreparingImport(false);
    }
  }

  function applyImport() {
    if (!pendingImportData) return;
    onImportData(pendingImportData);
    alert(`${importFormat.toUpperCase()} imported successfully.`);
    resetPendingImport();
  }

  function getAcceptTypes() {
    if (importFormat === "json") return ".json,application/json";
    if (importFormat === "csv") return ".csv,text/csv";
    if (importFormat === "xlsx") {
      return ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }
    if (importFormat === "xml") return ".xml,text/xml,application/xml";
    return ".json,.csv,.xlsx,.xml";
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        <DatabaseBackup className="h-3.5 w-3.5" />
        Data Tools
      </div>

      <div className="grid gap-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Projects" value={currentCounts.projects} />
          <StatCard label="Sprints" value={currentCounts.sprints} />
          <StatCard label="Tasks" value={currentCounts.tasks} />
          <StatCard label="Milestones" value={currentCounts.milestones} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportMenuOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              Export
              <ChevronDown className="h-4 w-4" />
            </button>

            {exportMenuOpen ? (
              <div className="absolute right-0 z-20 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <FileJson className="h-4 w-4" />
                  Export JSON
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportXlsx}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <Sheet className="h-4 w-4" />
                  Export Excel
                </button>
                <button
                  type="button"
                  onClick={handleExportXml}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <FileCode2 className="h-4 w-4" />
                  Export MS Project XML
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
            <span className="text-[11px] font-medium text-slate-600">Import as</span>
            <select
              value={importFormat}
              onChange={(e) => {
                setImportFormat(e.target.value);
                resetPendingImport();
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="xlsx">Excel</option>
              <option value="xml">MS Project XML</option>
            </select>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
            <span className="text-[11px] font-medium text-slate-600">Mode</span>
            <select
              value={importMode}
              onChange={(e) => {
                setImportMode(e.target.value);
                resetPendingImport();
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
            >
              <option value="merge">Merge</option>
              <option value="replace">Replace</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
          >
            <Upload className="h-4 w-4" />
            {isPreparingImport ? "Reading..." : "Choose File"}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept={getAcceptTypes()}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <FormatHelp format={importFormat} />

        {selectedFileName ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Selected file: <span className="font-medium text-slate-800">{selectedFileName}</span>
          </div>
        ) : null}

        {hasPendingImport && pendingPreview ? (
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Import Preview Ready
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Review the numbers below, then apply the import.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={resetPendingImport}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </button>

                <button
                  type="button"
                  onClick={applyImport}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Apply Import
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Current Data
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <StatCard label="Projects" value={pendingPreview.current.projects} />
                  <StatCard label="Sprints" value={pendingPreview.current.sprints} />
                  <StatCard label="Tasks" value={pendingPreview.current.tasks} />
                  <StatCard label="Milestones" value={pendingPreview.current.milestones} />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  After Import
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <StatCard label="Projects" value={pendingPreview.imported.projects} />
                  <StatCard label="Sprints" value={pendingPreview.imported.sprints} />
                  <StatCard label="Tasks" value={pendingPreview.imported.tasks} />
                  <StatCard label="Milestones" value={pendingPreview.imported.milestones} />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Change Summary
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Projects Δ" value={pendingPreview.delta.projects} />
                <StatCard label="Sprints Δ" value={pendingPreview.delta.sprints} />
                <StatCard label="Tasks Δ" value={pendingPreview.delta.tasks} />
                <StatCard label="Milestones Δ" value={pendingPreview.delta.milestones} />
              </div>
            </div>

            <WarningList warnings={pendingWarnings} />
          </div>
        ) : null}
      </div>
    </div>
  );
}