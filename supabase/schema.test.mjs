// Applies supabase/schema.sql to an in-memory Postgres (PGlite) with a
// minimal stand-in for Supabase's auth schema, then checks the team access
// model: invitations, roles, project access, escalation guards, timesheet
// rules and the activity log.
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import { DEFAULT_ROLE_PERMISSIONS, DEFAULT_RULES } from "../src/domain/permissions.js";

const ADMIN = "11111111-1111-1111-1111-111111111111";
const MEMBER = "22222222-2222-2222-2222-222222222222";
const MANAGER = "33333333-3333-3333-3333-333333333333";
const STRANGER = "44444444-4444-4444-4444-444444444444";
const schema = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

let db;

async function as(user, sql) {
  await db.exec(`set role authenticated; select set_config('request.jwt.sub', '${user}', false);`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role; select set_config('request.jwt.sub', '', false);");
  }
}

const one = async (user, sql) => (await as(user, sql)).rows[0];

async function addProject(localId, tasks = []) {
  await db.query(
    `insert into projects (user_id, name, project_data) values ($1, $2, $3)`,
    [ADMIN, localId, JSON.stringify({ id: localId, tasks })]
  );
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role authenticated; create role anon;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
    grant usage on schema public, auth to authenticated;
    grant execute on function auth.uid() to authenticated;
  `);
  await db.exec(schema);
  await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;`);
  await db.exec(`
    insert into auth.users values
      ('${ADMIN}','Owner@Company.com'), ('${MEMBER}','priya@company.com'),
      ('${MANAGER}','leo@company.com'), ('${STRANGER}','eve@elsewhere.com');
  `);
  await addProject("p1", [
    { id: "t1", title: "Mine", owner: "Priya Shah" },
    { id: "t2", title: "Someone else's", owner: "Leo Martins" },
  ]);
  await addProject("p2", [{ id: "t3", title: "Secret", owner: "Priya Shah" }]);
}, 60_000);

