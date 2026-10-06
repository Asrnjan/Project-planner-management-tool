// Team data: members, roles and rules, time entries and the activity log.
//
// Cloud mode stores everything in Supabase, where row level security and
// triggers enforce access and timesheet rules (supabase/schema.sql). Local
// mode keeps the same data in this browser and applies the same rules here,
// so the Admin and Timesheet pages work without a server.
import { supabase } from "../lib/supabaseClient";
import {
  DEFAULT_RULES,
  capTimerEnd,
  emailAllowed,
  isEntryLocked,
  mergeRolePermissions,
  mergeRules,
  validateTimeEntry,
} from "../domain/permissions";

export const LOCAL_MEMBER_ID = "local-owner";
const LOCAL_KEY = "pm-team-v1";

const nowIso = () => new Date().toISOString();
const makeId = (prefix) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

// ------------------------------------------------------------ row mapping

export function mapMember(row) {
  if (!row || !row.id) return null;
  return {
    id: row.id,
    email: row.email || "",
    displayName: row.display_name || "",
    userId: row.user_id || "",
    role: row.role || "member",
    permissions: row.permissions || {},
    projectIds: Array.isArray(row.project_ids) ? row.project_ids : null,
    active: row.active !== false,
    lastSignInAt: row.last_sign_in_at || "",
    createdAt: row.created_at || "",
  };
}

function memberToRow(member) {
  const row = {};
  if ("email" in member) row.email = String(member.email || "").trim().toLowerCase();
  if ("displayName" in member) row.display_name = String(member.displayName || "").trim();
  if ("role" in member) row.role = member.role;
  if ("permissions" in member) row.permissions = member.permissions || {};
  if ("projectIds" in member) row.project_ids = Array.isArray(member.projectIds) ? member.projectIds : null;
  if ("active" in member) row.active = Boolean(member.active);
  return row;
}

export function mapEntry(row) {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind || "task",
    projectId: row.project_id || "",
    taskId: row.task_id || "",
    taskTitle: row.task_title || "",
    startedAt: row.started_at,
    endedAt: row.ended_at || "",
    note: row.note || "",
    source: row.source || "timer",
    status: row.status || "open",
    reviewedBy: row.reviewed_by || "",
    reviewedAt: row.reviewed_at || "",
    reviewNote: row.review_note || "",
  };
}

function entryToRow(entry) {
  const row = {};
  const map = {
    kind: "kind",
    projectId: "project_id",
    taskId: "task_id",
    taskTitle: "task_title",
    startedAt: "started_at",
    endedAt: "ended_at",
    note: "note",
    source: "source",
    status: "status",
    reviewNote: "review_note",
  };
  Object.entries(map).forEach(([key, column]) => {
    if (key in entry) row[column] = entry[key] === "" && key === "endedAt" ? null : entry[key];
  });
  return row;
}

function mapAudit(row) {
  return {
    id: String(row.id),
    at: row.at,
    actorEmail: row.actor_email || "",
    action: row.action,
    target: row.target || "",
    detail: row.detail || {},
  };
}

function cleanError(error) {
  const message = String(error?.message || error || "Something went wrong.");
  return new Error(message.replace(/^.*?ERROR:\s*/i, ""));
}

async function run(query) {
  const { data, error } = await query;
  if (error) throw cleanError(error);
  return data;
}

// ------------------------------------------------------------- local store

function readLocal() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // Corrupt or blocked storage falls back to a fresh team.
  }
  return null;
}

function writeLocal(data) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked: changes last for this tab only.
  }
}

function localTeam() {
  const existing = readLocal();
  if (existing) return existing;
  const fresh = {
    members: [
      {
        id: LOCAL_MEMBER_ID,
        email: "you@this-device",
        displayName: "",
        userId: LOCAL_MEMBER_ID,
        role: "admin",
        permissions: {},
        projectIds: null,
        active: true,
        lastSignInAt: nowIso(),
        createdAt: nowIso(),
      },
    ],
    settings: { roles: {}, rules: DEFAULT_RULES },
    entries: [],
    audit: [],
  };
  writeLocal(fresh);
  return fresh;
}

