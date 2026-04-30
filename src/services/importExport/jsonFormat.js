import { normalizePlannerJson } from "./mappers";

export function exportPlannerAsJson(data) {
  return JSON.stringify(normalizePlannerJson(data), null, 2);
}

export function importPlannerFromJson(text) {
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON file.");
  }

  const normalized = normalizePlannerJson(parsed);

  if (
    !Array.isArray(normalized.projects) ||
    !Array.isArray(normalized.sprints) ||
    !Array.isArray(normalized.tasks)
  ) {
    throw new Error("JSON structure is invalid.");
  }

  return normalized;
}