describe("supabase/schema.sql", () => {
  it("can be applied again (idempotent)", async () => {
    await expect(db.exec(schema)).resolves.toBeDefined();
  });

  it("seeds the same roles and rules as the app", async () => {
    const { rows } = await db.query("select roles, rules from workspace_settings where id = 1");
    const roles = Object.fromEntries(Object.entries(DEFAULT_ROLE_PERMISSIONS).filter(([role]) => role !== "admin"));
    expect(rows[0].roles).toEqual(roles);
    expect(rows[0].rules).toEqual(DEFAULT_RULES);
  });

  it("makes the first person to sign in the administrator", async () => {
    const admin = await one(ADMIN, "select * from claim_membership()");
    expect(admin).toMatchObject({ role: "admin", email: "owner@company.com", user_id: ADMIN });
    expect((await as(ADMIN, "select name from projects order by name")).rows).toHaveLength(2);
  });

  it("gives uninvited people no access at all", async () => {
    const claimed = await one(STRANGER, "select * from claim_membership()");
    expect(claimed.id).toBeNull();
    expect((await as(STRANGER, "select * from projects")).rows).toHaveLength(0);
    expect((await as(STRANGER, "select * from workspace_members")).rows).toHaveLength(0);
    await expect(as(STRANGER, `insert into projects (user_id, name) values ('${STRANGER}', 'x')`)).rejects.toThrow();
  });

  it("lets the administrator invite people with a role and project access", async () => {
    await as(ADMIN, `insert into workspace_members (email, display_name, role, project_ids) values ('Priya@Company.com', 'Priya Shah', 'member', '{p1}')`);
    await as(ADMIN, `insert into workspace_members (email, display_name, role) values ('leo@company.com', 'Leo Martins', 'manager')`);
    const priya = await one(MEMBER, "select * from claim_membership()");
    expect(priya).toMatchObject({ role: "member", email: "priya@company.com", user_id: MEMBER });
    await one(MANAGER, "select * from claim_membership()");
  });

  it("limits members to their projects and permissions", async () => {
    expect((await as(MEMBER, "select name from projects")).rows).toEqual([{ name: "p1" }]);
    await expect(as(MEMBER, `insert into projects (user_id, name) values ('${MEMBER}', 'new')`)).rejects.toThrow();
    expect((await as(MEMBER, "update projects set name = 'p1' where name = 'p1' returning id")).rows).toHaveLength(1);
    expect((await as(MEMBER, "update projects set name = 'x' where name = 'p2' returning id")).rows).toHaveLength(0);
    expect((await as(MEMBER, "delete from projects where name = 'p1' returning id")).rows).toHaveLength(0);
    expect((await as(MANAGER, "select name from projects")).rows).toHaveLength(2);
  });

  it("refreshes updated_at on every save for conflict detection", async () => {
    const before = (await db.query("select updated_at from projects where name = 'p1'")).rows[0].updated_at;
    await as(MANAGER, "update projects set description = 'changed' where name = 'p1'");
    const after = (await db.query("select updated_at from projects where name = 'p1'")).rows[0].updated_at;
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });

  it("checks report and document permissions", async () => {
    await expect(as(MEMBER, `insert into weekly_reports (id, user_id, project_id) values ('r1', '${MEMBER}', 'p1')`)).rejects.toThrow();
    await as(MANAGER, `insert into weekly_reports (id, user_id, project_id) values ('r1', '${MANAGER}', 'p1')`);
    await as(MANAGER, `insert into weekly_reports (id, user_id, project_id) values ('r2', '${MANAGER}', 'p2')`);
    expect((await as(MEMBER, "select id from weekly_reports")).rows).toEqual([{ id: "r1" }]);
    await as(MEMBER, `insert into project_documents (id, user_id, project_id) values ('d1', '${MEMBER}', 'p1')`);
    await expect(as(MEMBER, `insert into project_documents (id, user_id, project_id) values ('d2', '${MEMBER}', 'p2')`)).rejects.toThrow();
  });

  it("stops people raising their own access", async () => {
    // Members can't even see an update path to their own row.
    await as(MEMBER, `update workspace_members set role = 'admin' where user_id = '${MEMBER}'`);
    expect((await db.query(`select role from workspace_members where user_id = '${MEMBER}'`)).rows[0].role).toBe("member");

    // A manager trusted with user management still can't create admins.
    await db.exec(`update workspace_members set permissions = '{"admin.users": true}' where user_id = '${MANAGER}'`);
    await expect(as(MANAGER, `insert into workspace_members (email, role) values ('x@company.com', 'admin')`)).rejects.toThrow(/administrator/);
    await expect(as(MANAGER, `update workspace_members set permissions = '{"admin.users": true}' where user_id = '${MEMBER}'`)).rejects.toThrow(/administrator/);
    await expect(as(MANAGER, `update workspace_members set role = 'viewer' where user_id = '${MANAGER}'`)).rejects.toThrow(/own access/);
    await expect(as(MANAGER, `update workspace_members set role = 'member' where user_id = '${ADMIN}'`)).rejects.toThrow(/administrator/);
    await as(MANAGER, `update workspace_members set role = 'viewer' where user_id = '${MEMBER}'`);
    await as(MANAGER, `update workspace_members set role = 'member' where user_id = '${MEMBER}'`);

    // Role editors can't hand a role admin rights either.
    await db.exec(`update workspace_members set permissions = '{"admin.roles_rules": true}' where user_id = '${MANAGER}'`);
    await expect(
      as(MANAGER, `update workspace_settings set roles = jsonb_set(roles, '{member,admin.users}', 'true')`)
    ).rejects.toThrow(/administration/);
    await db.exec(`update workspace_members set permissions = '{}' where user_id = '${MANAGER}'`);
  });

  it("keeps at least one administrator", async () => {
    await expect(as(ADMIN, `update workspace_members set role = 'manager' where user_id = '${ADMIN}'`)).rejects.toThrow(/at least one/);
    await expect(as(ADMIN, `update workspace_members set active = false where user_id = '${ADMIN}'`)).rejects.toThrow(/at least one/);
  });

  it("only accepts allowed email domains when the rule is set", async () => {
    await as(ADMIN, `update workspace_settings set rules = jsonb_set(rules, '{security,allowedEmailDomains}', '"company.com"')`);
    await expect(as(ADMIN, `insert into workspace_members (email) values ('eve@elsewhere.com')`)).rejects.toThrow(/company\.com/);
    await as(ADMIN, `insert into workspace_members (email) values ('sam@company.com')`);
    await as(ADMIN, `update workspace_settings set rules = jsonb_set(rules, '{security,allowedEmailDomains}', '""')`);
  });

  it("removes access as soon as someone is deactivated", async () => {
    await as(ADMIN, `update workspace_members set active = false where user_id = '${MEMBER}'`);
    expect((await as(MEMBER, "select * from projects")).rows).toHaveLength(0);
    await as(ADMIN, `update workspace_members set active = true where user_id = '${MEMBER}'`);
    expect((await as(MEMBER, "select * from projects")).rows).toHaveLength(1);
  });
});

