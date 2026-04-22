import { create } from "zustand";
import {
  loadPlannerData,
  savePlannerData,
  clearPlannerData,
} from "../utils/storage";
import { seedProjects, seedSprints, seedTasks } from "../data/seedData";

function makeId(prefix = "id") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

const stored = loadPlannerData();

const initialData = stored || {
  projects: seedProjects,
  sprints: seedSprints,
  tasks: seedTasks,
};

function persist(state) {
  savePlannerData({
    projects: state.projects,
    sprints: state.sprints,
    tasks: state.tasks,
  });
}

export const usePlannerStore = create((set) => ({
  projects: initialData.projects,
  sprints: initialData.sprints,
  tasks: initialData.tasks,

  addProject: (project) => {
    set((state) => {
      const newProject = {
        id: makeId("project"),
        name: project.name?.trim() || "Untitled Project",
        owner: project.owner || "",
        description: project.description || "",
        status: project.status || "Active",
        startDate: project.startDate || "",
        targetEndDate: project.targetEndDate || "",
      };

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
          project.id === projectId ? { ...project, ...updates } : project
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
        projects: state.projects.filter((p) => p.id !== projectId),
        sprints: state.sprints.filter((s) => s.projectId !== projectId),
        tasks: state.tasks.filter((t) => t.projectId !== projectId),
      };

      persist(next);
      return next;
    });
  },

  addSprint: (sprint) => {
    set((state) => {
      const newSprint = {
        id: makeId("sprint"),
        projectId: sprint.projectId,
        name: sprint.name?.trim() || "Untitled Sprint",
        startDate: sprint.startDate || "",
        endDate: sprint.endDate || "",
        goal: sprint.goal || "",
      };

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
          sprint.id === sprintId ? { ...sprint, ...updates } : sprint
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
          task.sprintId === sprintId ? { ...task, sprintId: "" } : task
        ),
      };

      persist(next);
      return next;
    });
  },

  addTask: (task) => {
    set((state) => {
      const dependencyIds = Array.isArray(task.dependencyIds)
        ? task.dependencyIds
        : [];

      const newTask = {
        id: makeId("task"),
        projectId: task.projectId,
        sprintId: task.sprintId || "",
        parentTaskId: task.parentTaskId || "",
        dependencyIds,
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
      };

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
              }
            : task
        ),
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
            parentTaskId: task.parentTaskId === taskId ? "" : task.parentTaskId || "",
            dependencyIds: (task.dependencyIds || []).filter((id) => id !== taskId),
          })),
      };

      persist(next);
      return next;
    });
  },

  resetAllData: () => {
    clearPlannerData();
    set({
      projects: seedProjects,
      sprints: seedSprints,
      tasks: seedTasks,
    });
  },
}));