function updateLocal(mutator) {
  const data = localTeam();
  const result = mutator(data);
  writeLocal(data);
  return result;
}

function localAudit(data, action, target = "", detail = {}) {
  data.audit.unshift({ id: makeId("audit"), at: nowIso(), actorEmail: "you (this device)", action, target, detail });
  data.audit = data.audit.slice(0, 500);
}

// ------------------------------------------------------------- the service

/**
 * createTeamService(mode) returns the same API for "cloud" and "local".
 * `context` supplies the current member and the planner tasks, which local
 * mode needs to apply the timesheet rules.
 */
export function createTeamService(mode) {
  return mode === "cloud" ? cloudService : localService;
}

const cloudService = {
  mode: "cloud",

  async claimMembership() {
    const data = await run(supabase.rpc("claim_membership"));
    const row = Array.isArray(data) ? data[0] : data;
    return mapMember(row);
  },

  async listMembers() {
    const data = await run(supabase.from("workspace_members").select("*").order("created_at"));
    return data.map(mapMember);
  },

  async addMember(member) {
    const data = await run(supabase.from("workspace_members").insert(memberToRow(member)).select().single());
    return mapMember(data);
  },

  async updateMember(id, changes) {
    const data = await run(supabase.from("workspace_members").update(memberToRow(changes)).eq("id", id).select().single());
    return mapMember(data);
  },

  async removeMember(id) {
    await run(supabase.from("workspace_members").delete().eq("id", id));
  },

  async getSettings() {
    const data = await run(supabase.from("workspace_settings").select("roles, rules").eq("id", 1).maybeSingle());
    return { roles: mergeRolePermissions(data?.roles), rules: mergeRules(data?.rules) };
  },

  async saveSettings({ roles, rules }) {
    const payload = {};
    if (roles) {
      const { admin: _admin, ...rest } = roles;
      payload.roles = rest;
    }
    if (rules) payload.rules = rules;
    const data = await run(supabase.from("workspace_settings").update(payload).eq("id", 1).select("roles, rules").single());
    return { roles: mergeRolePermissions(data.roles), rules: mergeRules(data.rules) };
  },

  async listEntries({ from, to, userId, status } = {}) {
    let query = supabase.from("time_entries").select("*").order("started_at", { ascending: false }).limit(2000);
    if (from) query = query.gte("started_at", from);
    if (to) query = query.lt("started_at", to);
    if (userId) query = query.eq("user_id", userId);
    if (status) query = query.eq("status", status);
    return (await run(query)).map(mapEntry);
  },

  async startTimer(entry) {
    const data = await run(
      supabase.from("time_entries").insert({ ...entryToRow(entry), source: "timer", ended_at: null }).select().single()
    );
    return mapEntry(data);
  },

  async stopTimer(id, note) {
    const changes = { ended_at: nowIso() };
    if (typeof note === "string") changes.note = note;
    const data = await run(supabase.from("time_entries").update(changes).eq("id", id).select().single());
    return mapEntry(data);
  },

  async addManualEntry(entry) {
    const data = await run(supabase.from("time_entries").insert({ ...entryToRow(entry), source: "manual" }).select().single());
    return mapEntry(data);
  },

  async updateEntry(id, changes) {
    const data = await run(supabase.from("time_entries").update(entryToRow(changes)).eq("id", id).select().single());
    return mapEntry(data);
  },

  async deleteEntry(id) {
    await run(supabase.from("time_entries").delete().eq("id", id));
  },

  async setEntriesStatus(ids, status, reviewNote = "") {
    if (!ids.length) return [];
    const changes = { status };
    if (status === "approved" || status === "rejected") changes.review_note = reviewNote;
    const data = await run(supabase.from("time_entries").update(changes).in("id", ids).select());
    return data.map(mapEntry);
  },

  async listAudit({ limit = 200 } = {}) {
    const data = await run(supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(limit));
    return data.map(mapAudit);
  },

  async logEvent(action, target = "", detail = {}) {
    const { data } = await supabase.auth.getSession();
    const userId = data?.session?.user?.id;
    if (!userId) return;
    // Best effort: the activity log must never block the user's work.
    await supabase
      .from("audit_log")
      .insert({ actor_id: userId, actor_email: data.session.user.email || "", action: `app.${action}`, target, detail });
  },
};

