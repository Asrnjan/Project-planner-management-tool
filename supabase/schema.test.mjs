// Applies supabase/schema.sql to an in-memory Postgres (PGlite) with a
// minimal stand-in for Supabase's auth schema, then checks that row level
// security isolates users and that nobody can make themselves an admin.
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const schema = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

let db;

async function as(user, sql) {
  await db.exec(`set role authenticated; select set_config('request.jwt.sub', '${user}', false);`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role;");
  }
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
  await db.exec(`insert into auth.users values ('${A}','a@x.com'),('${B}','b@x.com');`);
}, 60_000);

describe("supabase/schema.sql", () => {
  it("can be applied again (idempotent)", async () => {
    await expect(db.exec(schema)).resolves.toBeDefined();
  });

  it("lets users create their own profile but never as admin", async () => {
    await as(A, `insert into user_profiles (id, email) values ('${A}', 'a@x.com')`);
    await expect(as(B, `insert into user_profiles (id, email, role) values ('${B}', 'b', 'admin')`)).rejects.toThrow();
    await expect(as(B, `insert into user_profiles (id, email) values ('${A}', 'evil')`)).rejects.toThrow();
    await as(B, `insert into user_profiles (id, email) values ('${B}', 'b@x.com')`);
    const promoted = await as(B, `update user_profiles set role = 'admin' where id = '${B}' returning id`);
    expect(promoted.rows).toHaveLength(0);
  });

  it("isolates projects between users", async () => {
    await as(A, `insert into projects (user_id, name, project_data) values ('${A}', 'A1', '{"id":"p-a"}')`);
    await as(B, `insert into projects (user_id, name) values ('${B}', 'B1')`);
    await expect(as(B, `insert into projects (user_id, name) values ('${A}', 'spoof')`)).rejects.toThrow();
    expect((await as(B, "select name from projects")).rows).toEqual([{ name: "B1" }]);
    expect((await as(B, "update projects set name = 'x' where name = 'A1' returning id")).rows).toHaveLength(0);
    expect((await as(B, "delete from projects where name = 'A1' returning id")).rows).toHaveLength(0);
    expect((await as(A, `select id from projects where user_id = '${A}' and project_data->>'id' = 'p-a'`)).rows).toHaveLength(1);
  });

  it("blocks overwriting another user's report through upsert", async () => {
    await as(A, `insert into weekly_reports (id, user_id, project_id) values ('r1', '${A}', 'p-a')`);
    await expect(
      as(B, `insert into weekly_reports (id, user_id, project_id) values ('r1', '${B}', 'x') on conflict (id) do update set report_data = '{}'`)
    ).rejects.toThrow();
  });

  it("gives admins read-only access to everyone's data", async () => {
    await expect(as(A, `insert into centralized_reports (created_by) values ('${A}')`)).rejects.toThrow();
    await db.exec(`update user_profiles set role = 'admin' where id = '${A}'`);
    expect((await as(A, "select name from projects")).rows).toHaveLength(2);
    expect((await as(A, "update projects set name = 'x' where name = 'B1' returning id")).rows).toHaveLength(0);
    await as(A, `insert into centralized_reports (created_by) values ('${A}')`);
  });
});
