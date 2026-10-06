import { describe, expect, it } from "vitest";
import {
  DEFAULT_RULES,
  canAccessProject,
  capTimerEnd,
  checkTaskEdit,
  emailAllowed,
  filterTaskChanges,
  isAssignedTo,
  isEntryLocked,
  resolvePermissions,
  validateTimeEntry,
} from "./permissions";

const priya = { id: "m1", userId: "u1", email: "priya@company.com", displayName: "Priya Shah", role: "member", projectIds: ["p1"] };
const access = (member, rules = DEFAULT_RULES) => ({ member, permissions: resolvePermissions(member), rules });
const task = (overrides) => ({ id: "t1", projectId: "p1", title: "Task", owner: "Priya Shah", status: "Not Started", plannedStart: "2026-10-01", ...overrides });

describe("resolvePermissions", () => {
  it("gives administrators everything and applies per-person exceptions", () => {
    expect(Object.values(resolvePermissions({ role: "admin" })).every(Boolean)).toBe(true);
    expect(resolvePermissions(priya)["tasks.edit_all"]).toBe(false);
    expect(resolvePermissions({ ...priya, permissions: { "tasks.edit_all": true, "ai.use": false } })).toMatchObject({
      "tasks.edit_all": true,
      "ai.use": false,
    });
    expect(Object.values(resolvePermissions({ ...priya, active: false })).some(Boolean)).toBe(false);
  });

  it("uses the workspace's role settings", () => {
    expect(resolvePermissions(priya, { member: { "reports.write": true } })["reports.write"]).toBe(true);
  });
});

describe("project access and assignment", () => {
  it("limits members to their projects", () => {
    expect(canAccessProject(priya, "p1")).toBe(true);
    expect(canAccessProject(priya, "p2")).toBe(false);
    expect(canAccessProject({ ...priya, projectIds: null }, "p2")).toBe(true);
    expect(canAccessProject({ ...priya, role: "admin" }, "p2")).toBe(true);
  });

  it("matches task owners by name, email or email name", () => {
    expect(isAssignedTo(task({ owner: " priya shah " }), priya)).toBe(true);
    expect(isAssignedTo(task({ owner: "priya" }), priya)).toBe(true);
    expect(isAssignedTo(task({ owner: "Leo" }), priya)).toBe(false);
    expect(isAssignedTo(task({ owner: "" }), priya)).toBe(false);
  });
});

describe("checkTaskEdit", () => {
  it("lets assignees update progress but not dates or other fields", () => {
    expect(checkTaskEdit(access(priya), task(), ["status", "actualProgress", "notes"]).ok).toBe(true);
    expect(checkTaskEdit(access(priya), task(), ["plannedStart"]).ok).toBe(false);
    expect(checkTaskEdit(access(priya), task(), ["title"]).ok).toBe(false);
    expect(checkTaskEdit(access(priya), task({ owner: "Leo" }), ["status"]).reason).toMatch(/assigned to you/);
  });

  it("lets assignees change dates when the rule allows it", () => {
    const rules = { ...DEFAULT_RULES, tasks: { ...DEFAULT_RULES.tasks, membersCanChangeDates: true } };
    expect(checkTaskEdit(access(priya, rules), task(), ["plannedStart", "durationDays"]).ok).toBe(true);
  });

  it("locks finished tasks when the rule is on", () => {
    const rules = { ...DEFAULT_RULES, tasks: { ...DEFAULT_RULES.tasks, lockDoneTasks: true } };
    expect(checkTaskEdit(access(priya, rules), task({ status: "Done" }), ["status"]).ok).toBe(false);
    expect(checkTaskEdit(access({ ...priya, role: "manager" }, rules), task({ status: "Done" }), ["status"]).ok).toBe(true);
  });

  it("blocks projects the person can't see and roles without edit rights", () => {
    expect(checkTaskEdit(access(priya), task({ projectId: "p2" }), ["status"]).ok).toBe(false);
    expect(checkTaskEdit(access({ ...priya, role: "viewer" }), task(), ["status"]).ok).toBe(false);
  });
});