describe("timesheets", () => {
  it("starts timers with the server's clock and allows one at a time", async () => {
    const entry = await one(
      MEMBER,
      `insert into time_entries (project_id, task_id, task_title, started_at) values ('p1', 't1', 'Mine', '2020-01-01') returning *`
    );
    expect(Date.now() - new Date(entry.started_at).getTime()).toBeLessThan(60_000);
    expect(entry.status).toBe("open");
    await expect(as(MEMBER, `insert into time_entries (project_id, task_id) values ('p1', 't1')`)).rejects.toThrow(/already running/);
  });

  it("stops timers with the server's clock", async () => {
    const stopped = await one(
      MEMBER,
      `update time_entries set ended_at = '2099-01-01' where ended_at is null and kind = 'task' returning *`
    );
    expect(new Date(stopped.ended_at).getFullYear()).toBe(new Date().getFullYear());
  });

  it("only allows time on assigned tasks and accessible projects", async () => {
    await expect(as(MEMBER, `insert into time_entries (project_id, task_id) values ('p1', 't2')`)).rejects.toThrow(/assigned to you/);
    await expect(as(MEMBER, `insert into time_entries (project_id, task_id) values ('p2', 't3')`)).rejects.toThrow(/access/);
  });

  it("enforces manual-entry, note and daily-limit rules", async () => {
    const manual = (start, end, note = "") =>
      as(MEMBER, `insert into time_entries (project_id, task_id, source, started_at, ended_at, note) values ('p1', 't1', 'manual', '${start}', '${end}', '${note}') returning *`);
    const today = new Date(Date.now() - 86400000).toISOString().slice(0, 10); // yesterday
    await manual(`${today}T00:00:00Z`, `${today}T00:30:00Z`);
    await expect(manual(`${today}T00:40:00Z`, `${today}T12:40:00Z`)).rejects.toThrow(/more than 12 hours/);

    await as(ADMIN, `update workspace_settings set rules = jsonb_set(rules, '{timesheet,requireNote}', 'true')`);
    await expect(manual(`${today}T00:40:00Z`, `${today}T00:45:00Z`)).rejects.toThrow(/note/);
    await manual(`${today}T00:40:00Z`, `${today}T00:45:00Z`, "Mapping review");

    await as(ADMIN, `update workspace_settings set rules = jsonb_set(rules, '{timesheet,allowManualEntries}', 'false')`);
    await expect(manual(`${today}T00:50:00Z`, `${today}T00:55:00Z`, "x")).rejects.toThrow(/turned off/);
    await as(ADMIN, `update workspace_settings set rules = jsonb_set(jsonb_set(rules, '{timesheet,allowManualEntries}', 'true'), '{timesheet,requireNote}', 'false')`);
  });

  it("runs the submit and approval flow", async () => {
    await as(MEMBER, `update time_entries set status = 'submitted' where user_id = '${MEMBER}' and ended_at is not null`);
    await expect(as(MEMBER, `update time_entries set note = 'edited' where user_id = '${MEMBER}'`)).rejects.toThrow(/cannot be changed/);
    await expect(as(MEMBER, `update time_entries set status = 'approved' where user_id = '${MEMBER}'`)).rejects.toThrow(/approvers/);

    const approved = await as(MANAGER, `update time_entries set status = 'approved', note = 'tampered' where user_id = '${MEMBER}' returning *`);
    expect(approved.rows.length).toBeGreaterThan(0);
    expect(approved.rows.every((row) => row.status === "approved" && row.reviewed_by === MANAGER && row.note !== "tampered")).toBe(true);
    await expect(as(MEMBER, `delete from time_entries where user_id = '${MEMBER}'`)).rejects.toThrow(/cannot be deleted/);
  });

  it("stops people approving their own time", async () => {
    await as(MANAGER, `insert into time_entries (project_id, task_id, source, started_at, ended_at) values ('p1', 't2', 'manual', now() - interval '1 hour', now())`);
    await as(MANAGER, `update time_entries set status = 'submitted' where user_id = '${MANAGER}'`);
    await expect(as(MANAGER, `update time_entries set status = 'approved' where user_id = '${MANAGER}'`)).rejects.toThrow(/your own/);
    expect((await as(ADMIN, `update time_entries set status = 'approved' where user_id = '${MANAGER}' returning id`)).rows).toHaveLength(1);
  });

  it("turns corrected rejected time back into a draft", async () => {
    const today = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const entry = await one(MEMBER, `insert into time_entries (project_id, task_id, source, started_at, ended_at) values ('p1', 't1', 'manual', '${today}T05:00:00Z', '${today}T05:30:00Z') returning id`);
    await as(MEMBER, `update time_entries set status = 'submitted' where id = '${entry.id}'`);
    await as(MANAGER, `update time_entries set status = 'rejected', review_note = 'Wrong task' where id = '${entry.id}'`);
    const fixed = await one(MEMBER, `update time_entries set note = 'Fixed' where id = '${entry.id}' returning status, review_note`);
    expect(fixed).toEqual({ status: "open", review_note: "Wrong task" });
    await as(MEMBER, `delete from time_entries where id = '${entry.id}'`);
  });

  it("locks old entries", async () => {
    await db.query(
      `insert into time_entries (user_id, project_id, task_id, source, started_at, ended_at) values ($1, 'p1', 't1', 'manual', now() - interval '30 days', now() - interval '30 days' + interval '1 hour')`,
      [MEMBER]
    );
    await expect(as(MEMBER, `update time_entries set note = 'late edit' where started_at < now() - interval '20 days'`)).rejects.toThrow(/locked/);
    await expect(as(MEMBER, `delete from time_entries where started_at < now() - interval '20 days'`)).rejects.toThrow(/locked/);
  });

  it("keeps each person's timesheet private unless they can see the team's", async () => {
    const own = (await as(MEMBER, "select distinct user_id from time_entries")).rows;
    expect(own).toEqual([{ user_id: MEMBER }]);
    const team = (await as(MANAGER, "select distinct user_id from time_entries")).rows;
    expect(team.length).toBeGreaterThan(1);
  });

  it("supports clocking in and out", async () => {
    await as(MEMBER, `insert into time_entries (kind) values ('attendance')`);
    await expect(as(MEMBER, `insert into time_entries (kind) values ('attendance')`)).rejects.toThrow(/clocked in/);
    const out = await one(MEMBER, `update time_entries set ended_at = now() where kind = 'attendance' and ended_at is null returning *`);
    expect(out.ended_at).not.toBeNull();
  });
});

describe("activity log", () => {
  it("records admin changes and sign-ins, readable by auditors only", async () => {
    const actions = (await as(ADMIN, "select action from audit_log")).rows.map((row) => row.action);
    expect(actions).toEqual(expect.arrayContaining(["workspace.claimed", "member.added", "member.joined", "member.updated", "settings.updated"]));
    expect((await as(MEMBER, "select * from audit_log")).rows).toHaveLength(0);
    await expect(as(MEMBER, `insert into audit_log (actor_id, action) values ('${MEMBER}', 'member.added')`)).rejects.toThrow();
    await as(MEMBER, `insert into audit_log (actor_id, action) values ('${MEMBER}', 'app.export')`);
  });
});
