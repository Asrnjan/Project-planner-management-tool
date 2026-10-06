import { create } from "zustand";
import { normalizePriority, normalizeTaskStatus } from "../domain/vocabulary";
import { notify } from "../ui/feedback";
import { changedTaskFields, checkTaskEdit, filterTaskChanges } from "../domain/permissions";
import { getAccess } from "./useAccessStore";
import { fingerprint, mergeProjectPayload } from "../domain/merge";
import {
  loadPlannerData,
  savePlannerData,
  clearPlannerData,
  setActivePlannerUser,
  clearLegacySharedPlannerData,
} from "../utils/storage";

import {
  loadProjects,
  saveProject,
  deleteProject as deleteProjectCloud,
  getCurrentUser,
} from "../services/projectService";

import {
  loadWeeklyReports,
  saveWeeklyReport,
  deleteWeeklyReportCloud,
} from "../services/reportService";

import {
  loadProjectDocuments,
  saveProjectDocument,
  deleteProjectDocumentCloud,
} from "../services/documentService";

// True only when signed in with Supabase. In local mode every change stays
// in this browser and no cloud request is made.
let cloudSyncEnabled = false;

export const LOCAL_USER_ID = "local";

let cloudSaveTimer = null;
let cloudSaveInProgress = false;
let pendingCloudState = null;

function makeId(prefix = "id") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function emptyPlannerData() {
  return {
    projects: [],
    sprints: [],
    tasks: [],
    plannerSettings: {
      schedulingMode: "manual",
    },
    baselineSnapshots: [],
    weeklyReports: [],
    projectDocuments: [],
  };
}

function normalizeProject(project = {}) {
  const timestamp = nowIso();

  return {
    id: project.id || makeId("project"),

    cloudId: project.cloudId || project.dbId || "",
    dbId: project.dbId || project.cloudId || "",

    userId: project.userId || project.user_id || "",

    name: String(project.name ?? "").trim() || "Untitled Project",
    owner: project.owner || "",
    description: project.description || "",
    status: project.status || "Active",
    startDate: project.startDate || "",
    targetEndDate: project.targetEndDate || "",

    createdAt: project.createdAt || timestamp,
    updatedAt: project.updatedAt || timestamp,
  };
}

