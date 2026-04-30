import { useRef, useState } from "react";
import { Download, FileUp, Info } from "lucide-react";
import {
  exportMsProjectXml,
  importMsProjectFile,
} from "../../services/msProjectService";

export default function PlannerMsProjectTools({ exportData, onImportData }) {
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleImport(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setLoading(true);
      setMessage("");

      const plannerData = await importMsProjectFile(file);
      onImportData(plannerData);

      setMessage("MS Project XML imported successfully.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  async function handleExport() {
    try {
      setLoading(true);
      setMessage("");

      await exportMsProjectXml(exportData);

      setMessage("MS Project XML exported successfully.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-purple-700">
            <Info className="h-3.5 w-3.5" />
            MS Project Compatibility
          </div>

          <h3 className="mt-3 text-base font-semibold tracking-tight text-slate-900">
            Import / Export Microsoft Project XML
          </h3>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Use XML for Microsoft Project compatibility. Native .mpp import will
            need the Java MPXJ converter in the next step.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileUp className="h-4 w-4" />
            Import XML
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            Export XML
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xml,.mpp"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>

      {message ? (
        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          {message}
        </div>
      ) : null}
    </section>
  );
}