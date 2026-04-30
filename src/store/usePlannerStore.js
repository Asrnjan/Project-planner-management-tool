import { create } from "zustand";
import {
  loadPlannerData,
  savePlannerData,
  clearPlannerData,
} from "../utils/storage";
import { seedProjects, seedSprints, seedTasks } from "../data/seedData";

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

function makeId(prefix = "id") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeProject(project = {}) {
  const timestamp = nowIso();

  return {
    id: project.id || makeId("project"),
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
    projectId: task.projectId || "",
    sprintId: task.sprintId || "",
    parentTaskId: task.parentTaskId || "",
    dependencyIds: Array.isArray(task.dependencyIds) ? task.dependencyIds : [],
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
    isMilestone: Boolean(task.isMilestone),
    createdAt: task.createdAt || timestamp,
    updatedAt: task.updatedAt || timestamp,
  };
}

function normalizeWeeklyReport(report = {}) {
  const timestamp = nowIso();

  return {
    id: report.id || makeId("weekly-report"),
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

const stored = loadPlannerData();

const initialData = stored || {
  projects: seedProjects,
  sprints: seedSprints,
  tasks: seedTasks,
  plannerSettings: {
    schedulingMode: "manual",
  },
  baselineSnapshots: [],
  weeklyReports: [],
  projectDocuments: [],
};

function persist(state) {
  savePlannerData({
    projects: state.projects,
    sprints: state.sprints,
    tasks: state.tasks,
    plannerSettings: state.plannerSettings,
    baselineSnapshots: state.baselineSnapshots,
    weeklyReports: state.weeklyReports,
    projectDocuments: state.projectDocuments,
  });
}

export const usePlannerStore = create((set, get) => ({
  projects: Array.isArray(initialData.projects)
    ? initialData.projects.map(normalizeProject)
    : [],

  sprints: Array.isArray(initialData.sprints)
    ? initialData.sprints.map(normalizeSprint)
    : [],

  tasks: Array.isArray(initialData.tasks)
    ? initialData.tasks.map(normalizeTask)
    : [],

  plannerSettings: initialData.plannerSettings || { schedulingMode: "manual" },

  baselineSnapshots: Array.isArray(initialData.baselineSnapshots)
    ? initialData.baselineSnapshots
    : [],

  weeklyReports: Array.isArray(initialData.weeklyReports)
    ? initialData.weeklyReports.map(normalizeWeeklyReport)
    : [],

  projectDocuments: Array.isArray(initialData.projectDocuments)
    ? initialData.projectDocuments.map(normalizeProjectDocument)
    : [],

  loadCloudReportsAndDocuments: async () => {
    const [cloudReports, cloudDocuments] = await Promise.all([
      loadWeeklyReports(),
      loadProjectDocuments(),
    ]);

    set((state) => {
      const next = {
        ...state,
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

  setSchedulingMode: (mode) => {
    set((state) => {
      const next = {
        ...state,
        plannerSettings: {
          ...state.plannerSettings,
          schedulingMode: mode,
        },
      };

      persist(next);
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

      persist(next);
      return next;
    });
  },

  importPlannerData: (payload = {}) => {
    set((state) => {
      const next = {
        ...state,

        projects: Array.isArray(payload.projects)
          ? payload.projects.map(normalizeProject)
          : [],

        sprints: Array.isArray(payload.sprints)
          ? payload.sprints.map(normalizeSprint)
          : [],

        tasks: Array.isArray(payload.tasks)
          ? payload.tasks.map(normalizeTask)
          : [],

        plannerSettings:
          payload.plannerSettings && typeof payload.plannerSettings === "object"
            ? payload.plannerSettings
            : { schedulingMode: "manual" },

        baselineSnapshots: Array.isArray(payload.baselineSnapshots)
          ? payload.baselineSnapshots
          : [],

        weeklyReports: Array.isArray(payload.weeklyReports)
          ? payload.weeklyReports.map(normalizeWeeklyReport)
          : state.weeklyReports || [],

        projectDocuments: Array.isArray(payload.projectDocuments)
          ? payload.projectDocuments.map(normalizeProjectDocument)
          : state.projectDocuments || [],
      };

      persist(next);
      return next;
    });
  },

  addProject: (project) => {
    set((state) => {
      const newProject = normalizeProject(project);

      const next = {
        ...state,
        projects: [...state.projects, newProject],
      };

      persist(next);
      return next;
    });
  },

  updateProject: (projectId, updates) => {
    set((state) => {
      const next = {
        ...state,
        projects: state.projects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                ...updates,
                updatedAt: nowIso(),
              }
            : project
        ),
      };

      persist(next);
      return next;
    });
  },

  deleteProject: (projectId) => {
    set((state) => {
      const next = {
        ...state,
        projects: state.projects.filter((project) => project.id !== projectId),

        sprints: state.sprints.filter(
          (sprint) => sprint.projectId !== projectId
        ),

        tasks: state.tasks.filter((task) => task.projectId !== projectId),

        baselineSnapshots: state.baselineSnapshots.filter(
          (snapshot) => snapshot.projectId !== projectId
        ),

        weeklyReports: state.weeklyReports.filter(
          (report) => report.projectId !== projectId
        ),

        projectDocuments: state.projectDocuments.filter(
          (document) => document.projectId !== projectId
        ),
      };

      persist(next);
      return next;
    });
  },

  duplicateProject: (projectId) => {
    set((state) => {
      const originalProject = state.projects.find(
        (project) => project.id === projectId
      );

      if (!originalProject) return state;

      const newProjectId = makeId("project");
      const timestamp = nowIso();

      const duplicatedProject = {
        ...originalProject,
        id: newProjectId,
        name: `${originalProject.name} Copy`,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const sprintIdMap = {};
      const duplicatedSprints = state.sprints
        .filter((sprint) => sprint.projectId === projectId)
        .map((sprint) => {
          const newSprintId = makeId("sprint");
          sprintIdMap[sprint.id] = newSprintId;

          return {
            ...sprint,
            id: newSprintId,
            projectId: newProjectId,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
        });

      const taskIdMap = {};
      const sourceTasks = state.tasks.filter(
        (task) => task.projectId === projectId
      );

      sourceTasks.forEach((task) => {
        taskIdMap[task.id] = makeId("task");
      });

      const duplicatedTasks = sourceTasks.map((task) => ({
        ...task,
        id: taskIdMap[task.id],
        projectId: newProjectId,
        sprintId: sprintIdMap[task.sprintId] || "",
        parentTaskId: taskIdMap[task.parentTaskId] || "",
        dependencyIds: (task.dependencyIds || [])
          .map((id) => taskIdMap[id])
          .filter(Boolean),
        createdAt: timestamp,
        updatedAt: timestamp,
      }));

      const duplicatedReports = state.weeklyReports
        .filter((report) => report.projectId === projectId)
        .map((report) =>
          normalizeWeeklyReport({
            ...report,
            id: makeId("weekly-report"),
            projectId: newProjectId,
            reportingWeek: report.reportingWeek || "",
            submittedAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
        );

      const duplicatedDocuments = state.projectDocuments
        .filter((document) => document.projectId === projectId)
        .map((document) =>
          normalizeProjectDocument({
            ...document,
            id: makeId("project-doc"),
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

      persist(next);

      duplicatedReports.forEach((report) => {
        saveWeeklyReport(report).catch((error) => {
          console.error("Failed to save duplicated weekly report:", error);
        });
      });

      duplicatedDocuments.forEach((document) => {
        saveProjectDocument(document).catch((error) => {
          console.error("Failed to save duplicated project document:", error);
        });
      });

      return next;
    });
  },

  addSprint: (sprint) => {
    set((state) => {
      const newSprint = normalizeSprint(sprint);

      const next = {
        ...state,
        sprints: [...state.sprints, newSprint],
      };

      persist(next);
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
                updatedAt: nowIso(),
              }
            : sprint
        ),
      };

      persist(next);
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

      persist(next);
      return next;
    });
  },

  addTask: (task) => {
    set((state) => {
      const newTask = normalizeTask(task);

      const next = {
        ...state,
        tasks: [...state.tasks, newTask],
      };

      persist(next);
      return next;
    });
  },

  updateTask: (taskId, updates) => {
    set((state) => {
      const next = {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                ...updates,

                dependencyIds: Array.isArray(updates.dependencyIds)
                  ? updates.dependencyIds
                  : task.dependencyIds || [],

                parentTaskId: updates.parentTaskId ?? task.parentTaskId ?? "",

                plannedProgress: Number(
                  updates.plannedProgress ?? task.plannedProgress ?? 0
                ),

                actualProgress: Number(
                  updates.actualProgress ?? task.actualProgress ?? 0
                ),

                isMilestone: Boolean(updates.isMilestone ?? task.isMilestone),

                updatedAt: nowIso(),
              }
            : task
        ),
      };

      persist(next);
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
                updatedAt: task.updatedAt || nowIso(),
              })
            )
          : [],
      };

      persist(next);
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

      persist(next);
      return next;
    });
  },

  addWeeklyReport: (report) => {
    set((state) => {
      const timestamp = nowIso();

      const newReport = normalizeWeeklyReport({
        ...report,
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
    clearPlannerData();

    set({
      projects: seedProjects.map(normalizeProject),
      sprints: seedSprints.map(normalizeSprint),
      tasks: seedTasks.map(normalizeTask),
      plannerSettings: {
        schedulingMode: "manual",
      },
      baselineSnapshots: [],
      weeklyReports: [],
      projectDocuments: [],
    });
  },
}));