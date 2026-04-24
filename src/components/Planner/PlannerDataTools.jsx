import { useRef } from "react";
import { Download, Upload, DatabaseBackup } from "lucide-react";

export default function PlannerDataTools({
  exportData,
  onImportData,
}) {
  const fileInputRef = useRef(null);

  function handleExport() {
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "planner-data-export.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        onImportData(parsed);
        alert("Planner data imported successfully.");
      } catch {
        alert("Invalid JSON file.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        <DatabaseBackup className="h-3.5 w-3.5" />
        Data Tools
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <Download className="h-4 w-4" />
          Export
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
        >
          <Upload className="h-4 w-4" />
          Import
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}