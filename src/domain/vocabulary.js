// Shared vocabulary for tasks and projects. Every screen, importer and the
// store use these so data from other tools lands on the same four task
// statuses the board, grid and reports understand.

export const TASK_STATUSES = ["Not Started", "In Progress", "Done", "Blocked"];

export const TASK_PRIORITIES = ["Low", "Medium", "High", "Critical"];

export const PROJECT_STATUSES = [
  "Planned",
  "Active",
  "On Track",
  "At Risk",
  "Delayed",
  "On Hold",
  "Completed",
  "Archived",
];

const STATUS_SYNONYMS = {
  "Not Started": [
    "not started", "notstarted", "to do", "todo", "to-do", "open", "new",
    "backlog", "planned", "pending", "queued", "ready", "selected for development",
    "not begun", "proposed", "idea", "draft", "unstarted",
  ],
  "In Progress": [
    "in progress", "inprogress", "in-progress", "doing", "started", "active",
    "ongoing", "wip", "work in progress", "in review", "review", "in qa", "qa",
    "testing", "in testing", "in development", "development", "dev",
    "under review", "code review", "reopened", "working on it", "partially complete",
  ],
  Done: [
    "done", "complete", "completed", "closed", "finished", "resolved",
    "shipped", "released", "delivered", "approved", "accepted", "100%",
    "fixed", "verified", "archived",
  ],
  Blocked: [
    "blocked", "on hold", "onhold", "hold", "stuck", "waiting", "paused",
    "impeded", "deferred", "cancelled", "canceled", "suspended",
    "won't do", "wont do", "rejected",
  ],
};

const STATUS_LOOKUP = new Map();
Object.entries(STATUS_SYNONYMS).forEach(([canonical, synonyms]) => {
  STATUS_LOOKUP.set(canonical.toLowerCase(), canonical);
  synonyms.forEach((synonym) => STATUS_LOOKUP.set(synonym, canonical));
});

/**
 * Maps any status label (Jira, Asana, Trello, MS Project, free text) to one
 * of TASK_STATUSES. Unknown labels fall back to "Not Started", or to "Done"
 * when the progress already says the task is finished.
 */
export function normalizeTaskStatus(value, progress) {
  const text = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ");

  if (STATUS_LOOKUP.has(text)) return STATUS_LOOKUP.get(text);

  const loose = text.replace(/[^a-z0-9% ]/g, "").trim();
  if (STATUS_LOOKUP.has(loose)) return STATUS_LOOKUP.get(loose);

  if (/\b(done|complete|closed|resolved|finish)/.test(loose)) return "Done";
  if (/\b(block|hold|wait|stuck|cancel)/.test(loose)) return "Blocked";
  if (/\b(progress|doing|review|test|develop|start)/.test(loose)) {
    return "In Progress";
  }

  const pct = Number(progress);
  if (Number.isFinite(pct)) {
    if (pct >= 100) return "Done";
    if (pct > 0) return "In Progress";
  }

  return "Not Started";
}

const PRIORITY_SYNONYMS = {
  Low: ["low", "lowest", "minor", "trivial", "p4", "p5", "4", "5", "nice to have", "could"],
  Medium: ["medium", "normal", "moderate", "p3", "3", "should", "default"],
  High: ["high", "major", "important", "p2", "2", "must"],
  Critical: ["critical", "highest", "urgent", "blocker", "p0", "p1", "1", "0", "asap", "showstopper"],
};

const PRIORITY_LOOKUP = new Map();
Object.entries(PRIORITY_SYNONYMS).forEach(([canonical, synonyms]) => {
  synonyms.forEach((synonym) => PRIORITY_LOOKUP.set(synonym, canonical));
});

export function normalizePriority(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return "Medium";
  if (PRIORITY_LOOKUP.has(text)) return PRIORITY_LOOKUP.get(text);

  const firstWord = text.split(/[\s\-:]+/)[0];
  if (PRIORITY_LOOKUP.has(firstWord)) return PRIORITY_LOOKUP.get(firstWord);

  return "Medium";
}

export function isDoneStatus(status) {
  return normalizeTaskStatus(status) === "Done";
}
