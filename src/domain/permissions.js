// Team access model: what each role may do, workspace rules set by an
// administrator, and the checks the app runs before every change.
//
// The same role presets and rules are seeded into supabase/schema.sql, where
// row level security and triggers enforce them on the server. Keep the two in
// sync; supabase/schema.test.mjs fails if they drift apart.

export const PERMISSION_GROUPS = [
  {
    key: "projects",
    label: "Projects",
    permissions: [
      { key: "projects.create", label: "Create projects" },
      { key: "projects.edit", label: "Edit project details, sprints, baselines and scheduling" },
      { key: "projects.delete", label: "Delete projects" },
    ],
  },
  {
    key: "tasks",
    label: "Tasks",
    permissions: [
      { key: "tasks.create", label: "Add tasks" },
      { key: "tasks.edit_all", label: "Edit any task" },
      { key: "tasks.edit_assigned", label: "Update tasks assigned to them" },
      { key: "tasks.delete", label: "Delete tasks" },
    ],
  },
  {
    key: "content",
    label: "Reports, documents and data",
    permissions: [
      { key: "reports.write", label: "Write weekly status reports" },
      { key: "documents.manage", label: "Add and edit documents" },
      { key: "data.import", label: "Import data" },
      { key: "data.export", label: "Export and download data" },
      { key: "ai.use", label: "Use Claude (briefings, questions, plan drafts)" },
    ],
  },
  {
    key: "timesheet",
    label: "Timesheets",
    permissions: [
      { key: "timesheet.log", label: "Log their own time" },
      { key: "timesheet.view_all", label: "See everyone's timesheets" },
      { key: "timesheet.approve", label: "Approve or reject timesheets" },
    ],
  },
  {
    key: "admin",
    label: "Administration",
    permissions: [
      { key: "admin.users", label: "Add, change and deactivate users" },
      { key: "admin.roles_rules", label: "Change role permissions and workspace rules" },
      { key: "admin.audit", label: "See the activity log" },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((group) => group.permissions.map((p) => p.key));

export const ROLES = [
  { key: "admin", label: "Administrator", description: "Full access, including users, roles and rules. Cannot be restricted." },
  { key: "manager", label: "Project manager", description: "Runs projects end to end and approves timesheets." },
  { key: "member", label: "Team member", description: "Updates their own tasks and logs time." },
  { key: "viewer", label: "Viewer", description: "Read-only access to the projects they can see." },
];

const grant = (keys) => Object.fromEntries(ALL_PERMISSIONS.map((key) => [key, keys.includes(key)]));

export const DEFAULT_ROLE_PERMISSIONS = {
  admin: grant(ALL_PERMISSIONS),
  manager: grant([
    "projects.create",
    "projects.edit",
    "projects.delete",
    "tasks.create",
    "tasks.edit_all",
    "tasks.edit_assigned",
    "tasks.delete",
    "reports.write",
    "documents.manage",
    "data.import",
    "data.export",
    "ai.use",
    "timesheet.log",
    "timesheet.view_all",
    "timesheet.approve",
  ]),
  member: grant(["tasks.edit_assigned", "documents.manage", "data.export", "ai.use", "timesheet.log"]),
  viewer: grant(["data.export"]),
};

export const DEFAULT_RULES = {
  timesheet: {
    requireApproval: true,
    allowManualEntries: true,
    onlyAssignedTasks: true,
    requireNote: false,
    maxHoursPerDay: 12,
    lockAfterDays: 14,
    autoStopAfterHours: 10,
  },
  tasks: {
    membersCanChangeDates: false,
    lockDoneTasks: false,
  },
  security: {
    allowedEmailDomains: "",
    idleSignOutMinutes: 0,
  },
};

export const RULE_DEFINITIONS = [
  {
    group: "timesheet",
    label: "Timesheets",
    rules: [
      { key: "requireApproval", type: "boolean", label: "Timesheets need approval", hint: "Submitted time stays pending until a manager approves it." },
      { key: "allowManualEntries", type: "boolean", label: "Allow manual time entries", hint: "Off: time can only be recorded with the start/stop timer, using server timestamps." },
      { key: "onlyAssignedTasks", type: "boolean", label: "Only log time on assigned tasks", hint: "People can only pick tasks where they are the owner." },
      { key: "requireNote", type: "boolean", label: "Require a note on every entry", hint: "A short description of the work done." },
      { key: "maxHoursPerDay", type: "number", min: 1, max: 24, label: "Maximum hours per day", hint: "Task time logged by one person on one day." },
      { key: "lockAfterDays", type: "number", min: 0, max: 365, label: "Lock entries after (days)", hint: "Older entries can no longer be changed by their owner. 0 = never lock." },
      { key: "autoStopAfterHours", type: "number", min: 1, max: 24, label: "Stop forgotten timers after (hours)", hint: "A timer left running is capped at this length when it stops." },
    ],
  },
  {
    group: "tasks",
    label: "Tasks",
    rules: [
      { key: "membersCanChangeDates", type: "boolean", label: "Assignees can change their task dates", hint: "Off: people who can only update assigned tasks may change status, progress and notes, not dates." },
      { key: "lockDoneTasks", type: "boolean", label: "Lock finished tasks", hint: "Done tasks can only be reopened or changed by someone who can edit any task." },
    ],
  },
  {
    group: "security",
    label: "Access",
    rules: [
      { key: "allowedEmailDomains", type: "text", label: "Allowed email domains", hint: "Comma separated, e.g. company.com. Leave empty to allow any address." },
      { key: "idleSignOutMinutes", type: "number", min: 0, max: 1440, label: "Sign out after inactivity (minutes)", hint: "0 = stay signed in." },
    ],
  },
];

export function mergeRules(rules) {
  const source = rules && typeof rules === "object" ? rules : {};
  return Object.fromEntries(
    Object.entries(DEFAULT_RULES).map(([group, defaults]) => [group, { ...defaults, ...(source[group] || {}) }])
  );
}

export function mergeRolePermissions(roles) {
  const source = roles && typeof roles === "object" ? roles : {};
  return Object.fromEntries(
    Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([role, defaults]) => [
      role,
      role === "admin" ? { ...defaults } : { ...defaults, ...(source[role] || {}) },
    ])
  );
}

/** Effective permission map for a member: role defaults, then per-person overrides. */
export function resolvePermissions(member, rolePermissions = DEFAULT_ROLE_PERMISSIONS) {
  if (!member || member.active === false) return grant([]);
  if (member.role === "admin") return grant(ALL_PERMISSIONS);
  const roles = mergeRolePermissions(rolePermissions);
  const base = roles[member.role] || grant([]);
  const overrides = member.permissions && typeof member.permissions === "object" ? member.permissions : {};
  return Object.fromEntries(
    ALL_PERMISSIONS.map((key) => [key, typeof overrides[key] === "boolean" ? overrides[key] : Boolean(base[key])])
  );
}

export function canAccessProject(member, projectId) {
  if (!member || member.active === false) return false;
  if (member.role === "admin") return true;
  if (!Array.isArray(member.projectIds)) return true;
  return member.projectIds.includes(projectId);
}

const normalizeName = (value) => String(value || "").trim().toLowerCase();

/** A task counts as assigned when its owner matches the person's name or email. */
export function isAssignedTo(task, member) {
  if (!task || !member) return false;
  const owner = normalizeName(task.owner);
  if (!owner) return false;
  return [member.displayName, member.email, String(member.email || "").split("@")[0]]
    .map(normalizeName)
    .filter(Boolean)
    .includes(owner);
}

// Fields recalculated by the app itself (time-based plan %, numbering,
// timestamps). They never count as a person's edit.
const DERIVED_FIELDS = new Set(["plannedProgress", "updatedAt", "wbs", "outlineNumber", "userId", "createdAt"]);
// Fields that summary (parent) tasks roll up from their subtasks.
const ROLLUP_FIELDS = new Set(["plannedStart", "plannedEnd", "durationDays", "actualProgress", "status", "actualStart", "actualEnd"]);
const PROGRESS_FIELDS = new Set(["status", "actualProgress", "notes", "actualStart", "actualEnd"]);
const DATE_FIELDS = new Set(["plannedStart", "plannedEnd", "durationDays"]);

function sameValue(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a || []) === JSON.stringify(b || []);
  return (a ?? "") === (b ?? "") || String(a ?? "") === String(b ?? "");
}

export function changedTaskFields(before, after) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...keys].filter((key) => !DERIVED_FIELDS.has(key) && !sameValue(before?.[key], after?.[key]));
}