function normalizeSprint(sprint = {}) {
  const timestamp = nowIso();

  return {
    id: sprint.id || makeId("sprint"),
    userId: sprint.userId || sprint.user_id || "",
    projectId: sprint.projectId || "",
    name: String(sprint.name ?? "").trim() || "Untitled Sprint",
    startDate: sprint.startDate || "",
    endDate: sprint.endDate || "",
    goal: sprint.goal || "",
    createdAt: sprint.createdAt || timestamp,
    updatedAt: sprint.updatedAt || timestamp,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Keeps durationDays consistent with the dates, which are what the timeline
// and analytics read.
function deriveDurationDays(task) {
  const match = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
  if (match(task.plannedStart) && match(task.plannedEnd)) {
    const days =
      Math.round(
        (Date.parse(`${task.plannedEnd}T00:00:00Z`) -
          Date.parse(`${task.plannedStart}T00:00:00Z`)) /
          DAY_MS
      ) + 1;
    if (days > 0) return days;
  }
  return Math.max(1, Number(task.durationDays || 1));
}

function normalizeTask(task = {}) {
  const timestamp = nowIso();

  return {
    id: task.id || makeId("task"),
    userId: task.userId || task.user_id || "",
    projectId: task.projectId || "",
    sprintId: task.sprintId || "",
    parentTaskId: task.parentTaskId || "",
    dependencyIds: Array.isArray(task.dependencyIds) ? task.dependencyIds : [],
    dependencyRules: Array.isArray(task.dependencyRules)
      ? task.dependencyRules
      : [],
    title: String(task.title ?? "").trim() || "Untitled Task",
    owner: task.owner || "",
    priority: normalizePriority(task.priority),
    status: normalizeTaskStatus(task.status, task.actualProgress),
    notes: task.notes || "",
    tags: Array.isArray(task.tags) ? task.tags : [],
    plannedStart: task.plannedStart || "",
    plannedEnd: task.plannedEnd || "",
    actualStart: task.actualStart || "",
    actualEnd: task.actualEnd || "",
    baselineStart: task.baselineStart || "",
    baselineEnd: task.baselineEnd || "",
    plannedProgress: Number(task.plannedProgress || 0),
    actualProgress: Number(task.actualProgress || 0),
    durationDays: deriveDurationDays(task),
    isMilestone: Boolean(task.isMilestone),
    isManualLocked: Boolean(task.isManualLocked),
    isSummaryTask: Boolean(task.isSummaryTask),
    wbs: task.wbs || "",
    outlineNumber: task.outlineNumber || "",
    externalId: task.externalId || "",
    externalUid: task.externalUid || "",
    createdAt: task.createdAt || timestamp,
    updatedAt: task.updatedAt || timestamp,
  };
}

function normalizeWeeklyReport(report = {}) {
  const timestamp = nowIso();

  return {
    id: report.id || makeId("weekly-report"),
    userId: report.userId || report.user_id || "",
    projectId: report.projectId || "",
    reportingWeek: report.reportingWeek || "",
    reportDate: report.reportDate || timestamp.slice(0, 10),
    preparedBy: report.preparedBy || "",
    projectManager: report.projectManager || "",
    clientDepartment: report.clientDepartment || "",
    overallStatus: report.overallStatus || "Green",

    executiveSummary: report.executiveSummary || "",
    leadershipMessage: report.leadershipMessage || "",
    overallHealthNotes: report.overallHealthNotes || "",

    plannedProgress: Number(report.plannedProgress || 0),
    actualProgress: Number(report.actualProgress || 0),
    scheduleVariance: Number(report.scheduleVariance || 0),
    completedTasks: Number(report.completedTasks || 0),
    inProgressTasks: Number(report.inProgressTasks || 0),
    blockedTasks: Number(report.blockedTasks || 0),

    milestonesCompleted: report.milestonesCompleted || "",
    milestonesNextWeek: report.milestonesNextWeek || "",
    achievements: report.achievements || "",
    nextWeekPlan: report.nextWeekPlan || "",

    currentStatus: report.currentStatus || "",
    majorMilestoneAchieved: report.majorMilestoneAchieved || "",
    upcomingMilestone: report.upcomingMilestone || "",
    potentialRisk: report.potentialRisk || "",
    outstandingIssuesJustification:
      report.outstandingIssuesJustification || "",
    challengesFaced: report.challengesFaced || "",
    teamMembers: report.teamMembers || "",

    pocScopeAcceptanceStatus: report.pocScopeAcceptanceStatus || "",
    pocDevelopmentStatus: report.pocDevelopmentStatus || "",
    pocInternalDemoStatus: report.pocInternalDemoStatus || "",
    pocFinalDemoStatus: report.pocFinalDemoStatus || "",
    pocNextSteps: report.pocNextSteps || "",

    proposalStatus: report.proposalStatus || "",
    documentationStatus: report.documentationStatus || "",

    risks: report.risks || "",
    issues: report.issues || "",
    mitigationPlan: report.mitigationPlan || "",

    escalationRequired: report.escalationRequired || "No",
    escalationDetails: report.escalationDetails || "",

    decisionRequired: report.decisionRequired || "No",
    decisionDetails: report.decisionDetails || "",
    decisionImpact: report.decisionImpact || "",
    decisionRequiredBy: report.decisionRequiredBy || "",

    budgetStatus: report.budgetStatus || "On Track",
    plannedBudget: report.plannedBudget || "",
    actualSpend: report.actualSpend || "",
    forecastedSpend: report.forecastedSpend || "",
    costVariance: report.costVariance || "",

    timelineNotes: report.timelineNotes || "",
    supportNeeded: report.supportNeeded || "",
    pmRemarks: report.pmRemarks || "",
    confidenceLevel: report.confidenceLevel || "High",

    submittedAt: report.submittedAt || timestamp,
    createdAt: report.createdAt || timestamp,
    updatedAt: report.updatedAt || timestamp,
  };
}

function normalizeProjectDocument(document = {}) {
  const timestamp = nowIso();

  return {
    id: document.id || makeId("project-doc"),
    userId: document.userId || document.user_id || "",
    projectId: document.projectId || "",
    title: String(document.title ?? "").trim() || "Untitled Document",
    documentType: document.documentType || "Other",
    version: document.version || "1.0",
    owner: document.owner || "",
    status: document.status || "Draft",
    documentUrl: document.documentUrl || "",
    description: document.description || "",
    notes: document.notes || "",
    lastUpdatedDate: document.lastUpdatedDate || timestamp.slice(0, 10),
    createdAt: document.createdAt || timestamp,
    updatedAt: document.updatedAt || timestamp,
  };
}

function normalizePlannerData(data = {}) {
  return {
    projects: Array.isArray(data.projects)
      ? data.projects.map(normalizeProject)
      : [],

    sprints: Array.isArray(data.sprints)
      ? data.sprints.map(normalizeSprint)
      : [],

    tasks: Array.isArray(data.tasks) ? data.tasks.map(normalizeTask) : [],

    plannerSettings:
      data.plannerSettings && typeof data.plannerSettings === "object"
        ? data.plannerSettings
        : { schedulingMode: "manual" },

    baselineSnapshots: Array.isArray(data.baselineSnapshots)
      ? data.baselineSnapshots
      : [],

    weeklyReports: Array.isArray(data.weeklyReports)
      ? data.weeklyReports.map(normalizeWeeklyReport)
      : [],

    projectDocuments: Array.isArray(data.projectDocuments)
      ? data.projectDocuments.map(normalizeProjectDocument)
      : [],
  };
}

function buildWorkspaceFromCloudProjects(cloudProjects = []) {
  const projects = [];
  const sprints = [];
  const tasks = [];
  const baselineSnapshots = [];
  let plannerSettings = { schedulingMode: "manual" };

  cloudProjects.forEach((project) => {
    const projectData =
      project.project_data && typeof project.project_data === "object"
        ? project.project_data
        : project;

    const normalizedProject = normalizeProject({
      ...projectData,
      ...project,
      id: projectData.id || project.id,
      cloudId: project.cloudId || project.dbId || project.id || "",
      dbId: project.dbId || project.cloudId || project.id || "",
      userId: project.userId || project.user_id || projectData.userId || "",
    });

    const alreadyExists = projects.some(
      (existingProject) =>
        existingProject.id === normalizedProject.id ||
        existingProject.cloudId === normalizedProject.cloudId ||
        existingProject.dbId === normalizedProject.dbId
    );

    if (!alreadyExists) {
      projects.push(normalizedProject);
    }

    if (Array.isArray(projectData.sprints)) {
      projectData.sprints.forEach((sprint) => {
        sprints.push(
          normalizeSprint({
            ...sprint,
            userId: project.userId || project.user_id || sprint.userId || "",
          })
        );
      });
    }

    if (Array.isArray(projectData.tasks)) {
      projectData.tasks.forEach((task) => {
        tasks.push(
          normalizeTask({
            ...task,
            userId: project.userId || project.user_id || task.userId || "",
          })
        );
      });
    }

    if (Array.isArray(projectData.baselineSnapshots)) {
      baselineSnapshots.push(...projectData.baselineSnapshots);
    }

    if (
      projectData.plannerSettings &&
      typeof projectData.plannerSettings === "object"
    ) {
      plannerSettings = projectData.plannerSettings;
    }
  });

  return {
    projects,
    sprints,
    tasks,
    plannerSettings,
    baselineSnapshots,
  };
}

function makeWorkspacePayload(state) {
  return {
    projects: state.projects,
    sprints: state.sprints,
    tasks: state.tasks,
    plannerSettings: state.plannerSettings,
    baselineSnapshots: state.baselineSnapshots,
    weeklyReports: state.weeklyReports,
    projectDocuments: state.projectDocuments,
  };
}

function persist(state) {
  savePlannerData(makeWorkspacePayload(state), state.currentUserId || "");
}

// What the server last confirmed for each project: its row id, version
// (updated_at) and the project's data at that point, used to skip unchanged
// projects and to merge when someone else saved in between.
const cloudSync = new Map();

function projectPayload(state, project) {
  return {
    ...project,
    sprints: state.sprints.filter((sprint) => sprint.projectId === project.id),
    tasks: state.tasks.filter((task) => task.projectId === project.id),
    baselineSnapshots: state.baselineSnapshots.filter((snapshot) => !snapshot.projectId || snapshot.projectId === project.id),
    plannerSettings: state.plannerSettings,
    saveType: "single_project_workspace",
  };
}

function rememberSynced(state, cloudProjectRows = []) {
  cloudSync.clear();
  const rowsById = new Map(cloudProjectRows.map((row) => [row.id, row]));
  state.projects.forEach((project) => {
    const row = rowsById.get(project.id);
    if (!row) return;
    const payload = projectPayload(state, project);
    cloudSync.set(project.id, { cloudId: row.cloudId, updatedAt: row.updated_at, base: payload, hash: fingerprint(payload) });
  });
}

function payloadToState(payload) {
  return buildWorkspaceFromCloudProjects([{ ...payload, project_data: payload }]);
}

/** Replaces one project's data in the store with `payload`. */
function replaceProjectInState(projectId, payload) {
  const incoming = payloadToState(payload);
  usePlannerStore.setState((state) => {
    const next = {
      ...state,
      projects: state.projects.some((project) => project.id === projectId)
        ? state.projects.map((project) => (project.id === projectId ? incoming.projects[0] || project : project))
        : [...state.projects, ...incoming.projects],
      tasks: [...state.tasks.filter((task) => task.projectId !== projectId), ...incoming.tasks],
      sprints: [...state.sprints.filter((sprint) => sprint.projectId !== projectId), ...incoming.sprints],
      baselineSnapshots: [
        ...state.baselineSnapshots.filter((snapshot) => snapshot.projectId !== projectId),
        ...incoming.baselineSnapshots.filter((snapshot) => snapshot.projectId === projectId),
      ],
    };
    persist(next);
    return next;
  });
}

function removeProjectFromState(projectId) {
  usePlannerStore.setState((state) => {
    const next = {
      ...state,
      projects: state.projects.filter((project) => project.id !== projectId),
      tasks: state.tasks.filter((task) => task.projectId !== projectId),
      sprints: state.sprints.filter((sprint) => sprint.projectId !== projectId),
    };
    persist(next);
    return next;
  });
}

function canSaveProjectContent() {
  const { permissions } = getAccess();
  return ["projects.edit", "projects.create", "tasks.edit_all", "tasks.edit_assigned", "tasks.create", "tasks.delete"].some(
    (key) => permissions[key]
  );
}

async function saveOneProject(state, project) {
  let payload = projectPayload(state, project);
  let hash = fingerprint(payload);
  let synced = cloudSync.get(project.id);
  if (synced && synced.hash === hash) return;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await saveProject(
      { ...payload, cloudId: synced?.cloudId || project.cloudId || "" },
      { expectedUpdatedAt: synced?.updatedAt || "" }
    );

    if (!result.conflict) {
      cloudSync.set(project.id, { cloudId: result.project.cloudId, updatedAt: result.project.updated_at, base: payload, hash });
      return;
    }

    // Someone else saved this project since we loaded it: merge task by task.
    const theirs = result.latest.project_data || {};
    const { merged, conflicts } = mergeProjectPayload(synced?.base || theirs, payload, theirs);
    cloudSync.set(project.id, {
      cloudId: result.latest.cloudId,
      updatedAt: result.latest.updated_at,
      base: theirs,
      hash: fingerprint(theirs),
    });
    replaceProjectInState(project.id, merged);
    if (conflicts.length) {
      notify.info(
        `${project.name}: someone else changed ${conflicts.length === 1 ? `"${conflicts[0].title}"` : `${conflicts.length} of the same items`} at the same time. Their version was kept.`
      );
    }

    payload = projectPayload(usePlannerStore.getState(), usePlannerStore.getState().projects.find((item) => item.id === project.id) || project);
    hash = fingerprint(payload);
    synced = cloudSync.get(project.id);
    if (synced.hash === hash) return;
  }

  throw new Error(`Could not save ${project.name}; it keeps changing. Your change is kept on this device.`);
}

async function persistCurrentWorkspaceToCloud(state) {
  if (!state.currentUserId || !canSaveProjectContent()) return;

  const results = await Promise.allSettled(state.projects.map((project) => saveOneProject(state, project)));
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length) {
    console.error("Failed to save projects to Supabase:", failed.map((result) => result.reason));
    notify.error(failed[0].reason?.message || "Some changes could not be saved to the cloud. They are kept on this device.");
  }
}