function requireLocalTask(entry, context) {
  const message = validateTimeEntry(entry, {
    rules: context.rules,
    others: localTeam().entries.filter((item) => item.userId === entry.userId),
    tasks: context.tasks || [],
    member: context.member,
  });
  if (message) throw new Error(message);
}

const localService = {
  mode: "local",

  async claimMembership() {
    return localTeam().members.find((member) => member.id === LOCAL_MEMBER_ID);
  },

  async listMembers() {
    return localTeam().members;
  },

  async addMember(member) {
    return updateLocal((data) => {
      const email = String(member.email || "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");
      if (data.members.some((item) => item.email === email)) throw new Error("This person is already in the team.");
      if (!emailAllowed(email, mergeRules(data.settings.rules))) {
        throw new Error(`Only addresses at ${data.settings.rules.security.allowedEmailDomains} can be added.`);
      }
      const id = makeId("member");
      const created = {
        id,
        email,
        displayName: String(member.displayName || "").trim(),
        // Local people have no sign-in; their id stands in for one so that
        // "Preview as" can log time on their behalf.
        userId: id,
        role: member.role || "member",
        permissions: member.permissions || {},
        projectIds: Array.isArray(member.projectIds) ? member.projectIds : null,
        active: member.active !== false,
        lastSignInAt: "",
        createdAt: nowIso(),
      };
      data.members.push(created);
      localAudit(data, "member.added", email, { role: created.role });
      return created;
    });
  },

  async updateMember(id, changes) {
    return updateLocal((data) => {
      const member = data.members.find((item) => item.id === id);
      if (!member) throw new Error("This person is no longer in the team.");
      const next = { ...member, ...changes };
      if (member.role === "admin" && (next.role !== "admin" || !next.active)) {
        const otherAdmins = data.members.filter((item) => item.id !== id && item.role === "admin" && item.active);
        if (!otherAdmins.length) throw new Error("The workspace needs at least one active administrator.");
      }
      Object.assign(member, next);
      localAudit(data, "member.updated", member.email, changes);
      return member;
    });
  },

  async removeMember(id) {
    updateLocal((data) => {
      if (id === LOCAL_MEMBER_ID) throw new Error("You can't remove yourself.");
      const member = data.members.find((item) => item.id === id);
      data.members = data.members.filter((item) => item.id !== id);
      if (member) localAudit(data, "member.removed", member.email, { role: member.role });
    });
  },

  async getSettings() {
    const { settings } = localTeam();
    return { roles: mergeRolePermissions(settings.roles), rules: mergeRules(settings.rules) };
  },

  async saveSettings({ roles, rules }) {
    return updateLocal((data) => {
      if (roles) data.settings.roles = roles;
      if (rules) data.settings.rules = rules;
      localAudit(data, "settings.updated", "", { roles: roles ? "changed" : undefined, rules: rules ? "changed" : undefined });
      return { roles: mergeRolePermissions(data.settings.roles), rules: mergeRules(data.settings.rules) };
    });
  },

  async listEntries({ from, to, userId, status } = {}) {
    return localTeam()
      .entries.filter(
        (entry) =>
          (!from || entry.startedAt >= from) &&
          (!to || entry.startedAt < to) &&
          (!userId || entry.userId === userId) &&
          (!status || entry.status === status)
      )
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  },

  async startTimer(entry, context = {}) {
    const created = {
      id: makeId("time"),
      userId: context.member?.userId || LOCAL_MEMBER_ID,
      kind: entry.kind || "task",
      projectId: entry.projectId || "",
      taskId: entry.taskId || "",
      taskTitle: entry.taskTitle || "",
      startedAt: nowIso(),
      endedAt: "",
      note: entry.note || "",
      source: "timer",
      status: "open",
    };
    if (created.kind === "task") requireLocalTask(created, context);
    return updateLocal((data) => {
      if (data.entries.some((item) => item.userId === created.userId && item.kind === created.kind && !item.endedAt)) {
        throw new Error(created.kind === "attendance" ? "You are already clocked in." : "A task timer is already running. Stop it first.");
      }
      data.entries.push(created);
      return created;
    });
  },

  async stopTimer(id, note, context = {}) {
    const entry = localTeam().entries.find((item) => item.id === id);
    if (!entry) throw new Error("This timer no longer exists.");
    const { endedAt, capped } = capTimerEnd(entry.startedAt, nowIso(), context.rules);
    const stopped = {
      ...entry,
      endedAt,
      note: `${typeof note === "string" ? note : entry.note}${capped ? ` (timer stopped automatically after ${context.rules.timesheet.autoStopAfterHours} h)` : ""}`.trim(),
    };
    if (stopped.kind === "task") requireLocalTask(stopped, context);
    return updateLocal((data) => {
      Object.assign(data.entries.find((item) => item.id === id), stopped);
      return stopped;
    });
  },

  async addManualEntry(entry, context = {}) {
    const created = {
      id: makeId("time"),
      userId: context.member?.userId || LOCAL_MEMBER_ID,
      kind: "task",
      projectId: entry.projectId || "",
      taskId: entry.taskId || "",
      taskTitle: entry.taskTitle || "",
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      note: entry.note || "",
      source: "manual",
      status: "open",
    };
    if (!created.endedAt) throw new Error("A manual entry needs an end time.");
    if (isEntryLocked({ ...created, status: "open" }, context.rules)) {
      throw new Error(`Entries older than ${context.rules.timesheet.lockAfterDays} days are locked.`);
    }
    requireLocalTask(created, context);
    return updateLocal((data) => {
      data.entries.push(created);
      return created;
    });
  },

  async updateEntry(id, changes, context = {}) {
    const entry = localTeam().entries.find((item) => item.id === id);
    if (!entry) throw new Error("This entry no longer exists.");
    if (isEntryLocked(entry, context.rules)) throw new Error("This entry is locked.");
    const timesChanged = ("startedAt" in changes && changes.startedAt !== entry.startedAt) || ("endedAt" in changes && changes.endedAt !== entry.endedAt);
    const next = {
      ...entry,
      ...changes,
      source: timesChanged ? "manual" : entry.source,
      // Correcting time that was sent back makes it a draft again.
      status: entry.status === "rejected" ? "open" : entry.status,
    };
    if (next.kind === "task") requireLocalTask(next, context);
    return updateLocal((data) => {
      Object.assign(data.entries.find((item) => item.id === id), next);
      return next;
    });
  },

  async deleteEntry(id, context = {}) {
    const entry = localTeam().entries.find((item) => item.id === id);
    if (entry && isEntryLocked(entry, context.rules)) throw new Error("Submitted, approved or locked time can't be deleted.");
    updateLocal((data) => {
      data.entries = data.entries.filter((item) => item.id !== id);
    });
  },

  async setEntriesStatus(ids, status, reviewNote = "", context = {}) {
    const rules = context.rules || DEFAULT_RULES;
    return updateLocal((data) => {
      const changed = [];
      data.entries.forEach((entry) => {
        if (!ids.includes(entry.id)) return;
        if (status === "submitted") {
          if (!entry.endedAt) throw new Error("Stop the timer before submitting.");
          entry.status = rules.timesheet.requireApproval ? "submitted" : "approved";
        } else if (status === "open") {
          if (entry.status !== "submitted") return;
          entry.status = "open";
        } else {
          if (entry.status !== "submitted") return;
          entry.status = status;
          entry.reviewNote = reviewNote;
          entry.reviewedAt = nowIso();
          entry.reviewedBy = context.member?.userId || LOCAL_MEMBER_ID;
        }
        changed.push({ ...entry });
      });
      if (status === "approved" || status === "rejected") localAudit(data, `timesheet.${status}`, `${changed.length} entries`, {});
      return changed;
    });
  },

  async listAudit({ limit = 200 } = {}) {
    return localTeam().audit.slice(0, limit);
  },

  async logEvent(action, target = "", detail = {}) {
    updateLocal((data) => localAudit(data, `app.${action}`, target, detail));
  },
};
