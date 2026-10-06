-- Project Planner: Supabase schema with row level security.
--
-- Run in the Supabase dashboard (SQL Editor). The script is idempotent: it
-- can be re-run on an existing project to add missing tables, functions and
-- policies, and to upgrade a project created with an older version.
--
-- Security model (one shared team workspace per Supabase project):
--   * Access is invite-only. An administrator adds people by email in the
--     app's Admin page; when that person signs in with the same email they
--     join with the role and project access the administrator chose.
--   * The first person to sign in to a new workspace becomes its
--     administrator. Sign in yourself before sharing the app's address.
--   * Roles (admin, manager, member, viewer) grant permissions; an
--     administrator can change what each role may do and override single
--     permissions per person. Administrators always have every permission.
--   * Members only see the projects they have been given access to.
--   * Nobody can raise their own access, only administrators can grant
--     administrator rights, and the last administrator cannot be removed.
--   * Time entries use server timestamps for timers and follow the
--     timesheet rules (manual entries, daily limit, lock period, approval).
--   * Changes to users, roles and rules are written to an activity log.
--
-- Turn on "Confirm email" in Authentication > Providers > Email so nobody
-- can sign up with an address they don't own.

-- gen_random_uuid() is built into Postgres 13+ (Supabase runs 15+).

-- ================================================================= tables

create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_settings (
  id integer primary key default 1 check (id = 1),
  roles jsonb not null default '{}'::jsonb,
  rules jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- Defaults match src/domain/permissions.js (checked by schema.test.mjs).
insert into public.workspace_settings (id, roles, rules)
values (
  1,
  '{"manager":{"projects.create":true,"projects.edit":true,"projects.delete":true,"tasks.create":true,"tasks.edit_all":true,"tasks.edit_assigned":true,"tasks.delete":true,"reports.write":true,"documents.manage":true,"data.import":true,"data.export":true,"ai.use":true,"timesheet.log":true,"timesheet.view_all":true,"timesheet.approve":true,"admin.users":false,"admin.roles_rules":false,"admin.audit":false},"member":{"projects.create":false,"projects.edit":false,"projects.delete":false,"tasks.create":false,"tasks.edit_all":false,"tasks.edit_assigned":true,"tasks.delete":false,"reports.write":false,"documents.manage":true,"data.import":false,"data.export":true,"ai.use":true,"timesheet.log":true,"timesheet.view_all":false,"timesheet.approve":false,"admin.users":false,"admin.roles_rules":false,"admin.audit":false},"viewer":{"projects.create":false,"projects.edit":false,"projects.delete":false,"tasks.create":false,"tasks.edit_all":false,"tasks.edit_assigned":false,"tasks.delete":false,"reports.write":false,"documents.manage":false,"data.import":false,"data.export":true,"ai.use":false,"timesheet.log":false,"timesheet.view_all":false,"timesheet.approve":false,"admin.users":false,"admin.roles_rules":false,"admin.audit":false}}'::jsonb,
  '{"timesheet":{"requireApproval":true,"allowManualEntries":true,"onlyAssignedTasks":true,"requireNote":false,"maxHoursPerDay":12,"lockAfterDays":14,"autoStopAfterHours":10},"tasks":{"membersCanChangeDates":false,"lockDoneTasks":false},"security":{"allowedEmailDomains":"","idleSignOutMinutes":0}}'::jsonb
)
on conflict (id) do nothing;

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null default '',
  user_id uuid unique references auth.users (id) on delete set null,
  role text not null default 'member' check (role in ('admin', 'manager', 'member', 'viewer')),
  -- Per-person overrides: {"permission.key": true|false}.
  permissions jsonb not null default '{}'::jsonb,
  -- Local project ids this person can see; null means every project.
  project_ids text[],
  active boolean not null default true,
  invited_by uuid,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
create index if not exists projects_local_id_idx on public.projects ((project_data ->> 'id'));

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

create index if not exists weekly_reports_project_idx on public.weekly_reports (project_id);

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

create index if not exists project_documents_project_idx on public.project_documents (project_id);

create table if not exists public.centralized_reports (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Centralized Projects Report',
  report_date date not null default current_date,
  report_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'task' check (kind in ('task', 'attendance')),
  project_id text not null default '',
  task_id text not null default '',
  task_title text not null default '',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  note text not null default '',
  source text not null default 'timer' check (source in ('timer', 'manual')),
  status text not null default 'open' check (status in ('open', 'submitted', 'approved', 'rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_entries_end_after_start check (ended_at is null or ended_at >= started_at)
);

create index if not exists time_entries_user_idx on public.time_entries (user_id, started_at desc);
create index if not exists time_entries_status_idx on public.time_entries (status);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_email text not null default '',
  action text not null,
  target text not null default '',
  detail jsonb not null default '{}'::jsonb
);

create index if not exists audit_log_at_idx on public.audit_log (at desc);

-- ============================================================== functions
-- SECURITY DEFINER so policies can read membership without recursing into
-- workspace_members' own policies.

create or replace function public.is_active_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members where user_id = auth.uid() and active);
$$;

create or replace function public.is_workspace_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where user_id = auth.uid() and active and role = 'admin'
  );
