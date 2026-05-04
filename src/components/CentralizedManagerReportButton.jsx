import React, { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { usePlannerStore } from "../store/usePlannerStore";
import { generateCentralizedManagerPpt } from "../utils/centralizedManagerPpt";
import {
  isCurrentUserAdmin,
  loadAllProjectsForCentralizedReport,
} from "../services/projectService";
import {
  loadAllWeeklyReportsForCentralizedReport,
  saveCentralizedReportRecord,
} from "../services/reportService";
import { loadAllProjectDocumentsForCentralizedReport } from "../services/documentService";

export default function CentralizedManagerReportButton() {
  const [isGenerating, setIsGenerating] = useState(false);

  const localProjects = usePlannerStore((state) => state.projects);
  const localTasks = usePlannerStore((state) => state.tasks);
  const localSprints = usePlannerStore((state) => state.sprints);
  const localWeeklyReports = usePlannerStore((state) => state.weeklyReports);
  const localProjectDocuments = usePlannerStore(
    (state) => state.projectDocuments
  );

  async function handleGeneratePpt() {
    try {
      setIsGenerating(true);

      const admin = await isCurrentUserAdmin();

      let projects = localProjects;
      let tasks = localTasks;
      let sprints = localSprints;
      let weeklyReports = localWeeklyReports;
      let projectDocuments = localProjectDocuments;

      if (admin) {
        projects = await loadAllProjectsForCentralizedReport();
        weeklyReports = await loadAllWeeklyReportsForCentralizedReport();
        projectDocuments = await loadAllProjectDocumentsForCentralizedReport();

        const expandedTasks = [];
        const expandedSprints = [];

        projects.forEach((project) => {
          if (Array.isArray(project.tasks)) {
            expandedTasks.push(...project.tasks);
          }

          if (Array.isArray(project.sprints)) {
            expandedSprints.push(...project.sprints);
          }

          if (Array.isArray(project.project_data?.tasks)) {
            expandedTasks.push(...project.project_data.tasks);
          }

          if (Array.isArray(project.project_data?.sprints)) {
            expandedSprints.push(...project.project_data.sprints);
          }
        });

        tasks = expandedTasks.length ? expandedTasks : localTasks;
        sprints = expandedSprints.length ? expandedSprints : localSprints;
      }

      await generateCentralizedManagerPpt({
        projects,
        tasks,
        sprints,
        weeklyReports,
        projectDocuments,
      });

      if (admin) {
        await saveCentralizedReportRecord({
          title: "Centralized Projects Report",
          generatedAt: new Date().toISOString(),
          totalProjects: projects.length,
          totalTasks: tasks.length,
          totalSprints: sprints.length,
          totalWeeklyReports: weeklyReports.length,
          totalProjectDocuments: projectDocuments.length,
          projects,
          tasks,
          sprints,
          weeklyReports,
          projectDocuments,
        });
      }

      if (admin) {
        alert(
          "Centralized PPT generated successfully and centralized report record saved."
        );
      } else {
        alert("Centralized PPT generated successfully for your projects.");
      }
    } catch (error) {
      console.error("Centralized PPT generation failed:", error);
      alert(
        error?.message ||
          "Failed to generate centralized PPT. Please check console for details."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleGeneratePpt}
      disabled={isGenerating}
      style={{
        ...styles.button,
        cursor: isGenerating ? "not-allowed" : "pointer",
        opacity: isGenerating ? 0.75 : 1,
      }}
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
    boxShadow: "0 10px 20px rgba(17,24,39,0.15)",
    whiteSpace: "nowrap",
  },
};