/**
 * Brings in changes other people saved. Projects with unsaved local changes
 * are left alone; their next save merges.
 */
export async function pullCloudChanges() {
  if (!cloudSyncEnabled || cloudSaveTimer || cloudSaveInProgress) return false;
  const rows = await loadProjects();
  const state = usePlannerStore.getState();
  const seen = new Set();
  let changed = false;

  for (const row of rows) {
    const localId = row.id;
    seen.add(localId);
    const synced = cloudSync.get(localId);
    if (synced && synced.updatedAt === row.updated_at) continue;
    const local = state.projects.find((project) => project.id === localId);
    if (local && synced && fingerprint(projectPayload(usePlannerStore.getState(), local)) !== synced.hash) continue;
    const payload = row.project_data || {};
    replaceProjectInState(localId, { ...payload, cloudId: row.cloudId });
    const now = usePlannerStore.getState();
    const project = now.projects.find((item) => item.id === localId);
    if (project) {
      const fresh = projectPayload(now, project);
      cloudSync.set(localId, { cloudId: row.cloudId, updatedAt: row.updated_at, base: fresh, hash: fingerprint(fresh) });
    }
    changed = true;
  }

  for (const [localId, synced] of [...cloudSync.entries()]) {
    if (seen.has(localId)) continue;
    const local = usePlannerStore.getState().projects.find((project) => project.id === localId);
    if (local && fingerprint(projectPayload(usePlannerStore.getState(), local)) !== synced.hash) continue;
    cloudSync.delete(localId);
    removeProjectFromState(localId);
    changed = true;
  }

  return changed;
}