$$;

-- Kept for the centralized report policies.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_workspace_admin();
$$;

create or replace function public.has_permission(perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when m.role = 'admin' then true
      else coalesce((m.permissions ->> perm)::boolean, (s.roles -> m.role ->> perm)::boolean, false)
    end
    from public.workspace_members m
    left join public.workspace_settings s on s.id = 1
    where m.user_id = auth.uid() and m.active
  ), false);
$$;

create or replace function public.can_access_project(pid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members m
    where m.user_id = auth.uid() and m.active
      and (m.role = 'admin' or m.project_ids is null or pid = any (m.project_ids))
  );
$$;

create or replace function public.can_edit_project_content()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_permission('projects.edit') or public.has_permission('tasks.edit_all')
    or public.has_permission('tasks.edit_assigned') or public.has_permission('tasks.create')
    or public.has_permission('tasks.delete');
$$;

create or replace function public.write_audit(p_action text, p_target text, p_detail jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (actor_id, actor_email, action, target, detail)
  values (
    auth.uid(),
    coalesce((select email from auth.users where id = auth.uid()), ''),
    p_action, coalesce(p_target, ''), coalesce(p_detail, '{}'::jsonb)
  );
end;
$$;

-- Links the signed-in user to their invitation and records the sign-in.
-- The first person to sign in to an empty workspace becomes its
-- administrator. Returns null when the user has not been invited.
create or replace function public.claim_membership()
returns public.workspace_members
language plpgsql security definer set search_path = public as $$
declare
  me_email text;
  m public.workspace_members;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  select lower(email) into me_email from auth.users where id = auth.uid();
  perform set_config('app.membership_claim', 'on', true);

  select * into m from public.workspace_members where user_id = auth.uid();
  if found then
    if m.active then
      update public.workspace_members set last_sign_in_at = now() where id = m.id returning * into m;
      perform public.write_audit('auth.sign_in', me_email, '{}'::jsonb);
    end if;
    perform set_config('app.membership_claim', 'off', true);
    return m;
  end if;

  update public.workspace_members
     set user_id = auth.uid(), last_sign_in_at = now(), updated_at = now()
   where email = me_email and user_id is null
  returning * into m;
  if found then
    perform public.write_audit('member.joined', me_email, jsonb_build_object('role', m.role));
    perform set_config('app.membership_claim', 'off', true);
    return m;
  end if;

  if not exists (select 1 from public.workspace_members) then
    insert into public.workspace_members (email, display_name, user_id, role, last_sign_in_at)
    values (me_email, split_part(me_email, '@', 1), auth.uid(), 'admin', now())
    returning * into m;
    perform public.write_audit('workspace.claimed', me_email, '{}'::jsonb);
    perform set_config('app.membership_claim', 'off', true);
    return m;
  end if;

  perform set_config('app.membership_claim', 'off', true);
  return null;
end;
$$;

revoke all on function public.is_active_member() from public;
revoke all on function public.is_workspace_admin() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.has_permission(text) from public;
revoke all on function public.can_access_project(text) from public;
revoke all on function public.can_edit_project_content() from public;
revoke all on function public.write_audit(text, text, jsonb) from public;
revoke all on function public.claim_membership() from public;
grant execute on function public.is_active_member() to authenticated;
grant execute on function public.is_workspace_admin() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.can_access_project(text) to authenticated;
grant execute on function public.can_edit_project_content() to authenticated;
grant execute on function public.claim_membership() to authenticated;

-- =============================================================== triggers

-- Server-side timestamps, so optimistic concurrency checks work across
-- devices with different clocks.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before insert or update on public.projects
  for each row execute function public.touch_updated_at();

create or replace function public.workspace_members_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor_admin boolean := public.is_workspace_admin();
  domains text;
begin
  -- The SQL editor / service role (no signed-in user) and the sign-in claim
  -- are trusted.
  if auth.uid() is null or current_setting('app.membership_claim', true) = 'on' then
    return coalesce(new, old);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new.email := lower(btrim(new.email));
    if new.email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'Enter a valid email address.';
    end if;
    new.updated_at := now();

    if tg_op = 'INSERT' then
      new.user_id := null;
      new.invited_by := auth.uid();
      new.last_sign_in_at := null;
    else
      new.user_id := old.user_id;
      new.invited_by := old.invited_by;
      new.last_sign_in_at := old.last_sign_in_at;
      if old.user_id = auth.uid() and not actor_admin then
        raise exception 'You cannot change your own access.';
      end if;
      if old.role = 'admin' and not actor_admin then
        raise exception 'Only administrators can change an administrator.';
      end if;
      if new.email <> old.email and old.user_id is not null then
        raise exception 'This person has already joined; their email cannot be changed.';
      end if;
    end if;

    if not actor_admin and (
      new.role = 'admin'
      or exists (
        select 1 from jsonb_each_text(new.permissions) p
        where p.key like 'admin.%' and p.value = 'true'
      )
    ) then
      raise exception 'Only administrators can grant administrator access.';
    end if;

    if tg_op = 'INSERT' or new.email <> old.email then
      select rules -> 'security' ->> 'allowedEmailDomains' into domains from public.workspace_settings where id = 1;
      if coalesce(btrim(domains), '') <> '' and not (
        split_part(new.email, '@', 2) = any (
          select lower(ltrim(btrim(d), '@')) from unnest(string_to_array(domains, ',')) d
        )
      ) then
        raise exception 'Only addresses at % can be added.', domains;
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' and old.role = 'admin' and not actor_admin then
    raise exception 'Only administrators can remove an administrator.';
  end if;

  if (tg_op = 'DELETE' and old.role = 'admin' and old.active)
     or (tg_op = 'UPDATE' and old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active)) then
    if not exists (
      select 1 from public.workspace_members where role = 'admin' and active and id <> old.id
    ) then
      raise exception 'The workspace needs at least one active administrator.';
    end if;
  end if;

  perform public.write_audit(
    case tg_op when 'INSERT' then 'member.added' when 'UPDATE' then 'member.updated' else 'member.removed' end,
    case when tg_op = 'DELETE' then old.email else new.email end,
    case tg_op
      when 'DELETE' then jsonb_build_object('role', old.role)
      when 'INSERT' then jsonb_build_object('role', new.role, 'projects', coalesce(to_jsonb(new.project_ids), '"all"'::jsonb))
      else jsonb_strip_nulls(jsonb_build_object(
        'role', case when new.role <> old.role then new.role end,
        'active', case when new.active <> old.active then new.active end,
        'permissions', case when new.permissions <> old.permissions then new.permissions end,
        'projects', case when new.project_ids is distinct from old.project_ids then coalesce(to_jsonb(new.project_ids), '"all"'::jsonb) end,
        'name', case when new.display_name <> old.display_name then new.display_name end
      ))
    end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists workspace_members_guard on public.workspace_members;
create trigger workspace_members_guard before insert or update or delete on public.workspace_members
  for each row execute function public.workspace_members_guard();

create or replace function public.workspace_settings_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  new.id := 1;
  new.updated_at := now();
  new.updated_by := auth.uid();
  new.roles := new.roles - 'admin';
  if not public.is_workspace_admin() and exists (
    select 1 from jsonb_each(new.roles) r, jsonb_each_text(r.value) p
    where p.key like 'admin.%' and p.value = 'true'
  ) then
    raise exception 'Only administrators can give a role administration rights.';
  end if;
  perform public.write_audit(
    'settings.updated', '',
    jsonb_strip_nulls(jsonb_build_object(
      'roles', case when new.roles <> old.roles then new.roles end,
      'rules', case when new.rules <> old.rules then new.rules end
    ))
  );
  return new;
end;
$$;

drop trigger if exists workspace_settings_guard on public.workspace_settings;
create trigger workspace_settings_guard before update on public.workspace_settings
  for each row execute function public.workspace_settings_guard();

-- Enforces the timesheet rules on every change to a time entry.
create or replace function public.time_entries_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r jsonb := coalesce((select rules -> 'timesheet' from public.workspace_settings where id = 1), '{}'::jsonb);
  lock_days integer := coalesce((r ->> 'lockAfterDays')::integer, 0);
  cap_hours numeric := coalesce((r ->> 'autoStopAfterHours')::numeric, 0);
  max_hours numeric := coalesce((r ->> 'maxHoursPerDay')::numeric, 24);
  allow_manual boolean := coalesce((r ->> 'allowManualEntries')::boolean, true);
  m public.workspace_members;
  day_minutes numeric;
  is_locked boolean;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.user_id <> auth.uid() then
      raise exception 'You can only delete your own time entries.';
    end if;
    if old.status in ('submitted', 'approved') then
      raise exception 'Submitted or approved time cannot be deleted.';
    end if;
    if lock_days > 0 and old.ended_at is not null and old.started_at < now() - make_interval(days => lock_days) then
      raise exception 'Entries older than % days are locked.', lock_days;
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.status := 'open';
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.review_note := '';
    new.created_at := now();
    if new.source = 'timer' then
      if new.ended_at is not null then
        raise exception 'A timer starts running; stop it to end it.';
      end if;
      new.started_at := now();
      if exists (select 1 from public.time_entries where user_id = new.user_id and kind = new.kind and ended_at is null) then
        raise exception '%', case when new.kind = 'attendance' then 'You are already clocked in.' else 'A task timer is already running. Stop it first.' end;
      end if;
    else
      if new.kind = 'task' and not allow_manual then
        raise exception 'Manual time entries are turned off by your administrator.';
      end if;
      if new.ended_at is null then
        raise exception 'A manual entry needs an end time.';
      end if;
      if lock_days > 0 and new.started_at < now() - make_interval(days => lock_days) then
        raise exception 'Entries older than % days are locked.', lock_days;
      end if;
    end if;
  else
    new.user_id := old.user_id;
    new.kind := old.kind;
    new.created_at := old.created_at;

    -- Reviewing: approvers change only the status and review note.
    if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
      if not public.has_permission('timesheet.approve') then
        raise exception 'Only approvers can approve or reject time.';
      end if;
      if old.user_id = auth.uid() and not public.is_workspace_admin() then
        raise exception 'You cannot approve your own time.';
      end if;
      if old.status <> 'submitted' then
        raise exception 'Only submitted time can be reviewed.';
      end if;
      new.started_at := old.started_at;
      new.ended_at := old.ended_at;
      new.project_id := old.project_id;
      new.task_id := old.task_id;
      new.task_title := old.task_title;
      new.note := old.note;
      new.source := old.source;
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
      new.updated_at := now();
      return new;
    end if;

    if old.user_id <> auth.uid() then
      raise exception 'You can only change your own time entries.';
    end if;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
    new.review_note := old.review_note;

    if old.status in ('submitted', 'approved') and not (old.status = 'submitted' and new.status = 'open') then
      raise exception 'Submitted or approved time cannot be changed.';
    end if;
    -- Correcting time that was sent back makes it a draft again.
    if old.status = 'rejected' and new.status = 'rejected' then
      new.status := 'open';
    end if;
    if new.status not in ('open', 'submitted') then
      raise exception 'Invalid status.';
    end if;

    is_locked := lock_days > 0 and old.ended_at is not null and old.started_at < now() - make_interval(days => lock_days);

    if old.ended_at is null and new.ended_at is not null and old.source = 'timer' then
      -- Stopping a timer: the server decides when it ended.
      new.started_at := old.started_at;
      new.ended_at := now();
      if cap_hours > 0 and new.ended_at > old.started_at + make_interval(secs => cap_hours * 3600) then
        new.ended_at := old.started_at + make_interval(secs => cap_hours * 3600);
        new.note := btrim(new.note || ' (timer stopped automatically after ' || cap_hours || ' h)');
      end if;
    elsif new.started_at is distinct from old.started_at or new.ended_at is distinct from old.ended_at then
      if is_locked then
        raise exception 'Entries older than % days are locked.', lock_days;
      end if;
      if old.kind = 'task' and not allow_manual then
        raise exception 'Manual time changes are turned off by your administrator.';
      end if;
      if new.ended_at is null then
        raise exception 'A finished entry needs an end time.';
      end if;
      new.source := 'manual';
    elsif is_locked and (new.task_id is distinct from old.task_id or new.note is distinct from old.note) then
      raise exception 'Entries older than % days are locked.', lock_days;
    end if;

    if new.status = 'submitted' and old.status <> 'submitted' then
      if new.ended_at is null then
        raise exception 'Stop the timer before submitting.';
      end if;
      if not coalesce((r ->> 'requireApproval')::boolean, true) then
        new.status := 'approved';
        new.reviewed_at := now();
      end if;
    end if;
  end if;

  if new.ended_at is not null and new.ended_at > now() + interval '5 minutes' then
    raise exception 'Time cannot be logged in the future.';
  end if;

  if new.kind = 'task' then
    if btrim(new.task_id) = '' then
      raise exception 'Pick a task.';
    end if;
    if new.project_id <> '' and not public.can_access_project(new.project_id) then
      raise exception 'You do not have access to this project.';
    end if;
    if coalesce((r ->> 'onlyAssignedTasks')::boolean, false)
       and (tg_op = 'INSERT' or new.task_id is distinct from old.task_id) then
      select * into m from public.workspace_members where user_id = new.user_id;
      if not exists (
        select 1
        from public.projects p, jsonb_array_elements(coalesce(p.project_data -> 'tasks', '[]'::jsonb)) t
        where p.project_data ->> 'id' = new.project_id
          and t ->> 'id' = new.task_id
          and lower(btrim(coalesce(t ->> 'owner', ''))) in (
            lower(btrim(m.display_name)), lower(m.email), lower(split_part(m.email, '@', 1))
          )
      ) then
        raise exception 'You can only log time on tasks assigned to you.';
      end if;
    end if;
    if new.ended_at is not null then
      if coalesce((r ->> 'requireNote')::boolean, false) and btrim(new.note) = '' then
        raise exception 'Add a short note describing the work.';
      end if;
      select coalesce(sum(extract(epoch from (e.ended_at - e.started_at)) / 60), 0) into day_minutes
      from public.time_entries e
      where e.user_id = new.user_id and e.kind = 'task' and e.id <> new.id
        and e.ended_at is not null and e.started_at::date = new.started_at::date;
      if day_minutes + extract(epoch from (new.ended_at - new.started_at)) / 60 > max_hours * 60 then
        raise exception 'That would be more than % hours of task time on %.', max_hours, new.started_at::date;
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists time_entries_guard on public.time_entries;
create trigger time_entries_guard before insert or update or delete on public.time_entries
  for each row execute function public.time_entries_guard();

-- =============================================================== policies

alter table public.user_profiles enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.project_documents enable row level security;
alter table public.centralized_reports enable row level security;
alter table public.time_entries enable row level security;
alter table public.audit_log enable row level security;

-- Profiles (kept for compatibility; roles now live in workspace_members).
drop policy if exists "profiles: read own" on public.user_profiles;
create policy "profiles: read own" on public.user_profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles: create own as user" on public.user_profiles;
create policy "profiles: create own as user" on public.user_profiles
  for insert to authenticated
  with check (id = auth.uid() and role = 'user');

-- Settings: every member reads them; role and rule editors change them.
drop policy if exists "settings: members read" on public.workspace_settings;
create policy "settings: members read" on public.workspace_settings
  for select to authenticated
  using (public.is_active_member());

drop policy if exists "settings: editors update" on public.workspace_settings;
create policy "settings: editors update" on public.workspace_settings
  for update to authenticated
  using (public.has_permission('admin.roles_rules'))
  with check (public.has_permission('admin.roles_rules'));

-- Members: everyone in the team sees the team (names for task owners);
-- user managers add, change and remove people.
drop policy if exists "members: team reads" on public.workspace_members;
create policy "members: team reads" on public.workspace_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_active_member());

