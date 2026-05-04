const BASE_STORAGE_KEY = "gantt-planner-data-v1";
const ACTIVE_USER_KEY = "gantt-planner-active-user-v1";

function getStorageKey(userId = "") {
  if (!userId) return BASE_STORAGE_KEY;
  return `${BASE_STORAGE_KEY}-${userId}`;
}

export function setActivePlannerUser(userId) {
  try {
    if (userId) {
      localStorage.setItem(ACTIVE_USER_KEY, userId);
    } else {
      localStorage.removeItem(ACTIVE_USER_KEY);
    }
  } catch (error) {
    console.error("Failed to set active planner user:", error);
  }
}

export function getActivePlannerUser() {
  try {
    return localStorage.getItem(ACTIVE_USER_KEY) || "";
  } catch (error) {
    console.error("Failed to get active planner user:", error);
    return "";
  }
}

export function loadPlannerData(userId = "") {
  try {
    const activeUserId = userId || getActivePlannerUser();
    const key = getStorageKey(activeUserId);

    const raw = localStorage.getItem(key);

    if (!raw) {
      return {
        projects: [],
        sprints: [],
        tasks: [],
        plannerSettings: { schedulingMode: "manual" },
        baselineSnapshots: [],
      };
    }

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
      weeklyReports: Array.isArray(parsed.weeklyReports)
        ? parsed.weeklyReports
        : [],
      projectDocuments: Array.isArray(parsed.projectDocuments)
        ? parsed.projectDocuments
        : [],
    };
  } catch (error) {
    console.error("Failed to load planner data:", error);

    return {
      projects: [],
      sprints: [],
      tasks: [],
      plannerSettings: { schedulingMode: "manual" },
      baselineSnapshots: [],
      weeklyReports: [],
      projectDocuments: [],
    };
  }
}

export function savePlannerData(data, userId = "") {
  try {
    const activeUserId = userId || getActivePlannerUser();
    const key = getStorageKey(activeUserId);

    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save planner data:", error);
  }
}

export function clearPlannerData(userId = "") {
  try {
    const activeUserId = userId || getActivePlannerUser();

    if (activeUserId) {
      localStorage.removeItem(getStorageKey(activeUserId));
    } else {
      localStorage.removeItem(BASE_STORAGE_KEY);
    }
  } catch (error) {
    console.error("Failed to clear planner data:", error);
  }
}

export function clearLegacySharedPlannerData() {
  try {
    localStorage.removeItem(BASE_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear legacy shared planner data:", error);
  }
}

export function clearAllPlannerUsersData() {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key === BASE_STORAGE_KEY || key.startsWith(`${BASE_STORAGE_KEY}-`)) {
        localStorage.removeItem(key);
      }
    });

    localStorage.removeItem(ACTIVE_USER_KEY);
  } catch (error) {
    console.error("Failed to clear all planner users data:", error);
  }
}