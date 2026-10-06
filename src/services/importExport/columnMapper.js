// Matches spreadsheet headers from any tool to planner fields.

export const FIELD_LABELS = {
  title: "Task name",
  project: "Project",
  sprint: "Sprint / iteration",
  parent: "Parent task",
  owner: "Assigned to",
  status: "Status",
  priority: "Priority",
  plannedStart: "Start date",
  plannedEnd: "Due / finish date",
  dateRange: "Date range (start – end)",
  actualStart: "Actual start",
  actualEnd: "Actual finish",
  durationDays: "Duration",
  plannedProgress: "Planned %",
  actualProgress: "% complete",
  isMilestone: "Milestone",
  predecessors: "Depends on",
  wbs: "WBS / outline number",
  notes: "Notes / description",
  tags: "Tags / labels",
  externalId: "ID / issue key",
  ignore: "Don't import",
};

export const MAPPABLE_FIELDS = Object.keys(FIELD_LABELS);

// Normalised header synonyms. Order inside a field does not matter; exact
// matches always beat partial ones.
const SYNONYMS = {
  title: [
    "task name", "task", "title", "name", "summary", "subject", "task title", "item", "item name",
    "activity", "activity name", "work item", "card name", "card", "issue", "story", "deliverable",
    "description of task", "pulse name", "row name",
  ],
  project: ["project", "project name", "projects", "board", "board name", "workspace", "program", "portfolio", "list"],
  sprint: ["sprint", "sprints", "iteration", "iteration path", "cycle", "milestone name", "phase", "release", "fix version", "fix versions", "section", "section column", "group", "stage"],
  parent: ["parent task", "parent", "parent summary", "parent name", "parent issue", "epic", "epic link", "epic name", "summary task", "parent item"],
  owner: [
    "owner", "assignee", "assigned to", "assigned", "resource names", "resource", "resources", "responsible",
    "person", "people", "members", "member", "assignee name", "task owner", "lead", "who",
  ],
  status: ["status", "state", "task status", "progress status", "stage status", "workflow state", "column", "list name", "completed"],
  priority: ["priority", "importance", "urgency", "severity", "prio"],
  plannedStart: [
    "planned start", "start", "start date", "begin", "begin date", "baseline start", "scheduled start",
    "starts", "from", "start time", "created", "created date", "created at",
  ],
  plannedEnd: [
    "planned end", "planned finish", "end", "end date", "finish", "finish date", "due", "due date",
    "deadline", "target date", "due on", "target end", "scheduled finish", "to", "end time", "date",
  ],
  dateRange: ["timeline", "date range", "dates", "period", "schedule", "timeframe", "time frame", "duration range"],
  actualStart: ["actual start", "actual start date", "started", "started at", "started date"],
  actualEnd: ["actual end", "actual finish", "actual finish date", "completed at", "completed date", "resolved", "resolution date", "done date", "closed date", "date completed"],
  durationDays: ["duration", "duration days", "days", "estimate", "estimated days", "original estimate", "effort", "work", "story points", "length"],
  plannedProgress: ["planned progress", "planned %", "planned percent", "baseline %"],
  actualProgress: ["% complete", "percent complete", "progress", "actual progress", "complete", "completion", "% done", "done %", "percent done", "pct complete"],
  isMilestone: ["milestone", "is milestone", "milestone?", "key date", "type milestone"],
  predecessors: ["predecessors", "predecessor", "depends on", "dependencies", "dependency", "blocked by", "is blocked by", "after", "prerequisites"],
  wbs: ["wbs", "outline number", "outline", "wbs code", "level", "outline level", "row", "#", "no", "number"],
  notes: ["notes", "note", "description", "details", "comments", "comment", "body", "content", "remarks"],
  tags: ["tags", "tag", "labels", "label", "categories", "category", "type", "issue type", "components", "component"],
  externalId: ["id", "task id", "issue key", "key", "issue id", "item id", "unique id", "uid", "card id", "ref", "reference"],
};

export function normalizeHeader(header) {
  return String(header ?? "")
    .toLowerCase()
    .replace(/[_\-./]+/g, " ")
    .replace(/[()[\]{}:*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreHeader(header, field) {
  const normalized = normalizeHeader(header);
  if (!normalized) return 0;
  const synonyms = SYNONYMS[field] || [];
  if (synonyms.includes(normalized)) return 100 - synonyms.indexOf(normalized) * 0.1;
  if (normalizeHeader(FIELD_LABELS[field]) === normalized) return 99;

  // Header contains a multi-word synonym, e.g. "Task Name (EN)".
  let best = 0;
  synonyms.forEach((synonym) => {
    if (synonym.length < 4) return;
    const pattern = new RegExp(`(^|\\s)${synonym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`);
    if (pattern.test(normalized)) best = Math.max(best, 60 + Math.min(synonym.length, 20));
  });
  return best;
}

/**
 * Proposes header -> field mapping. Each field is used once; unmatched
 * headers map to "ignore".
 * @param {string[]} headers
 * @param {object[]} sampleRows used to break ties (e.g. which date column is the end)
 * @returns {Record<string,string>}
 */
export function autoMapColumns(headers, sampleRows = []) {
  const candidates = [];
  headers.forEach((header) => {
    Object.keys(SYNONYMS).forEach((field) => {
      const score = scoreHeader(header, field);
      if (score > 0) candidates.push({ header, field, score });
    });
  });
  candidates.sort((a, b) => b.score - a.score);

  const mapping = Object.fromEntries(headers.map((header) => [header, "ignore"]));
  const usedFields = new Set();
  const usedHeaders = new Set();

  candidates.forEach(({ header, field }) => {
    if (usedFields.has(field) || usedHeaders.has(header)) return;
    mapping[header] = field;
    usedFields.add(field);
    usedHeaders.add(header);
  });

  // Every task needs a name: fall back to the first mostly-text column.
  if (!usedFields.has("title")) {
    const textHeader = headers.find((header) => {
      if (mapping[header] !== "ignore") return false;
      const values = sampleRows.map((row) => row[header]).filter((value) => value !== "" && value != null);
      return values.length && values.every((value) => typeof value === "string" && !/^\d+([.,]\d+)?%?$/.test(value.trim()));
    });
    if (textHeader) mapping[textHeader] = "title";
  }

  return mapping;
}

/** How confident the automatic mapping is, for the UI. */
export function mappingQuality(mapping) {
  const fields = new Set(Object.values(mapping));
  if (!fields.has("title")) return "missing-title";
  const useful = ["owner", "status", "plannedStart", "plannedEnd", "actualProgress", "durationDays"].filter((field) =>
    fields.has(field)
  ).length;
  return useful >= 2 ? "good" : "partial";
}