drop policy if exists "members: managers insert" on public.workspace_members;
create policy "members: managers insert" on public.workspace_members
  for insert to authenticated
  with check (public.has_permission('admin.users'));

drop policy if exists "members: managers update" on public.workspace_members;
create policy "members: managers update" on public.workspace_members
  for update to authenticated
  using (public.has_permission('admin.users'))
  with check (public.has_permission('admin.users'));

drop policy if exists "members: managers delete" on public.workspace_members;
create policy "members: managers delete" on public.workspace_members
  for delete to authenticated
  using (public.has_permission('admin.users') and user_id is distinct from auth.uid());

-- Projects: shared with members who have access to them.
drop policy if exists "projects: read own or admin" on public.projects;
drop policy if exists "projects: insert own" on public.projects;
drop policy if exists "projects: update own" on public.projects;
drop policy if exists "projects: delete own" on public.projects;

drop policy if exists "projects: team reads" on public.projects;
create policy "projects: team reads" on public.projects
  for select to authenticated
  using (public.can_access_project(project_data ->> 'id'));

drop policy if exists "projects: creators insert" on public.projects;
create policy "projects: creators insert" on public.projects
  for insert to authenticated
  with check (user_id = auth.uid() and public.has_permission('projects.create'));

drop policy if exists "projects: editors update" on public.projects;
create policy "projects: editors update" on public.projects
  for update to authenticated
  using (public.can_access_project(project_data ->> 'id') and public.can_edit_project_content())
  with check (public.can_access_project(project_data ->> 'id') and public.can_edit_project_content());

