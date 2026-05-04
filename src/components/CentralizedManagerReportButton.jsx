import React, { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { usePlannerStore } from "../store/usePlannerStore";
import { generateCentralizedManagerPpt } from "../utils/centralizedManagerPpt";

export default function CentralizedManagerReportButton() {
  const [isGenerating, setIsGenerating] = useState(false);

  const projects = usePlannerStore((state) => state.projects);
  const tasks = usePlannerStore((state) => state.tasks);
  const sprints = usePlannerStore((state) => state.sprints);
  const weeklyReports = usePlannerStore((state) => state.weeklyReports);
  const projectDocuments = usePlannerStore((state) => state.projectDocuments);

  async function handleGeneratePpt() {
    try {
      setIsGenerating(true);

      await generateCentralizedManagerPpt({
        projects,
        tasks,
        sprints,
        weeklyReports,
        projectDocuments,
      });
    } catch (error) {
      console.error("Centralized PPT generation failed:", error);
      alert("Failed to generate centralized PPT. Please check console for details.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleGeneratePpt}
      disabled={isGenerating}
      style={styles.button}
    >
      {isGenerating ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <FileText size={16} />
      )}

      {isGenerating ? "Generating PPT..." : "Generate Centralized PPT"}
    </button>
  );
}

const styles = {
  button: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: "1px solid #111827",
    background: "#111827",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(17,24,39,0.15)",
    whiteSpace: "nowrap",
  },
};