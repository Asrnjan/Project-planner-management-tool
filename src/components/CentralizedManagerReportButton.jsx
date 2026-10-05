import { useState } from "react";
import { Loader2, Presentation } from "lucide-react";
import { Button } from "../ui/primitives";
import { usePlannerStore } from "../store/usePlannerStore";
import { notify } from "../ui/feedback";
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

        // mapProjectRow spreads project_data onto the row, so project.tasks
        // and project.project_data.tasks are the same list. Reading both
        // counted every task twice.
        projects.forEach((project) => {
          const data = project.project_data || project;

          if (Array.isArray(data.tasks)) {
            expandedTasks.push(...data.tasks);
          }

          if (Array.isArray(data.sprints)) {
            expandedSprints.push(...data.sprints);
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

      notify.success(
        admin
          ? "Portfolio PowerPoint downloaded and saved to the central record."
          : "Portfolio PowerPoint downloaded."
      );
    } catch (error) {
      console.error("Centralized PPT generation failed:", error);
      notify.error(error?.message || "Could not create the PowerPoint. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Button
      onClick={handleGeneratePpt}
      disabled={isGenerating}
      icon={isGenerating ? Loader2 : Presentation}
      title="Download a PowerPoint summarising every project"
    >
      {isGenerating ? "Building slides..." : "Portfolio slides"}
    </Button>
  );
}
