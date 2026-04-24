import { differenceInCalendarDays, parseISO, isValid, isAfter } from "date-fns";

export function safeDate(value) {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

export function getTaskVariance(task) {
  return Number(task.actualProgress || 0) - Number(task.plannedProgress || 0);
}

export function getTaskDelayDays(task) {
  const plannedEnd = safeDate(task.plannedEnd);
  const actualEnd = safeDate(task.actualEnd);
  if (!plannedEnd || !actualEnd) return 0;
  return differenceInCalendarDays(actualEnd, plannedEnd);
}

export function isTaskOverdue(task) {
  const plannedEnd = safeDate(task.plannedEnd);
  if (!plannedEnd) return false;
  if (task.status === "Done") return false;

  const today = new Date();
  return isAfter(today, plannedEnd);
}

export function summarizeProject(tasks) {
  if (!tasks.length) {
    return {
      plannedAvg: 0,
      actualAvg: 0,
      variance: 0,
      completed: 0,
      total: 0,
      overdue: 0,
      milestones: 0,
    };
  }

  const total = tasks.length;
  const plannedAvg = Math.round(
    tasks.reduce((sum, task) => sum + Number(task.plannedProgress || 0), 0) / total
  );
  const actualAvg = Math.round(
    tasks.reduce((sum, task) => sum + Number(task.actualProgress || 0), 0) / total
  );
  const completed = tasks.filter((task) => task.status === "Done").length;
  const overdue = tasks.filter((task) => isTaskOverdue(task)).length;
  const milestones = tasks.filter((task) => task.isMilestone).length;

  return {
    plannedAvg,
    actualAvg,
    variance: actualAvg - plannedAvg,
    completed,
    total,
    overdue,
    milestones,
  };
}

export function getProjectHealth(summary) {
  if (summary.total === 0) return "No Tasks";
  if (summary.overdue > 0 || summary.variance < -20) return "At Risk";
  if (summary.variance < 0) return "Needs Attention";
  return "On Track";
}