drop policy if exists "projects: deleters delete" on public.projects;
create policy "projects: deleters delete" on public.projects
  for delete to authenticated
  using (public.can_access_project(project_data ->> 'id') and public.has_permission('projects.delete'));

-- Weekly reports.
drop policy if exists "reports: read own or admin" on public.weekly_reports;
drop policy if exists "reports: insert own" on public.weekly_reports;
drop policy if exists "reports: update own" on public.weekly_reports;
drop policy if exists "reports: delete own" on public.weekly_reports;

drop policy if exists "reports: team reads" on public.weekly_reports;
create policy "reports: team reads" on public.weekly_reports
  for select to authenticated
  using (public.can_access_project(project_id));

drop policy if exists "reports: writers insert" on public.weekly_reports;
create policy "reports: writers insert" on public.weekly_reports
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_project(project_id) and public.has_permission('reports.write'));

drop policy if exists "reports: writers update" on public.weekly_reports;
create policy "reports: writers update" on public.weekly_reports
  for update to authenticated
  using (public.can_access_project(project_id) and public.has_permission('reports.write'))
  with check (public.can_access_project(project_id) and public.has_permission('reports.write'));

drop policy if exists "reports: writers delete" on public.weekly_reports;
create policy "reports: writers delete" on public.weekly_reports
  for delete to authenticated
  using (public.can_access_project(project_id) and public.has_permission('reports.write'));

