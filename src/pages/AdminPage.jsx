import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Ban,
  Check,
  Copy,
  Eye,
  History,
  KeyRound,
  Pencil,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import {
  PERMISSION_GROUPS,
  ROLES,
  ROLE_LABEL,
  RULE_DEFINITIONS,
  mergeRolePermissions,
} from "../domain/permissions";
import { useAccess, useAccessStore } from "../store/useAccessStore";
import { LOCAL_MEMBER_ID } from "../services/teamService";
import { usePlannerStore } from "../store/usePlannerStore";
import { confirmAction, notify } from "../ui/feedback";
import {
  Avatar,
  Badge,
  Button,
  DataTable,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Panel,
  StatStrip,
  Tabs,
  cx,
  inputClass,
} from "../ui/primitives";

// inputClass without its full width, for inputs that sit beside a label.
const compactInputClass = inputClass.replace("w-full ", "");

const ROLE_TONE = { admin: "violet", manager: "blue", member: "green", viewer: "slate" };

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function memberStatus(member, mode) {
  if (!member.active) return { label: "Deactivated", tone: "red" };
  if (mode === "cloud" && !member.userId) return { label: "Invited", tone: "amber" };
  return { label: "Active", tone: "green" };
}

// ------------------------------------------------------------------ users

function MemberForm({ initial, projects, canGrantAdmin, rolePermissions, onSubmit, onCancel, busy }) {
  const [form, setForm] = useState(() => ({
    displayName: initial?.displayName || "",
    email: initial?.email || "",
    role: initial?.role || "member",
    projectIds: initial?.projectIds ?? null,
    permissions: { ...(initial?.permissions || {}) },
  }));
  const [error, setError] = useState("");
  const [showOverrides, setShowOverrides] = useState(Object.keys(initial?.permissions || {}).length > 0);
  const roleDefaults = mergeRolePermissions(rolePermissions)[form.role] || {};
  const isLocalOwner = initial?.id === LOCAL_MEMBER_ID;
  const emailLocked = isLocalOwner || (Boolean(initial?.userId) && initial?.userId !== initial?.id);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  }

  function setOverride(key, value) {
    setForm((prev) => {
      const permissions = { ...prev.permissions };
      if (value === "default") delete permissions[key];
      else permissions[key] = value === "allow";
      return { ...prev, permissions };
    });
  }

  function submit(event) {
    event.preventDefault();
    if (!form.displayName.trim()) return setError("Enter the person's name. It is matched to task owners.");
    if (!isLocalOwner && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return setError("Enter a valid email address.");
    if (Array.isArray(form.projectIds) && form.projectIds.length === 0) return setError("Pick at least one project, or choose all projects.");
    onSubmit({
      ...form,
      displayName: form.displayName.trim(),
      email: form.email.trim().toLowerCase(),
      permissions: form.role === "admin" ? {} : form.permissions,
      projectIds: form.role === "admin" ? null : form.projectIds,
    });
  }

  const roles = ROLES.filter((role) => role.key !== "admin" || canGrantAdmin || initial?.role === "admin");

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="member-name" required hint="Use the same name as in task owners, so their tasks are linked.">
          <input id="member-name" value={form.displayName} onChange={(e) => update("displayName", e.target.value)} className={inputClass} placeholder="e.g. Priya Shah" />
        </Field>
        <Field label="Email" htmlFor="member-email" required hint={isLocalOwner ? "Local mode has no sign-in." : emailLocked ? "Can't be changed after they have signed in." : "They sign in with this address."}>
          <input id="member-email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className={inputClass} placeholder="name@company.com" disabled={emailLocked} />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold text-slate-700">Role</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {roles.map((role) => (
            <label
              key={role.key}
              className={cx(
                "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition",
                form.role === role.key ? "border-indigo-400 bg-indigo-50/60 ring-1 ring-indigo-200" : "border-slate-200 hover:border-slate-300"
              )}
            >
              <input type="radio" name="member-role" value={role.key} checked={form.role === role.key} onChange={() => update("role", role.key)} className="mt-0.5" />
              <span>
                <span className="block font-semibold text-slate-900">{role.label}</span>
                <span className="block text-xs text-slate-500">{role.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {form.role !== "admin" ? (
        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold text-slate-700">Project access</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="project-access" checked={form.projectIds === null} onChange={() => update("projectIds", null)} />
              All projects, including new ones
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="project-access" checked={form.projectIds !== null} onChange={() => update("projectIds", form.projectIds || [])} />
              Only selected projects
            </label>
          </div>
          {form.projectIds !== null ? (
            <div className="mt-2 grid max-h-44 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
              {projects.length === 0 ? <p className="p-2 text-sm text-slate-500">No projects yet.</p> : null}
              {projects.map((project) => (
                <label key={project.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={form.projectIds.includes(project.id)}
                    onChange={(e) =>
                      update(
                        "projectIds",
                        e.target.checked ? [...form.projectIds, project.id] : form.projectIds.filter((id) => id !== project.id)
                      )
                    }
                  />
                  <span className="truncate">{project.name}</span>
                </label>
              ))}
            </div>
          ) : null}
        </fieldset>
      ) : null}

      {form.role !== "admin" ? (
        <div className="rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setShowOverrides((value) => !value)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-semibold text-slate-800"
            aria-expanded={showOverrides}
          >
            <span className="inline-flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-slate-400" aria-hidden /> Exceptions for this person
              {Object.keys(form.permissions).length ? <Badge tone="amber">{Object.keys(form.permissions).length}</Badge> : null}
            </span>
            <span className="text-xs font-medium text-indigo-600">{showOverrides ? "Hide" : "Show"}</span>
          </button>
          {showOverrides ? (
            <div className="space-y-3 border-t border-slate-100 px-3 py-3">
              <p className="text-xs text-slate-500">Leave on "Role default" unless this person needs more or less than their role.</p>
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.key}>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group.label}</div>
                  <ul className="divide-y divide-slate-100">
                    {group.permissions.map((permission) => {
                      const adminOnly = permission.key.startsWith("admin.") && !canGrantAdmin;
                      const value = permission.key in form.permissions ? (form.permissions[permission.key] ? "allow" : "deny") : "default";
                      return (
                        <li key={permission.key} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                          <span className="text-slate-700">{permission.label}</span>
                          <select
                            aria-label={permission.label}
                            value={value}
                            disabled={adminOnly}
                            onChange={(e) => setOverride(permission.key, e.target.value)}
                            className={cx(compactInputClass, "w-auto py-1 text-xs", value !== "default" ? "border-amber-300 bg-amber-50" : "")}
                          >
                            <option value="default">Role default ({roleDefaults[permission.key] ? "allowed" : "not allowed"})</option>
                            <option value="allow">Allow</option>
                            <option value="deny">Don't allow</option>
                          </select>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {initial ? "Save changes" : "Add person"}
        </Button>
      </div>
    </form>
  );
}

function UsersTab({ access }) {
  const members = useAccessStore((state) => state.members);
  const rolePermissions = useAccessStore((state) => state.rolePermissions);
  const { addMember, updateMember, removeMember, setPreview } = useAccessStore.getState();
  const projects = usePlannerStore((state) => state.projects);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const canManage = access.permissions["admin.users"];
  const isAdmin = access.realMember?.role === "admin";
  const projectName = useMemo(() => Object.fromEntries(projects.map((project) => [project.id, project.name])), [projects]);

  const rows = members.filter((member) =>
    `${member.displayName} ${member.email} ${ROLE_LABEL[member.role]}`.toLowerCase().includes(search.trim().toLowerCase())
  );
  const count = (predicate) => members.filter(predicate).length;

  async function save(values) {
    setBusy(true);
    try {
      if (dialog?.member) {
        await updateMember(dialog.member.id, values);
        notify.success(`${values.displayName} updated.`);
      } else {
        await addMember(values);
        notify.success(
          access.mode === "cloud"
            ? `${values.displayName} added. They can now sign in with ${values.email}.`
            : `${values.displayName} added.`
        );
      }
      setDialog(null);
    } catch (error) {
      notify.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(member) {
    if (member.active) {
      const ok = await confirmAction({
        title: `Deactivate ${member.displayName || member.email}?`,
        message: "They lose access straight away. Their tasks, time entries and history are kept, and you can reactivate them later.",
        confirmLabel: "Deactivate",
      });
      if (!ok) return;
    }
    try {
      await updateMember(member.id, { active: !member.active });
      notify.success(member.active ? "Access removed." : "Access restored.");
    } catch (error) {
      notify.error(error.message);
    }
  }

  async function remove(member) {
    const ok = await confirmAction({
      title: `Remove ${member.displayName || member.email}?`,
      message: "They lose access and disappear from the team list. Deactivating keeps them in the list instead.",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    try {
      await removeMember(member.id);
      notify.success("Removed from the team.");
    } catch (error) {
      notify.error(error.message);
    }
  }

  function copyInvite() {
    const text = `You've been added to our Project Planner workspace. Sign in at ${window.location.origin} with your work email.`;
    navigator.clipboard?.writeText(text).then(
      () => notify.success("Invitation text copied. Paste it into an email or chat."),
      () => notify.error("Could not copy. Share this address instead: " + window.location.origin)
    );
  }

  return (
    <div className="space-y-4">
      <StatStrip
        items={[
          { label: "People", value: members.length },
          { label: "Active", value: count((m) => m.active && (access.mode === "local" || m.userId)), tone: "text-emerald-700" },
          { label: "Invited, not signed in yet", value: access.mode === "cloud" ? count((m) => m.active && !m.userId) : "—" },
          { label: "Administrators", value: count((m) => m.role === "admin" && m.active) },
          { label: "Deactivated", value: count((m) => !m.active), tone: "text-slate-500" },
        ]}
      />

      {access.mode === "local" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Local mode.</strong> Everything is stored in this browser, so people you add can't sign in yet. You can
          still set their access, assign them tasks and use <em>Preview</em> to check what they would see. Connect
          Supabase (Help &rarr; About Claude and setup) to give each person their own sign-in.
        </div>
      ) : null}

      <Panel
        title="People"
        subtitle={access.mode === "cloud" ? "People sign in with the email you add here. Nobody else can get in." : "Team members and what they can do."}
        icon={Users}
        actions={
          <>
            {access.mode === "cloud" ? (
              <Button size="sm" icon={Copy} onClick={copyInvite}>
                Copy invitation
              </Button>
            ) : null}
            {canManage ? (
              <Button size="sm" variant="primary" icon={UserPlus} onClick={() => setDialog({})} data-testid="add-member">
                Add person
              </Button>
            ) : null}
          </>
        }
      >
        <div className="border-b border-slate-100 px-5 py-3">
          <label className="block max-w-sm">
            <span className="sr-only">Search people</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email or role..." className={cx(inputClass, "py-1.5")} />
          </label>
        </div>
        <DataTable
          rows={rows}
          empty="Nobody matches your search."
          columns={[
            {
              key: "name",
              label: "Person",
              render: (member) => (
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={member.displayName || member.email} />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-900">
                      {member.displayName || <span className="italic text-slate-400">No name</span>}
                      {member.id === access.realMember?.id ? <span className="ml-1.5 text-xs font-normal text-slate-400">(you)</span> : null}
                    </div>
                    <div className="truncate text-xs text-slate-500">{member.email}</div>
                  </div>
                </div>
              ),
            },
            {
              key: "role",
              label: "Role",
              render: (member) => (
                <span className="inline-flex items-center gap-1.5">
                  <Badge tone={ROLE_TONE[member.role]}>{ROLE_LABEL[member.role]}</Badge>
                  {Object.keys(member.permissions || {}).length ? (
                    <Badge tone="amber" className="font-medium">+{Object.keys(member.permissions).length} exceptions</Badge>
                  ) : null}
                </span>
              ),
            },
            {
              key: "projects",
              label: "Projects",
              render: (member) =>
                member.role === "admin" || !Array.isArray(member.projectIds) ? (
                  <span className="text-slate-500">All</span>
                ) : (
                  <span title={member.projectIds.map((id) => projectName[id] || id).join(", ")}>
                    {member.projectIds.length === 1 ? projectName[member.projectIds[0]] || "1 project" : `${member.projectIds.length} projects`}
                  </span>
                ),
            },
            {
              key: "status",
              label: "Status",
              render: (member) => {
                const status = memberStatus(member, access.mode);
                return <Badge tone={status.tone}>{status.label}</Badge>;
              },
            },
            {
              key: "lastSignInAt",
              label: "Last sign-in",
              className: "whitespace-nowrap text-slate-500",
              render: (member) => (access.mode === "cloud" ? formatDateTime(member.lastSignInAt) || "Never" : "—"),
            },
            {
              key: "actions",
              label: <span className="sr-only">Actions</span>,
              className: "w-px whitespace-nowrap text-right",
              render: (member) => {
                const self = member.id === access.realMember?.id;
                const protectedAdmin = member.role === "admin" && !isAdmin;
                return (
                  <span className="inline-flex gap-1">
                    {(isAdmin || access.mode === "local") && !self && member.active ? (
                      <Button size="sm" variant="ghost" icon={Eye} onClick={() => setPreview(member.id)} aria-label={`Preview as ${member.displayName || member.email}`}>
                        Preview
                      </Button>
                    ) : null}
                    {canManage && !protectedAdmin && (!self || isAdmin) ? (
                      <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setDialog({ member })} aria-label={`Edit ${member.displayName || member.email}`}>
                        Edit
                      </Button>
                    ) : null}
                    {canManage && !self && !protectedAdmin ? (
                      <Button size="sm" variant="ghost" icon={member.active ? Ban : Check} onClick={() => toggleActive(member)}>
                        {member.active ? "Deactivate" : "Reactivate"}
                      </Button>
                    ) : null}
                    {canManage && !self && !protectedAdmin ? (
                      <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(member)} aria-label={`Remove ${member.displayName || member.email}`} />
                    ) : null}
                  </span>
                );
              },
            },
          ]}
        />
      </Panel>

      <Modal
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        title={dialog?.member ? `Edit ${dialog.member.displayName || dialog.member.email}` : "Add a person"}
        description={dialog?.member ? undefined : "Choose what they can see and do. You can change this any time."}
        size="lg"
      >
        {dialog ? (
          <MemberForm
            initial={dialog.member}
            projects={projects}
            canGrantAdmin={isAdmin}
            rolePermissions={rolePermissions}
            onSubmit={save}
            onCancel={() => setDialog(null)}
            busy={busy}
          />
        ) : null}
      </Modal>
    </div>
  );
}

// ------------------------------------------------------------------ roles

function RolesTab({ access }) {
  const saved = useAccessStore((state) => state.rolePermissions);
  const saveSettings = useAccessStore((state) => state.saveSettings);
  const [draft, setDraft] = useState(() => mergeRolePermissions(saved));
  const [busy, setBusy] = useState(false);
  const canEdit = access.permissions["admin.roles_rules"];
  const isAdmin = access.realMember?.role === "admin";
  const dirty = JSON.stringify(draft) !== JSON.stringify(mergeRolePermissions(saved));

  useEffect(() => {
    setDraft(mergeRolePermissions(saved));
  }, [saved]);

  function toggle(role, key) {
    setDraft((prev) => ({ ...prev, [role]: { ...prev[role], [key]: !prev[role][key] } }));
  }

  async function save() {
    setBusy(true);
    try {
      await saveSettings({ roles: draft });
      notify.success("Role permissions saved. They apply straight away.");
    } catch (error) {
      notify.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  const editableRoles = ROLES.filter((role) => role.key !== "admin");

  return (
    <Panel
      title="What each role can do"
      subtitle="Administrators can always do everything. Exceptions for single people are set on the Users tab."
      icon={ShieldCheck}
      actions={
        canEdit ? (
          <>
            <Button size="sm" icon={RotateCcw} disabled={!dirty || busy} onClick={() => setDraft(mergeRolePermissions(saved))}>
              Undo changes
            </Button>
            <Button size="sm" variant="primary" icon={Save} disabled={!dirty || busy} onClick={save} data-testid="save-roles">
              Save
            </Button>
          </>
        ) : (
          <Badge>Read only</Badge>
        )
      }
    >
      <div className="max-h-[calc(100vh-16rem)] overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr className="border-b border-slate-200 text-left">
              <th scope="col" className="px-5 py-2.5 text-xs font-medium text-slate-500">Permission</th>
              {ROLES.map((role) => (
                <th key={role.key} scope="col" className="w-32 px-3 py-2.5 text-center text-xs font-medium text-slate-500">
                  {role.label}
                </th>
              ))}
            </tr>
          </thead>
          {PERMISSION_GROUPS.map((group) => (
            <tbody key={group.key} className="divide-y divide-slate-100">
              <tr className="bg-slate-50/50">
                <th colSpan={ROLES.length + 1} scope="colgroup" className="px-5 pb-1 pt-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {group.label}
                </th>
              </tr>
              {group.permissions.map((permission) => (
                <tr key={permission.key}>
                  <td className="px-5 py-2 text-slate-700">{permission.label}</td>
                  <td className="px-3 py-2 text-center">
                    <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Always allowed" />
                  </td>
                  {editableRoles.map((role) => {
                    const lockedForManager = permission.key.startsWith("admin.") && !isAdmin;
                    return (
                      <td key={role.key} className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-indigo-600"
                          aria-label={`${role.label}: ${permission.label}`}
                          checked={Boolean(draft[role.key]?.[permission.key])}
                          disabled={!canEdit || lockedForManager}
                          onChange={() => toggle(role.key, permission.key)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ rules

function RulesTab({ access }) {
  const saved = useAccessStore((state) => state.rules);
  const saveSettings = useAccessStore((state) => state.saveSettings);
  const [draft, setDraft] = useState(saved);
  const [busy, setBusy] = useState(false);
  const canEdit = access.permissions["admin.roles_rules"];
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => {
    setDraft(saved);
  }, [saved]);

  function update(group, key, value) {
    setDraft((prev) => ({ ...prev, [group]: { ...prev[group], [key]: value } }));
  }

  async function save() {
    setBusy(true);
    try {
      await saveSettings({ rules: draft });
      notify.success("Rules saved. They apply straight away.");
    } catch (error) {
      notify.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {!canEdit ? <p className="text-sm text-slate-500">You can see the rules but not change them.</p> : null}
      <div className="grid items-start gap-4 xl:grid-cols-3">
        {RULE_DEFINITIONS.map((section) => (
          <Panel key={section.group} title={section.label} icon={SlidersHorizontal}>
            <ul className="divide-y divide-slate-100">
              {section.rules.map((rule) => {
                const id = `rule-${section.group}-${rule.key}`;
                const value = draft[section.group]?.[rule.key];
                return (
                  <li key={rule.key} className="flex items-start justify-between gap-4 px-5 py-3">
                    <label htmlFor={id} className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900">{rule.label}</span>
                      <span className="block text-xs text-slate-500">{rule.hint}</span>
                    </label>
                    {rule.type === "boolean" ? (
                      <input
                        id={id}
                        type="checkbox"
                        role="switch"
                        className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
                        checked={Boolean(value)}
                        disabled={!canEdit}
                        onChange={(e) => update(section.group, rule.key, e.target.checked)}
                      />
                    ) : rule.type === "number" ? (
                      <input
                        id={id}
                        type="number"
                        min={rule.min}
                        max={rule.max}
                        value={value ?? ""}
                        disabled={!canEdit}
                        onChange={(e) => update(section.group, rule.key, Math.min(rule.max, Math.max(rule.min, Number(e.target.value) || 0)))}
                        className={cx(compactInputClass, "w-20 shrink-0 py-1 text-right")}
                      />
                    ) : (
                      <input
                        id={id}
                        value={value ?? ""}
                        disabled={!canEdit}
                        onChange={(e) => update(section.group, rule.key, e.target.value)}
                        className={cx(compactInputClass, "w-44 shrink-0 py-1")}
                        placeholder="company.com"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        ))}
      </div>
      {canEdit ? (
        <div className="flex justify-end gap-2">
          <Button icon={RotateCcw} disabled={!dirty || busy} onClick={() => setDraft(saved)}>
            Undo changes
          </Button>
          <Button variant="primary" icon={Save} disabled={!dirty || busy} onClick={save} data-testid="save-rules">
            Save rules
          </Button>
        </div>
      ) : null}
      <p className="text-xs text-slate-500">
        In cloud mode the database enforces timesheet rules, access and permissions for every request, so they apply even
        outside this app. Task-level limits (which fields assignees may change) are applied by the app.
      </p>
    </div>
  );
}

// --------------------------------------------------------------- activity

const ACTION_LABEL = {
  "workspace.claimed": "Became the first administrator",
  "auth.sign_in": "Signed in",
  "member.joined": "Joined the workspace",
  "member.added": "Added a person",
  "member.updated": "Changed a person's access",
  "member.removed": "Removed a person",
  "settings.updated": "Changed roles or rules",
  "timesheet.approved": "Approved time",
  "timesheet.rejected": "Rejected time",
  "app.project_deleted": "Deleted a project",
  "app.import": "Imported data",
  "app.export": "Exported data",
};

function describeDetail(detail) {
  if (!detail || typeof detail !== "object") return "";
  const parts = [];
  if (detail.role) parts.push(`role: ${ROLE_LABEL[detail.role] || detail.role}`);
  if (detail.active === true) parts.push("reactivated");
  if (detail.active === false) parts.push("deactivated");
  if (detail.projects) parts.push(`projects: ${Array.isArray(detail.projects) ? detail.projects.length : detail.projects}`);
  if (detail.permissions) parts.push("exceptions changed");
  if (detail.name) parts.push(`name: ${detail.name}`);
  if (detail.roles) parts.push("role permissions");
  if (detail.rules) parts.push("rules");
  if (detail.count) parts.push(`${detail.count} items`);
  return parts.join(" · ");
}

function ActivityTab({ access }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    useAccessStore
      .getState()
      .service()
      .listAudit({ limit: 300 })
      .then((data) => !cancelled && setRows(data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [access.mode]);

  if (!access.permissions["admin.audit"]) {
    return <EmptyState icon={History} title="No access to the activity log" description="Ask an administrator if you need it." />;
  }

  return (
    <Panel title="Activity log" subtitle="Who changed access, roles and rules, sign-ins and other important events." icon={History}>
      {error ? <p className="px-5 py-4 text-sm text-red-700">{error}</p> : null}
      <DataTable
        rows={rows || []}
        empty={rows ? "Nothing recorded yet." : "Loading..."}
        columns={[
          { key: "at", label: "When", className: "whitespace-nowrap text-slate-500", render: (row) => formatDateTime(row.at) },
          { key: "actor", label: "Who", render: (row) => row.actorEmail || "System" },
          { key: "action", label: "What", render: (row) => ACTION_LABEL[row.action] || row.action },
          { key: "target", label: "About", render: (row) => row.target || "—" },
          { key: "detail", label: "Details", className: "text-slate-500", render: (row) => describeDetail(row.detail) || "—" },
        ]}
      />
    </Panel>
  );
}

// ------------------------------------------------------------------- page

const TABS = [
  { key: "users", label: "Users", icon: Users, requires: ["admin.users", "admin.roles_rules", "admin.audit"] },
  { key: "roles", label: "Roles & permissions", icon: ShieldCheck, requires: ["admin.roles_rules", "admin.users"] },
  { key: "rules", label: "Rules", icon: SlidersHorizontal, requires: ["admin.roles_rules", "admin.users"] },
  { key: "activity", label: "Activity log", icon: History, requires: ["admin.audit"] },
];

export default function AdminPage() {
  const access = useAccess();
  const memberCount = useAccessStore((state) => state.members.length);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabs = TABS.filter((tab) => tab.requires.some((key) => access.permissions[key]));
  const active = tabs.find((tab) => tab.key === searchParams.get("tab"))?.key || tabs[0]?.key;

  if (!tabs.length || access.previewing) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title={access.previewing ? "Admin is hidden while previewing" : "Administrators only"}
        description={
          access.previewing
            ? "Exit the preview to manage users, roles and rules."
            : "You don't have permission to manage users, roles or rules. Ask your administrator if you need access."
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Admin"
        description="Add people, decide what each role can do, set workspace rules and review the activity log."
      />
      <Tabs
        label="Admin sections"
        items={tabs.map((tab) => ({ ...tab, count: tab.key === "users" ? memberCount : undefined }))}
        value={active}
        onChange={(key) => setSearchParams({ tab: key }, { replace: true })}
      />
      {active === "users" ? <UsersTab access={access} /> : null}
      {active === "roles" ? <RolesTab access={access} /> : null}
      {active === "rules" ? <RulesTab access={access} /> : null}
      {active === "activity" ? <ActivityTab access={access} /> : null}
    </div>
  );
}