/**
 * Whether `access` may change `fields` on `task`. Returns { ok, reason }.
 * access = { member, permissions, rules }.
 */
export function checkTaskEdit(access, task, fields) {
  const { member, permissions = {}, rules = DEFAULT_RULES } = access || {};
  if (!fields.length || access?.unrestricted) return { ok: true };
  if (!canAccessProject(member, task.projectId)) return { ok: false, reason: "You don't have access to this project." };

  const taskRules = rules.tasks || DEFAULT_RULES.tasks;
  if (permissions["tasks.edit_all"]) return { ok: true };

  if (taskRules.lockDoneTasks && task.status === "Done") {
    return { ok: false, reason: "Finished tasks are locked. Ask a project manager to reopen it." };
  }
  if (!permissions["tasks.edit_assigned"]) return { ok: false, reason: "Your role can't edit tasks." };
  if (!isAssignedTo(task, member)) return { ok: false, reason: "You can only update tasks assigned to you." };

  const allowed = new Set(PROGRESS_FIELDS);
  if (taskRules.membersCanChangeDates) DATE_FIELDS.forEach((field) => allowed.add(field));
  const blocked = fields.filter((field) => !allowed.has(field));
  if (blocked.length) {
    return {
      ok: false,
      reason: taskRules.membersCanChangeDates
        ? "You can update status, progress, notes and dates on your tasks."
        : "You can update status, progress and notes on your tasks; dates are set by the project manager.",
    };
  }
  return { ok: true };
}