-- Project documents.
drop policy if exists "documents: read own or admin" on public.project_documents;
drop policy if exists "documents: insert own" on public.project_documents;
drop policy if exists "documents: update own" on public.project_documents;
drop policy if exists "documents: delete own" on public.project_documents;

drop policy if exists "documents: team reads" on public.project_documents;
create policy "documents: team reads" on public.project_documents
  for select to authenticated
  using (public.can_access_project(project_id));

drop policy if exists "documents: managers insert" on public.project_documents;
create policy "documents: managers insert" on public.project_documents
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_project(project_id) and public.has_permission('documents.manage'));

drop policy if exists "documents: managers update" on public.project_documents;
create policy "documents: managers update" on public.project_documents
  for update to authenticated
  using (public.can_access_project(project_id) and public.has_permission('documents.manage'))
  with check (public.can_access_project(project_id) and public.has_permission('documents.manage'));

drop policy if exists "documents: managers delete" on public.project_documents;
create policy "documents: managers delete" on public.project_documents
  for delete to authenticated
  using (public.can_access_project(project_id) and public.has_permission('documents.manage'));

-- Centralized reports: administrators only.
drop policy if exists "central: admins read" on public.centralized_reports;
create policy "central: admins read" on public.centralized_reports
  for select to authenticated
  using (public.is_admin());

