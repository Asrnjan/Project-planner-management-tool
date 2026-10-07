import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { buildWeeklyReportInput } from "../../domain/aiContext";
import { getAiStatus, runAi } from "../../services/aiService";
import { usePlannerStore } from "../../store/usePlannerStore";
import { notify } from "../../ui/feedback";
import { describeUsage } from "./useAiJob";

/** Fills the weekly report form with a Claude draft the manager then edits. */
export default function AiDraftReportButton({ project, previousReport, onDraft, label = "Generate report with Claude" }) {
  const tasks = usePlannerStore((state) => state.tasks);
  const sprints = usePlannerStore((state) => state.sprints);
  const [loading, setLoading] = useState(false);

  async function draft() {
    if (!project) return;
    setLoading(true);
    try {
      const status = await getAiStatus();
      if (!status.configured) {
        notify.warning("Claude isn't connected on this server. See Help & Guide to enable it.");
        return;
      }
      const response = await runAi(
        "weekly_report",
        buildWeeklyReportInput(project, tasks, sprints, previousReport)
      );
      onDraft(response.result);
      notify.success(`Report written by Claude (${describeUsage(response)}). Review every section before submitting.`);
    } catch (error) {
      notify.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={draft}
      disabled={loading}
      data-testid="ai-draft-report"
      className="inline-flex w-fit items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      {loading ? "Claude is writing the report..." : label}
    </button>
  );
}
