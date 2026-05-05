import { create } from "zustand";
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

    name: project.name?.trim() || "Untitled Project",
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
    name: sprint.name?.trim() || "Untitled Sprint",
    startDate: sprint.startDate || "",
    endDate: sprint.endDate || "",
    goal: sprint.goal || "",
    createdAt: sprint.createdAt || timestamp,
    updatedAt: sprint.updatedAt || timestamp,
  };
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
    title: task.title?.trim() || "Untitled Task",
    owner: task.owner || "",
    priority: task.priority || "Medium",
    status: task.status || "Not Started",
    plannedStart: task.plannedStart || "",
    plannedEnd: task.plannedEnd || "",
    actualStart: task.actualStart || "",
    actualEnd: task.actualEnd || "",
    baselineStart: task.baselineStart || "",
    baselineEnd: task.baselineEnd || "",
    plannedProgress: Number(task.plannedProgress || 0),
    actualProgress: Number(task.actualProgress || 0),
    durationDays: Number(task.durationDays || 1),
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
    title: document.title?.trim() || "Untitled Document",
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

async function persistCurrentWorkspaceToCloud(state) {
  const currentUserId = state.currentUserId || "";

  if (!currentUserId) return;

  const workspacePayload = makeWorkspacePayload(state);

  const saveJobs = state.projects.map((project) => {
    const projectScopedPayload = {
      ...project,
      userId: currentUserId,
      projects: [project],
      sprints: state.sprints.filter((sprint) => sprint.projectId === project.id),
      tasks: state.tasks.filter((task) => task.projectId === project.id),
      baselineSnapshots: state.baselineSnapshots.filter(
        (snapshot) => !snapshot.projectId || snapshot.projectId === project.id
      ),
      weeklyReports: state.weeklyReports.filter(
        (report) => report.projectId === project.id
      ),
      projectDocuments: state.projectDocuments.filter(
        (document) => document.projectId === project.id
      ),
      plannerSettings: state.plannerSettings,
      savedAt: nowIso(),
      saveType: "single_project_workspace",
      fullWorkspaceSnapshot: workspacePayload,
    };

    return saveProject(projectScopedPayload).catch((error) => {
      console.error("Failed to save project workspace to Supabase:", error);
      return null;
    });
  });

  await Promise.all(saveJobs);
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

function persistLocalAndQueueCloud(next, delay = 3000) {
  persist(next);
  queueCloudWorkspaceSave(next, delay);
}

const initialData = normalizePlannerData(loadPlannerData() || emptyPlannerData());

export const usePlannerStore = create((set, get) => ({
  currentUserId: "",
  isWorkspaceLoading: false,
  workspaceLoadError: "",

  projects: initialData.projects,
  sprints: initialData.sprints,
  tasks: initialData.tasks,
  plannerSettings: initialData.plannerSettings,
  baselineSnapshots: initialData.baselineSnapshots,
  weeklyReports: initialData.weeklyReports,
  projectDocuments: initialData.projectDocuments,

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

      const localData = normalizePlannerData(loadPlannerData(user.id));

      const [cloudProjects, cloudReports, cloudDocuments] = await Promise.all([
        loadProjects({ allUsers: false }),
        loadWeeklyReports({ allUsers: false }),
        loadProjectDocuments({ allUsers: false }),
      ]);

      const cloudWorkspace = buildWorkspaceFromCloudProjects(cloudProjects);

      const hasCloudProjects = cloudWorkspace.projects.length > 0;

      const next = {
        currentUserId: user.id,
        isWorkspaceLoading: false,
        workspaceLoadError: "",

        projects: hasCloudProjects ? cloudWorkspace.projects : localData.projects,
        sprints: hasCloudProjects ? cloudWorkspace.sprints : localData.sprints,
        tasks: hasCloudProjects ? cloudWorkspace.tasks : localData.tasks,

        plannerSettings: hasCloudProjects
          ? cloudWorkspace.plannerSettings
          : localData.plannerSettings,

        baselineSnapshots: hasCloudProjects
          ? cloudWorkspace.baselineSnapshots
          : localData.baselineSnapshots,

        weeklyReports: Array.isArray(cloudReports)
          ? cloudReports.map(normalizeWeeklyReport)
          : localData.weeklyReports,

        projectDocuments: Array.isArray(cloudDocuments)
          ? cloudDocuments.map(normalizeProjectDocument)
          : localData.projectDocuments,
      };

      set(next);
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
    const userId = get().currentUserId;

    if (cloudSaveTimer) {
      window.clearTimeout(cloudSaveTimer);
      cloudSaveTimer = null;
    }

    pendingCloudState = null;

    if (userId) {
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

  importPlannerData: (payload = {}) => {
    set((state) => {
      const normalizedPayload = normalizePlannerData(payload);

      const next = {
        ...state,
        ...normalizedPayload,
      };

      persistLocalAndQueueCloud(next, 5000);

      return next;
    });
  },

  addProject: (project) => {
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

    const latestState = get();

    saveProject({
      ...newProject,
      userId: latestState.currentUserId,

      projects: [newProject],
      sprints: [],
      tasks: [],
      baselineSnapshots: [],
      weeklyReports: [],
      projectDocuments: [],

      plannerSettings: latestState.plannerSettings,
      savedAt: nowIso(),
      saveType: "single_project_workspace",
    })
      .then((savedProject) => {
        if (!savedProject) return;

        set((state) => {
          const next = {
            ...state,
            projects: state.projects.map((existingProject) =>
              existingProject.id === newProject.id
                ? {
                    ...existingProject,
                    cloudId: savedProject.cloudId || savedProject.dbId || "",
                    dbId: savedProject.dbId || savedProject.cloudId || "",
                    userId: savedProject.userId || state.currentUserId,
                    updatedAt: savedProject.updatedAt || nowIso(),
                  }
                : existingProject
            ),
          };

          persist(next);

          return next;
        });
      })
      .catch((error) => {
        console.error("Failed to save project to Supabase:", error);

        alert(
          error?.message ||
            "Project was added locally, but failed to save in Supabase."
        );
      });

    return newProject;
  },

  updateProject: (projectId, updates) => {
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

        alert(
          error?.message ||
            "Project was deleted locally, but failed to delete from Supabase."
        );
      });
  },

  duplicateProject: (projectId) => {
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

  updateTask: (taskId, updates) => {
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

      saveWeeklyReport(newReport).catch((error) => {
        console.error("Failed to save weekly report to Supabase:", error);
      });

      return next;
    });
  },

  updateWeeklyReport: (reportId, updates) => {
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
        saveWeeklyReport(updatedReport).catch((error) => {
          console.error("Failed to update weekly report in Supabase:", error);
        });
      }

      return next;
    });
  },

  deleteWeeklyReport: (reportId) => {
    set((state) => {
      const next = {
        ...state,
        weeklyReports: state.weeklyReports.filter(
          (report) => report.id !== reportId
        ),
      };

      persist(next);

      deleteWeeklyReportCloud(reportId).catch((error) => {
        console.error("Failed to delete weekly report from Supabase:", error);
      });

      return next;
    });
  },

  addProjectDocument: (document) => {
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

      saveProjectDocument(newDocument).catch((error) => {
        console.error("Failed to save project document to Supabase:", error);
      });

      return next;
    });
  },

  updateProjectDocument: (documentId, updates) => {
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
        saveProjectDocument(updatedDocument).catch((error) => {
          console.error("Failed to update project document in Supabase:", error);
        });
      }

      return next;
    });
  },

  deleteProjectDocument: (documentId) => {
    set((state) => {
      const next = {
        ...state,
        projectDocuments: state.projectDocuments.filter(
          (document) => document.id !== documentId
        ),
      };

      persist(next);

      deleteProjectDocumentCloud(documentId).catch((error) => {
        console.error("Failed to delete project document from Supabase:", error);
      });

      return next;
    });
  },

  resetAllData: () => {
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