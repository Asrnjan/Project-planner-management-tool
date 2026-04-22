import { differenceInCalendarDays, parseISO, isValid } from "date-fns";

export function safeParseDate(value) {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

export function calculateDurationDays(start, end) {
  const s = safeParseDate(start);
  const e = safeParseDate(end);
  if (!s || !e) return "";
  return differenceInCalendarDays(e, s) + 1;
}

export function buildWbs(tasks) {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const childrenMap = new Map();

  tasks.forEach((task) => {
    const parentId = task.parentTaskId || "";
    if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
    childrenMap.get(parentId).push(task);
  });

  const ordered = [];

  function walk(task, prefix) {
    ordered.push({ ...task, wbs: prefix });

    const children = childrenMap.get(task.id) || [];
    children.forEach((child, index) => {
      walk(child, `${prefix}.${index + 1}`);
    });
  }

  const rootTasks = tasks.filter(
    (task) => !task.parentTaskId || !taskMap.has(task.parentTaskId)
  );

  rootTasks.forEach((task, index) => {
    walk(task, `${index + 1}`);
  });

  return ordered;
}

export function getPredecessorText(task, allTasks) {
  const taskMap = Object.fromEntries(allTasks.map((t) => [t.id, t]));
  return (task.dependencyIds || [])
    .map((id) => {
      const found = taskMap[id];
      return found ? found.title : null;
    })
    .filter(Boolean)
    .join(", ");
}