/**
 * Applies only the task changes `access` is allowed to make, for bulk edits
 * such as the schedule grid. Summary-task rollups always follow their
 * subtasks. Returns { tasks, denied: [{ task, reason }] }.
 */
export function filterTaskChanges(access, previousTasks, nextTasks) {
  if (access?.unrestricted) return { tasks: nextTasks, denied: [] };
  const permissions = access?.permissions || {};
  const previousById = new Map(previousTasks.map((task) => [task.id, task]));
  const nextIds = new Set(nextTasks.map((task) => task.id));
  const parentIds = new Set(nextTasks.map((task) => task.parentTaskId).filter(Boolean));
  const denied = [];
  const result = [];

  for (const task of nextTasks) {
    const before = previousById.get(task.id);
    if (!before) {
      if (permissions["tasks.create"] && canAccessProject(access?.member, task.projectId)) result.push(task);
      else denied.push({ task, reason: "Your role can't add tasks." });
      continue;
    }
    let fields = changedTaskFields(before, task);
    if (parentIds.has(task.id) || before.isSummaryTask) fields = fields.filter((field) => !ROLLUP_FIELDS.has(field));
    const check = checkTaskEdit(access, before, fields);
    if (check.ok) result.push(task);
    else {
      denied.push({ task: before, reason: check.reason });
      result.push(before);
    }
  }

  for (const task of previousTasks) {
    if (nextIds.has(task.id)) continue;
    if (permissions["tasks.delete"] && canAccessProject(access?.member, task.projectId)) continue;
    denied.push({ task, reason: "Your role can't delete tasks." });
    result.push(task);
  }

  return { tasks: result, denied };
}

// ------------------------------------------------------------- timesheets

export function entryMinutes(entry, now = new Date()) {
  const start = new Date(entry.startedAt).getTime();
  const end = entry.endedAt ? new Date(entry.endedAt).getTime() : now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 60000);
}

export function localDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatMinutes(minutes) {
  const value = Math.max(0, Math.round(minutes || 0));
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return hours ? `${hours}h ${String(mins).padStart(2, "0")}m` : `${mins}m`;
}

/** True when the owner can no longer change this entry. */
export function isEntryLocked(entry, rules = DEFAULT_RULES, now = new Date()) {
  if (["submitted", "approved"].includes(entry.status)) return true;
  const lockAfterDays = Number(rules.timesheet?.lockAfterDays || 0);
  if (!lockAfterDays) return false;
  return now.getTime() - new Date(entry.startedAt).getTime() > lockAfterDays * 86400000;
}

/**
 * Validates a finished task entry against the timesheet rules before it is
 * saved. `others` are the person's other entries. Returns an error message
 * or "" when the entry is fine. The database trigger applies the same rules.
 */
export function validateTimeEntry(entry, { rules = DEFAULT_RULES, others = [], tasks = [], member = null } = {}) {
  const sheet = rules.timesheet || DEFAULT_RULES.timesheet;
  if (entry.kind === "attendance") return "";
  if (entry.source === "manual" && !sheet.allowManualEntries) return "Manual entries are turned off. Use the timer.";
  if (entry.endedAt && new Date(entry.endedAt) < new Date(entry.startedAt)) return "The end time is before the start time.";
  if (entry.endedAt && new Date(entry.endedAt).getTime() > Date.now() + 5 * 60000) return "Time can't be logged in the future.";
  if (sheet.requireNote && entry.endedAt && !String(entry.note || "").trim()) return "Add a short note describing the work.";
  if (!entry.taskId) return "Pick a task.";
  if (sheet.onlyAssignedTasks && member) {
    const task = tasks.find((item) => item.id === entry.taskId);
    if (task && !isAssignedTo(task, member)) return "You can only log time on tasks assigned to you.";
  }
  if (entry.endedAt) {
    const day = localDay(entry.startedAt);
    const sameDay = others
      .filter((item) => item.id !== entry.id && item.kind !== "attendance" && localDay(item.startedAt) === day)
      .reduce((sum, item) => sum + entryMinutes(item), 0);
    if (sameDay + entryMinutes(entry) > Number(sheet.maxHoursPerDay || 24) * 60) {
      return `That would be more than ${sheet.maxHoursPerDay} hours on ${day}.`;
    }
  }
  return "";
}

/** Caps a timer that ran longer than the rule allows. */
export function capTimerEnd(startedAt, endedAt, rules = DEFAULT_RULES) {
  const capHours = Number(rules.timesheet?.autoStopAfterHours || 0);
  if (!capHours) return { endedAt, capped: false };
  const limit = new Date(startedAt).getTime() + capHours * 3600000;
  return new Date(endedAt).getTime() > limit
    ? { endedAt: new Date(limit).toISOString(), capped: true }
    : { endedAt, capped: false };
}

export function emailAllowed(email, rules = DEFAULT_RULES) {
  const domains = String(rules.security?.allowedEmailDomains || "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
  if (!domains.length) return true;
  const domain = String(email || "").toLowerCase().split("@")[1] || "";
  return domains.includes(domain);
}

export const ROLE_LABEL = Object.fromEntries(ROLES.map((role) => [role.key, role.label]));