function queueCloudWorkspaceSave(state, delay = 3000) {
  pendingCloudState = {
    ...state,
    projects: [...state.projects],
    sprints: [...state.sprints],
    tasks: [...state.tasks],
    baselineSnapshots: [...state.baselineSnapshots],
    weeklyReports: [...state.weeklyReports],
    projectDocuments: [...state.projectDocuments],
    plannerSettings: { ...state.plannerSettings },
  };

  if (cloudSaveTimer) {
    window.clearTimeout(cloudSaveTimer);
  }

  cloudSaveTimer = window.setTimeout(async () => {
    if (cloudSaveInProgress) {
      queueCloudWorkspaceSave(pendingCloudState, 2000);
      return;
    }

    const stateToSave = pendingCloudState;
    pendingCloudState = null;
    cloudSaveTimer = null;
    cloudSaveInProgress = true;

    try {
      await persistCurrentWorkspaceToCloud(stateToSave);
    } catch (error) {
      console.error("Debounced cloud workspace save failed:", error);
    } finally {
      cloudSaveInProgress = false;

      if (pendingCloudState) {
        queueCloudWorkspaceSave(pendingCloudState, 2000);
      }
    }
  }, delay);
}

export function hasPendingCloudSave() {
  return Boolean(cloudSaveTimer || cloudSaveInProgress);
}

/** Saves any debounced change right away, e.g. before signing out. */
export async function flushPendingCloudSave() {
  if (!cloudSyncEnabled || !cloudSaveTimer || !pendingCloudState) return;

  window.clearTimeout(cloudSaveTimer);
  cloudSaveTimer = null;

  const stateToSave = pendingCloudState;
  pendingCloudState = null;

  try {
    await persistCurrentWorkspaceToCloud(stateToSave);
  } catch (error) {
    console.error("Failed to flush pending cloud save:", error);
  }
}

function persistLocalAndQueueCloud(next, delay = 3000) {
  persist(next);

  if (cloudSyncEnabled) {
    queueCloudWorkspaceSave(next, delay);
  }
}

function cloudOnly(promiseFactory, failureMessage) {
  if (!cloudSyncEnabled) return;

  promiseFactory().catch((error) => {
    console.error(failureMessage, error);
    notify.error(`${failureMessage} Your change is saved on this device.`);
  });
}

const DENIED_MESSAGES = {
  "projects.create": "Your role can't create projects.",
  "projects.edit": "Your role can't change project details, sprints or scheduling.",
  "projects.delete": "Your role can't delete projects.",
  "tasks.create": "Your role can't add tasks.",
  "tasks.delete": "Your role can't delete tasks.",
  "reports.write": "Your role can't write status reports.",
  "documents.manage": "Your role can't change documents.",
  "data.import": "Your role can't import data.",
};

/** Checks the current person's permission; explains when it is missing. */
function allowed(permission) {
  if (getAccess().permissions[permission]) return true;
  notify.error(DENIED_MESSAGES[permission] || "You don't have permission to do that.");
  return false;
}

function reportDenied(denied) {
  if (!denied.length) return;
  const first = denied[0];
  notify.error(
    denied.length === 1
      ? `${first.reason} ("${first.task.title}" was not changed.)`
      : `${first.reason} ${denied.length} changes were not applied.`
  );
}

const initialData = normalizePlannerData(loadPlannerData() || emptyPlannerData());

