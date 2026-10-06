-- Project Planner: Supabase schema with row level security.
--
-- Run in the Supabase dashboard (SQL Editor) for a new project. The script
-- is idempotent, so it can also be re-run on an existing project to add
-- missing tables, indexes and policies. Review it against your current
-- schema before running it on production data.
--
-- Security model:
--   * Every row belongs to one user (user_id = auth.uid()).
--   * Users can only read and change their own rows.
--   * Users with role 'admin' in user_profiles can additionally READ all
--     rows, for the centralized portfolio report.
--   * Nobody can make themselves an admin from the app: profiles are created
--     with role 'user', and only the service role (dashboard / SQL) can
--     change roles.

-- gen_random_uuid() is built into Postgres 13+ (Supabase runs 15+).

-- ---------------------------------------------------------------- profiles

create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

-- SECURITY DEFINER so policies can check the role without recursing into
-- user_profiles' own policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "profiles: read own" on public.user_profiles;
create policy "profiles: read own" on public.user_profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles: create own as user" on public.user_profiles;
create policy "profiles: create own as user" on public.user_profiles
  for insert to authenticated
  with check (id = auth.uid() and role = 'user');

-- No update/delete policies: roles are changed by an administrator in the
-- dashboard (service role bypasses RLS), never from the browser.

-- ---------------------------------------------------------------- projects

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Untitled Project',
  description text not null default '',
  project_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists projects_local_id_idx on public.projects (user_id, (project_data ->> 'id'));

alter table public.projects enable row level security;

drop policy if exists "projects: read own or admin" on public.projects;
create policy "projects: read own or admin" on public.projects
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "projects: insert own" on public.projects;
create policy "projects: insert own" on public.projects
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "projects: update own" on public.projects;
create policy "projects: update own" on public.projects
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "projects: delete own" on public.projects;
create policy "projects: delete own" on public.projects
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------- weekly reports

create table if not exists public.weekly_reports (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id text not null default '',
  report_data jsonb not null default '{}'::jsonb,
  reporting_week text not null default '',
  report_date text not null default '',
  overall_status text not null default 'Green',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists weekly_reports_user_id_idx on public.weekly_reports (user_id);

alter table public.weekly_reports enable row level security;

drop policy if exists "reports: read own or admin" on public.weekly_reports;
create policy "reports: read own or admin" on public.weekly_reports
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "reports: insert own" on public.weekly_reports;
create policy "reports: insert own" on public.weekly_reports
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "reports: update own" on public.weekly_reports;
create policy "reports: update own" on public.weekly_reports
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "reports: delete own" on public.weekly_reports;
create policy "reports: delete own" on public.weekly_reports
  for delete to authenticated
  using (user_id = auth.uid());

-- ------------------------------------------------------- project documents

create table if not exists public.project_documents (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id text not null default '',
  document_data jsonb not null default '{}'::jsonb,
  title text not null default 'Untitled Document',
  document_type text not null default 'Other',
  status text not null default 'Draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_documents_user_id_idx on public.project_documents (user_id);

alter table public.project_documents enable row level security;

drop policy if exists "documents: read own or admin" on public.project_documents;
create policy "documents: read own or admin" on public.project_documents
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "documents: insert own" on public.project_documents;
create policy "documents: insert own" on public.project_documents
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "documents: update own" on public.project_documents;
create policy "documents: update own" on public.project_documents
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "documents: delete own" on public.project_documents;
create policy "documents: delete own" on public.project_documents
  for delete to authenticated
  using (user_id = auth.uid());

-- ----------------------------------------------------- centralized reports

create table if not exists public.centralized_reports (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Centralized Projects Report',
  report_date date not null default current_date,
  report_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.centralized_reports enable row level security;

drop policy if exists "central: admins read" on public.centralized_reports;
create policy "central: admins read" on public.centralized_reports
  for select to authenticated
  using (public.is_admin());

drop policy if exists "central: admins insert" on public.centralized_reports;
create policy "central: admins insert" on public.centralized_reports
  for insert to authenticated
  with check (created_by = auth.uid() and public.is_admin());

-- To make someone an administrator (run in the SQL editor):
--   update public.user_profiles set role = 'admin' where email = 'person@company.com';