describe("filterTaskChanges", () => {
  it("keeps allowed changes, reverts the rest and explains why", () => {
    const before = [task(), task({ id: "t2", owner: "Leo", title: "Leo's" })];
    const after = [task({ status: "Done", actualProgress: 100 }), task({ id: "t2", owner: "Leo", title: "Renamed" }), task({ id: "t3" })];
    const { tasks, denied } = filterTaskChanges(access(priya), before, after);
    expect(tasks.find((item) => item.id === "t1").status).toBe("Done");
    expect(tasks.find((item) => item.id === "t2").title).toBe("Leo's");
    expect(tasks.some((item) => item.id === "t3")).toBe(false);
    expect(denied.map((item) => item.reason)).toEqual([expect.stringMatching(/assigned/), expect.stringMatching(/add tasks/)]);
  });

  it("lets summary tasks roll up from subtasks", () => {
    const parent = task({ id: "p", owner: "Leo", isSummaryTask: true, actualProgress: 0 });
    const child = task({ id: "c", parentTaskId: "p" });
    const { denied } = filterTaskChanges(access(priya), [parent, child], [{ ...parent, actualProgress: 50 }, { ...child, actualProgress: 100 }]);
    expect(denied).toEqual([]);
  });

  it("keeps deleted tasks when the role can't delete", () => {
    const { tasks, denied } = filterTaskChanges(access(priya), [task()], []);
    expect(tasks).toHaveLength(1);
    expect(denied[0].reason).toMatch(/delete/);
  });
});

describe("timesheet rules", () => {
  const entry = (overrides) => ({ id: "e1", kind: "task", taskId: "t1", source: "manual", startedAt: "2026-10-05T09:00:00Z", endedAt: "2026-10-05T10:00:00Z", note: "", ...overrides });

  it("validates manual entries against the rules", () => {
    const tasks = [task(), task({ id: "t2", owner: "Leo" })];
    expect(validateTimeEntry(entry(), { tasks, member: priya })).toBe("");
    expect(validateTimeEntry(entry({ taskId: "t2" }), { tasks, member: priya })).toMatch(/assigned/);
    expect(validateTimeEntry(entry({ endedAt: "2026-10-05T08:00:00Z" }))).toMatch(/before/);
    const noManual = { ...DEFAULT_RULES, timesheet: { ...DEFAULT_RULES.timesheet, allowManualEntries: false, requireNote: true } };
    expect(validateTimeEntry(entry(), { rules: noManual })).toMatch(/turned off/);
    expect(validateTimeEntry(entry({ source: "timer" }), { rules: noManual })).toMatch(/note/);
  });

  it("enforces the daily maximum", () => {
    const others = [entry({ id: "e0", startedAt: "2026-10-05T00:00:00Z", endedAt: "2026-10-05T11:30:00Z" })];
    expect(validateTimeEntry(entry(), { others })).toMatch(/more than 12 hours/);
  });

  it("locks submitted and old entries", () => {
    expect(isEntryLocked({ status: "submitted", startedAt: new Date().toISOString() })).toBe(true);
    expect(isEntryLocked({ status: "open", startedAt: new Date().toISOString() })).toBe(false);
    expect(isEntryLocked({ status: "open", startedAt: "2020-01-01T00:00:00Z" })).toBe(true);
  });

  it("caps forgotten timers", () => {
    expect(capTimerEnd("2026-10-05T08:00:00Z", "2026-10-06T08:00:00Z")).toEqual({ endedAt: "2026-10-05T18:00:00.000Z", capped: true });
    expect(capTimerEnd("2026-10-05T08:00:00Z", "2026-10-05T09:00:00Z").capped).toBe(false);
  });

  it("checks allowed email domains", () => {
    const rules = { ...DEFAULT_RULES, security: { ...DEFAULT_RULES.security, allowedEmailDomains: "company.com, @partner.io" } };
    expect(emailAllowed("a@company.com", rules)).toBe(true);
    expect(emailAllowed("a@partner.io", rules)).toBe(true);
    expect(emailAllowed("a@gmail.com", rules)).toBe(false);
    expect(emailAllowed("a@gmail.com")).toBe(true);
  });
});