export const usePlannerStore = create((set, get) => ({
  currentUserId: "",
  storageMode: "local",
  isWorkspaceLoading: false,
  workspaceLoadError: "",

  projects: initialData.projects,
  sprints: initialData.sprints,
  tasks: initialData.tasks,
  plannerSettings: initialData.plannerSettings,
  baselineSnapshots: initialData.baselineSnapshots,
  weeklyReports: initialData.weeklyReports,
  projectDocuments: initialData.projectDocuments,

  initializeLocalWorkspace: () => {
    cloudSyncEnabled = false;
    setActivePlannerUser(LOCAL_USER_ID);

    const localData = normalizePlannerData(loadPlannerData(LOCAL_USER_ID));
    const next = {
      currentUserId: LOCAL_USER_ID,
      storageMode: "local",
      isWorkspaceLoading: false,
      workspaceLoadError: "",
      ...localData,
    };

    set(next);
    return next;
  },

  initializeWorkspaceForCurrentUser: async () => {
    set({
      isWorkspaceLoading: true,
      workspaceLoadError: "",
    });

    try {
      const user = await getCurrentUser();

      if (!user) {
        setActivePlannerUser("");
        clearLegacySharedPlannerData();

        const empty = emptyPlannerData();

        set({
          currentUserId: "",
          isWorkspaceLoading: false,
          ...empty,
        });

        return empty;
      }

      setActivePlannerUser(user.id);
      clearLegacySharedPlannerData();
      cloudSyncEnabled = true;

      const localData = normalizePlannerData(loadPlannerData(user.id));

      const [cloudProjects, cloudReports, cloudDocuments] = await Promise.all([
        loadProjects(),
        loadWeeklyReports({ allUsers: false }),
        loadProjectDocuments({ allUsers: false }),
      ]);

      const cloudWorkspace = buildWorkspaceFromCloudProjects(cloudProjects);

      // The shared workspace on the server is the source of truth; the
      // browser copy is only a cache.
      const next = {
        currentUserId: user.id,
        storageMode: "cloud",
        isWorkspaceLoading: false,
        workspaceLoadError: "",

        projects: cloudWorkspace.projects,
        sprints: cloudWorkspace.sprints,
        tasks: cloudWorkspace.tasks,
        plannerSettings: cloudWorkspace.projects.length ? cloudWorkspace.plannerSettings : localData.plannerSettings,
        baselineSnapshots: cloudWorkspace.baselineSnapshots,

        weeklyReports: Array.isArray(cloudReports)
          ? cloudReports.map(normalizeWeeklyReport)
          : localData.weeklyReports,

        projectDocuments: Array.isArray(cloudDocuments)
          ? cloudDocuments.map(normalizeProjectDocument)
          : localData.projectDocuments,
      };

      set(next);
      rememberSynced(next, cloudProjects);
      savePlannerData(makeWorkspacePayload(next), user.id);

      return next;
    } catch (error) {
      console.error("Failed to initialize user workspace:", error);

      const message =
        error?.message ||
        "Failed to load your workspace. Please refresh and try again.";

      set({
        isWorkspaceLoading: false,
        workspaceLoadError: message,
      });

      throw error;
    }
  },

  clearWorkspaceForLogout: () => {
    cloudSync.clear();
    const userId = get().currentUserId;
    const wasCloud = cloudSyncEnabled;
    cloudSyncEnabled = false;

    if (cloudSaveTimer) {
      window.clearTimeout(cloudSaveTimer);
      cloudSaveTimer = null;
    }

    pendingCloudState = null;

    // Local mode data lives only in this browser, so it is kept on exit.
    if (userId && wasCloud) {
      clearPlannerData(userId);
    }

    setActivePlannerUser("");

    const empty = emptyPlannerData();

    set({
      currentUserId: "",
      isWorkspaceLoading: false,
      workspaceLoadError: "",
      ...empty,
    });
  },

  loadCloudReportsAndDocuments: async () => {
    if (!cloudSyncEnabled) {
      const { weeklyReports, projectDocuments } = get();
      return { weeklyReports, projectDocuments };
    }

    const user = await getCurrentUser();

    if (!user) {
      return {
        weeklyReports: [],
        projectDocuments: [],
      };
    }

    setActivePlannerUser(user.id);

    const [cloudReports, cloudDocuments] = await Promise.all([
      loadWeeklyReports({ allUsers: false }),
      loadProjectDocuments({ allUsers: false }),
    ]);

    set((state) => {
      const next = {
        ...state,
        currentUserId: user.id,
        weeklyReports: Array.isArray(cloudReports)
          ? cloudReports.map(normalizeWeeklyReport)
          : [],
        projectDocuments: Array.isArray(cloudDocuments)
          ? cloudDocuments.map(normalizeProjectDocument)
          : [],
      };

      persist(next);
      return next;
    });

    return {
      weeklyReports: cloudReports,
      projectDocuments: cloudDocuments,
    };
  },

  refreshCloudWorkspace: async () => {
    return get().initializeWorkspaceForCurrentUser();
  },

  setSchedulingMode: (mode) => {
    if (!allowed("projects.edit")) return;
    set((state) => {
      const next = {
        ...state,
        plannerSettings: {
          ...state.plannerSettings,
          schedulingMode: mode,
        },
      };

      persistLocalAndQueueCloud(next);

      return next;
    });
  },

  createBaselineSnapshot: ({ name, projectId = "" }) => {
    if (!allowed("projects.edit")) return;
    set((state) => {
      const scopedTasks = projectId
        ? state.tasks.filter((task) => task.projectId === projectId)
        : state.tasks;

      const snapshot = {
        id: makeId("baseline"),
        name: name?.trim() || `Baseline ${state.baselineSnapshots.length + 1}`,
        projectId,
        createdAt: nowIso(),
        tasks: scopedTasks.map((task) => ({
          id: task.id,
          title: task.title,
          projectId: task.projectId,
          plannedStart: task.plannedStart || "",
          plannedEnd: task.plannedEnd || "",
          plannedProgress: Number(task.plannedProgress || 0),
          baselineStart: task.baselineStart || "",
          baselineEnd: task.baselineEnd || "",
          status: task.status || "",
        })),
      };

      const next = {
        ...state,
        baselineSnapshots: [snapshot, ...state.baselineSnapshots],
      };

      persistLocalAndQueueCloud(next);

      return next;
    });
  },

  /**
   * Loads imported data into the workspace.
   * mode "merge" adds the imported records next to the existing ones.
   * mode "replace" swaps the workspace for the imported data.
   * Weekly reports and documents are kept unless the import carries them.
   */
  importPlannerData: (payload = {}, { mode = "replace" } = {}) => {
    if (!allowed("data.import")) return null;
    const before = get();
    const imported = normalizePlannerData(payload);
    const hasReports = Array.isArray(payload.weeklyReports);
    const hasDocuments = Array.isArray(payload.projectDocuments);

    const mergeById = (existing, incoming) => {
      const map = new Map(existing.map((item) => [item.id, item]));
      incoming.forEach((item) => map.set(item.id, item));
      return [...map.values()];
    };

    let next;

    if (mode === "merge") {
      next = {
        ...before,
        projects: mergeById(before.projects, imported.projects),
        sprints: mergeById(before.sprints, imported.sprints),
        tasks: mergeById(before.tasks, imported.tasks),
        baselineSnapshots: mergeById(
          before.baselineSnapshots,
          imported.baselineSnapshots
        ),
        weeklyReports: mergeById(before.weeklyReports, imported.weeklyReports),
        projectDocuments: mergeById(
          before.projectDocuments,
          imported.projectDocuments
        ),
      };
    } else {
      next = {
        ...before,
        ...imported,
        plannerSettings: payload.plannerSettings
          ? imported.plannerSettings
          : before.plannerSettings,
        weeklyReports: hasReports ? imported.weeklyReports : before.weeklyReports,
        projectDocuments: hasDocuments
          ? imported.projectDocuments
          : before.projectDocuments,
      };
    }

    set(next);
    persistLocalAndQueueCloud(next, 1500);

    // Replacing the workspace must also remove the old projects from the
    // cloud, otherwise they come back on the next sign in.
    if (mode !== "merge") {
      const keptIds = new Set(next.projects.map((project) => project.id));
      before.projects
        .filter((project) => !keptIds.has(project.id))
        .forEach((project) => {
          cloudOnly(
            () => deleteProjectCloud(project),
            `Could not remove "${project.name}" from the cloud.`
          );
        });
    }

    return next;
  },

  addProject: (project) => {
    if (!allowed("projects.create")) return null;
    const timestamp = nowIso();

    const newProject = normalizeProject({
      ...project,
      id: project.id || makeId("project"),
      userId: get().currentUserId,
      createdAt: project.createdAt || timestamp,
      updatedAt: timestamp,
    });

    set((state) => {
      const alreadyExists = state.projects.some((existingProject) => {
        if (existingProject.id === newProject.id) return true;

        if (
          newProject.cloudId &&
          existingProject.cloudId &&
          existingProject.cloudId === newProject.cloudId
        ) {
          return true;
        }

        if (
          newProject.dbId &&
          existingProject.dbId &&
          existingProject.dbId === newProject.dbId
        ) {
          return true;
        }

        return false;
      });

      if (alreadyExists) {
        return state;
      }

      const next = {
        ...state,
        projects: [...state.projects, newProject],
      };

      persist(next);

      return next;
    });

    if (cloudSyncEnabled) {
      // The save queue creates the row and remembers its id and version.
      queueCloudWorkspaceSave(get(), 300);
    }

    return newProject;
  },

  updateProject: (projectId, updates) => {
    if (!allowed("projects.edit")) return;
    set((state) => {
      let updatedProject = null;

      const next = {
        ...state,
        projects: state.projects.map((project) => {
          const isTarget =
            project.id === projectId ||
            project.cloudId === projectId ||
            project.dbId === projectId;

          if (!isTarget) return project;

          updatedProject = normalizeProject({
            ...project,
            ...updates,
            id: project.id,
            cloudId: project.cloudId || updates.cloudId || updates.dbId || "",
            dbId: project.dbId || updates.dbId || updates.cloudId || "",
            userId: project.userId || state.currentUserId,
            createdAt: project.createdAt,
            updatedAt: nowIso(),
          });

          return updatedProject;
        }),
      };

      persistLocalAndQueueCloud(next);

      return next;
    });
  },

  deleteProject: (projectId) => {
    if (!allowed("projects.delete")) return;
    const stateBeforeDelete = get();

    const projectToDelete = stateBeforeDelete.projects.find(
      (project) =>
        project.id === projectId ||
        project.cloudId === projectId ||
        project.dbId === projectId
    );

    const deleteIds = Array.from(
      new Set(
        [
          projectId,
          projectToDelete?.id,
          projectToDelete?.cloudId,
          projectToDelete?.dbId,
        ].filter(Boolean)
      )
    );

    const shouldRemoveProject = (project) =>
      deleteIds.includes(project.id) ||
      deleteIds.includes(project.cloudId) ||
      deleteIds.includes(project.dbId);

    const shouldRemoveByProjectId = (item) =>
      deleteIds.includes(item.projectId);

    set((state) => {
      const next = {
        ...state,

        projects: state.projects.filter(
          (project) => !shouldRemoveProject(project)
        ),

        sprints: state.sprints.filter(
          (sprint) => !shouldRemoveByProjectId(sprint)
        ),

        tasks: state.tasks.filter((task) => !shouldRemoveByProjectId(task)),

        baselineSnapshots: state.baselineSnapshots.filter(
          (snapshot) => !deleteIds.includes(snapshot.projectId)
        ),

        weeklyReports: state.weeklyReports.filter(
          (report) => !shouldRemoveByProjectId(report)
        ),

        projectDocuments: state.projectDocuments.filter(
          (document) => !shouldRemoveByProjectId(document)
        ),
      };

      persist(next);

      return next;
    });

    if (!cloudSyncEnabled) return;

    deleteProjectCloud(projectToDelete || projectId)
      .then(() => {
        const latest = get();

        const latestAfterDelete = {
          ...latest,

          projects: latest.projects.filter(
            (project) => !shouldRemoveProject(project)
          ),

          sprints: latest.sprints.filter(
            (sprint) => !shouldRemoveByProjectId(sprint)
          ),

          tasks: latest.tasks.filter((task) => !shouldRemoveByProjectId(task)),

          baselineSnapshots: latest.baselineSnapshots.filter(
            (snapshot) => !deleteIds.includes(snapshot.projectId)
          ),

          weeklyReports: latest.weeklyReports.filter(
            (report) => !shouldRemoveByProjectId(report)
          ),

          projectDocuments: latest.projectDocuments.filter(
            (document) => !shouldRemoveByProjectId(document)
          ),
        };

        persist(latestAfterDelete);
      })
      .catch((error) => {
        console.error("Failed to delete project from Supabase:", error);

        notify.error(
          "The project was removed here but could not be deleted from the cloud. Please try again later."
        );
      });
  },

  duplicateProject: (projectId) => {
    if (!allowed("projects.create")) return;
    set((state) => {
      const originalProject = state.projects.find(
        (project) =>
          project.id === projectId ||
          project.cloudId === projectId ||
          project.dbId === projectId
      );

      if (!originalProject) return state;

      const newProjectId = makeId("project");
      const timestamp = nowIso();

      const duplicatedProject = normalizeProject({
        ...originalProject,
        id: newProjectId,
        cloudId: "",
        dbId: "",
        userId: state.currentUserId,
        name: `${originalProject.name} Copy`,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      const sprintIdMap = {};
      const duplicatedSprints = state.sprints
        .filter((sprint) => sprint.projectId === originalProject.id)
        .map((sprint) => {
          const newSprintId = makeId("sprint");
          sprintIdMap[sprint.id] = newSprintId;

          return normalizeSprint({
            ...sprint,
            id: newSprintId,
            userId: state.currentUserId,
            projectId: newProjectId,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        });

      const taskIdMap = {};
      const sourceTasks = state.tasks.filter(
        (task) => task.projectId === originalProject.id
      );

      sourceTasks.forEach((task) => {
        taskIdMap[task.id] = makeId("task");
      });

      const duplicatedTasks = sourceTasks.map((task) =>
        normalizeTask({
          ...task,
          id: taskIdMap[task.id],
          userId: state.currentUserId,
          projectId: newProjectId,
          sprintId: sprintIdMap[task.sprintId] || "",
          parentTaskId: taskIdMap[task.parentTaskId] || "",
          dependencyIds: (task.dependencyIds || [])
            .map((id) => taskIdMap[id])
            .filter(Boolean),
          createdAt: timestamp,
          updatedAt: timestamp,
        })
      );

      const duplicatedReports = state.weeklyReports
        .filter((report) => report.projectId === originalProject.id)
        .map((report) =>
          normalizeWeeklyReport({
            ...report,
            id: makeId("weekly-report"),
            userId: state.currentUserId,
            projectId: newProjectId,
            reportingWeek: report.reportingWeek || "",
            submittedAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
        );

      const duplicatedDocuments = state.projectDocuments
        .filter((document) => document.projectId === originalProject.id)
        .map((document) =>
          normalizeProjectDocument({
            ...document,
            id: makeId("project-doc"),
            userId: state.currentUserId,
            projectId: newProjectId,
            title: `${document.title} Copy`,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
        );

      const next = {
        ...state,
        projects: [duplicatedProject, ...state.projects],
        sprints: [...duplicatedSprints, ...state.sprints],
        tasks: [...duplicatedTasks, ...state.tasks],
        weeklyReports: [...duplicatedReports, ...state.weeklyReports],
        projectDocuments: [...duplicatedDocuments, ...state.projectDocuments],
      };

      persistLocalAndQueueCloud(next, 5000);

      return next;
    });
  },

  addSprint: (sprint) => {
    if (!allowed("projects.edit")) return;
    set((state) => {
      const newSprint = normalizeSprint({
        ...sprint,
        userId: state.currentUserId,
      });

      const next = {
        ...state,
        sprints: [...state.sprints, newSprint],
      };

      persistLocalAndQueueCloud(next);

      return next;
    });
  },

  updateSprint: (sprintId, updates) => {
    if (!allowed("projects.edit")) return;
    set((state) => {
      const next = {
        ...state,
        sprints: state.sprints.map((sprint) =>
          sprint.id === sprintId
            ? {
                ...sprint,
                ...updates,
                userId: sprint.userId || state.currentUserId,
                updatedAt: nowIso(),
              }
            : sprint
        ),
      };

      persistLocalAndQueueCloud(next);

      return next;
    });
  },

  deleteSprint: (sprintId) => {
    if (!allowed("projects.edit")) return;
    set((state) => {
      const next = {
        ...state,
        sprints: state.sprints.filter((sprint) => sprint.id !== sprintId),

        tasks: state.tasks.map((task) =>
          task.sprintId === sprintId
            ? { ...task, sprintId: "", updatedAt: nowIso() }
            : task
        ),
      };

      persistLocalAndQueueCloud(next);

      return next;
    });
  },

  addTask: (task) => {
    if (!allowed("tasks.create")) return;
    set((state) => {
      const newTask = normalizeTask({
        ...task,
        userId: state.currentUserId,
      });

      const next = {
        ...state,
        tasks: [...state.tasks, newTask],
      };

      persistLocalAndQueueCloud(next);

      return next;
    });
  },

  /** Adds several tasks at once (AI plans, templates). */
  addTasks: (newTasks = []) => {
    if (!allowed("tasks.create")) return;
    set((state) => {
      const next = {
        ...state,
        tasks: [
          ...state.tasks,
          ...newTasks.map((task) =>
            normalizeTask({ ...task, userId: state.currentUserId })
          ),
        ],
      };

      persistLocalAndQueueCloud(next);

      return next;
    });
  },

  updateTask: (taskId, updates) => {
    const current = get().tasks.find((task) => task.id === taskId);
    if (current) {
      const check = checkTaskEdit(getAccess(), current, changedTaskFields(current, { ...current, ...updates }));
      if (!check.ok) {
        notify.error(check.reason);
        return;
      }
    }
    set((state) => {
      const next = {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === taskId
            ? normalizeTask({
                ...task,
                ...updates,

                id: task.id,
                userId: task.userId || state.currentUserId,

                dependencyIds: Array.isArray(updates.dependencyIds)
                  ? updates.dependencyIds
                  : task.dependencyIds || [],

                dependencyRules: Array.isArray(updates.dependencyRules)
                  ? updates.dependencyRules
                  : task.dependencyRules || [],

                parentTaskId: updates.parentTaskId ?? task.parentTaskId ?? "",

                plannedProgress: Number(
                  updates.plannedProgress ?? task.plannedProgress ?? 0
                ),

                actualProgress: Number(
                  updates.actualProgress ?? task.actualProgress ?? 0
                ),

                durationDays: Number(
                  updates.durationDays ?? task.durationDays ?? 1
                ),

                isMilestone: Boolean(updates.isMilestone ?? task.isMilestone),
                isManualLocked: Boolean(
                  updates.isManualLocked ?? task.isManualLocked
                ),

                createdAt: task.createdAt,
                updatedAt: nowIso(),
              })
            : task
        ),
      };

      persistLocalAndQueueCloud(next, 3500);

      return next;
    });
  },

  bulkReplaceTasks: (nextTasks) => {
    if (Array.isArray(nextTasks)) {
      const { tasks: permitted, denied } = filterTaskChanges(getAccess(), get().tasks, nextTasks);
      reportDenied(denied);
      nextTasks = permitted;
    }
    set((state) => {
      const next = {
        ...state,

        tasks: Array.isArray(nextTasks)
          ? nextTasks.map((task) =>
              normalizeTask({
                ...task,
                userId: task.userId || state.currentUserId,
                updatedAt: task.updatedAt || nowIso(),
              })
            )
          : [],
      };

      persistLocalAndQueueCloud(next, 3500);

      return next;
    });
  },

  deleteTask: (taskId) => {
    if (!allowed("tasks.delete")) return;
    set((state) => {
      const next = {
        ...state,

        tasks: state.tasks
          .filter((task) => task.id !== taskId)
          .map((task) => ({
            ...task,
            parentTaskId:
              task.parentTaskId === taskId ? "" : task.parentTaskId || "",
            dependencyIds: (task.dependencyIds || []).filter(
              (id) => id !== taskId
            ),
            updatedAt: nowIso(),
          })),
      };

      persistLocalAndQueueCloud(next);

      return next;
    });
  },

  addWeeklyReport: (report) => {
    if (!allowed("reports.write")) return;
    set((state) => {
      const timestamp = nowIso();

      const newReport = normalizeWeeklyReport({
        ...report,
        userId: state.currentUserId,
        id: makeId("weekly-report"),
        submittedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      const next = {
        ...state,
        weeklyReports: [newReport, ...state.weeklyReports],
      };

      persist(next);

      cloudOnly(() => saveWeeklyReport(newReport), "Could not sync the weekly report.");

      return next;
    });
  },

  updateWeeklyReport: (reportId, updates) => {
    if (!allowed("reports.write")) return;
    set((state) => {
      let updatedReport = null;

      const next = {
        ...state,

        weeklyReports: state.weeklyReports.map((report) => {
          if (report.id !== reportId) return report;

          updatedReport = normalizeWeeklyReport({
            ...report,
            ...updates,
            id: report.id,
            userId: report.userId || state.currentUserId,
            createdAt: report.createdAt,
            submittedAt: report.submittedAt,
            updatedAt: nowIso(),
          });

          return updatedReport;
        }),
      };

      persist(next);

      if (updatedReport) {
        cloudOnly(() => saveWeeklyReport(updatedReport), "Could not sync the weekly report.");
      }

      return next;
    });
  },

  deleteWeeklyReport: (reportId) => {
    if (!allowed("reports.write")) return;
    set((state) => {
      const next = {
        ...state,
        weeklyReports: state.weeklyReports.filter(
          (report) => report.id !== reportId
        ),
      };

      persist(next);

      cloudOnly(() => deleteWeeklyReportCloud(reportId), "Could not delete the weekly report from the cloud.");

      return next;
    });
  },

  addProjectDocument: (document) => {
    if (!allowed("documents.manage")) return;
    set((state) => {
      const timestamp = nowIso();

      const newDocument = normalizeProjectDocument({
        ...document,
        userId: state.currentUserId,
        id: makeId("project-doc"),
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      const next = {
        ...state,
        projectDocuments: [newDocument, ...state.projectDocuments],
      };

      persist(next);

      cloudOnly(() => saveProjectDocument(newDocument), "Could not sync the document.");

      return next;
    });
  },

  updateProjectDocument: (documentId, updates) => {
    if (!allowed("documents.manage")) return;
    set((state) => {
      let updatedDocument = null;

      const next = {
        ...state,

        projectDocuments: state.projectDocuments.map((document) => {
          if (document.id !== documentId) return document;

          updatedDocument = normalizeProjectDocument({
            ...document,
            ...updates,
            id: document.id,
            userId: document.userId || state.currentUserId,
            createdAt: document.createdAt,
            updatedAt: nowIso(),
          });

          return updatedDocument;
        }),
      };

      persist(next);

      if (updatedDocument) {
        cloudOnly(() => saveProjectDocument(updatedDocument), "Could not sync the document.");
      }

      return next;
    });
  },

  deleteProjectDocument: (documentId) => {
    if (!allowed("documents.manage")) return;
    set((state) => {
      const next = {
        ...state,
        projectDocuments: state.projectDocuments.filter(
          (document) => document.id !== documentId
        ),
      };

      persist(next);

      cloudOnly(() => deleteProjectDocumentCloud(documentId), "Could not delete the document from the cloud.");

      return next;
    });
  },

  resetAllData: () => {
    if (!allowed("projects.delete")) return;
    const userId = get().currentUserId;

    if (cloudSaveTimer) {
      window.clearTimeout(cloudSaveTimer);
      cloudSaveTimer = null;
    }

    pendingCloudState = null;

    clearPlannerData(userId);

    const empty = emptyPlannerData();

    set({
      currentUserId: userId,
      isWorkspaceLoading: false,
      workspaceLoadError: "",
      ...empty,
    });
  },
}));