drop policy if exists "central: admins insert" on public.centralized_reports;
create policy "central: admins insert" on public.centralized_reports
  for insert to authenticated
  with check (created_by = auth.uid() and public.is_admin());

-- Time entries: people log their own time; approvers and timesheet
-- viewers see the team's. The trigger above enforces the rules.
drop policy if exists "time: read own or team" on public.time_entries;
create policy "time: read own or team" on public.time_entries
  for select to authenticated
  using (
    public.is_active_member() and (
      user_id = auth.uid()
      or public.has_permission('timesheet.view_all')
      or public.has_permission('timesheet.approve')
    )
  );

drop policy if exists "time: loggers insert" on public.time_entries;
create policy "time: loggers insert" on public.time_entries
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and ((kind = 'attendance' and public.is_active_member()) or public.has_permission('timesheet.log'))
  );

drop policy if exists "time: owners and approvers update" on public.time_entries;
create policy "time: owners and approvers update" on public.time_entries
  for update to authenticated
  using (public.is_active_member() and (user_id = auth.uid() or public.has_permission('timesheet.approve')))
  with check (public.is_active_member() and (user_id = auth.uid() or public.has_permission('timesheet.approve')));

drop policy if exists "time: owners delete" on public.time_entries;
create policy "time: owners delete" on public.time_entries
  for delete to authenticated
  using (user_id = auth.uid());

-- Activity log: written by triggers and the app, read by auditors.
drop policy if exists "audit: auditors read" on public.audit_log;
create policy "audit: auditors read" on public.audit_log
  for select to authenticated
  using (public.has_permission('admin.audit'));

drop policy if exists "audit: members add app events" on public.audit_log;
create policy "audit: members add app events" on public.audit_log
  for insert to authenticated
  with check (actor_id = auth.uid() and action like 'app.%' and public.is_active_member());

-- To recover administrator access from the SQL editor:
--   update public.workspace_members set role = 'admin', active = true where email = 'you@company.com';
