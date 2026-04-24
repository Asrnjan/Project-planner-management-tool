const STORAGE_KEY = "gantt-planner-data-v1";

export function loadPlannerData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      sprints: Array.isArray(parsed.sprints) ? parsed.sprints : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      plannerSettings:
        parsed.plannerSettings && typeof parsed.plannerSettings === "object"
          ? parsed.plannerSettings
          : { schedulingMode: "manual" },
      baselineSnapshots: Array.isArray(parsed.baselineSnapshots)
        ? parsed.baselineSnapshots
        : [],
    };
  } catch (error) {
    console.error("Failed to load planner data:", error);
    return null;
  }
}

export function savePlannerData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save planner data:", error);
  }
}

export function clearPlannerData() {
  localStorage.removeItem(STORAGE_KEY);
}