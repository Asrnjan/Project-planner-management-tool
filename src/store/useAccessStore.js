import { create } from "zustand";
import {
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_RULES,
  canAccessProject,
  resolvePermissions,
} from "../domain/permissions";
import { createTeamService } from "../services/teamService";

// Who is signed in, what they may do, and the workspace rules. Everything
// that changes data asks this store first; in cloud mode the database
// enforces the same rules again.

const PREVIEW_KEY = "pm-preview-member";

function readPreview() {
  try {
    return sessionStorage.getItem(PREVIEW_KEY) || "";
  } catch {
    return "";
  }
}

function writePreview(id) {
  try {
    if (id) sessionStorage.setItem(PREVIEW_KEY, id);
    else sessionStorage.removeItem(PREVIEW_KEY);
  } catch {
    // Preview then lasts until the page reloads.
  }
}

export const useAccessStore = create((set, get) => ({
  status: "idle", // idle | loading | ready | no_access | error
  mode: "local",
  email: "",
  me: null,
  members: [],
  rolePermissions: DEFAULT_ROLE_PERMISSIONS,
  rules: DEFAULT_RULES,
  previewMemberId: readPreview(),
  error: "",

  service: () => createTeamService(get().mode),

  /** Loads membership and settings. Returns the store status. */
  initialize: async (mode, { email = "" } = {}) => {
    set({ status: "loading", mode, email, error: "" });
    const service = createTeamService(mode);
    try {
      const me = await service.claimMembership();
      if (!me || !me.active) {
        set({ status: "no_access", me, members: [] });
        return "no_access";
      }
      const [members, settings] = await Promise.all([service.listMembers(), service.getSettings()]);
      set({
        status: "ready",
        me,
        members,
        rolePermissions: settings.roles,
        rules: settings.rules,
        previewMemberId: me.role === "admin" || mode === "local" ? get().previewMemberId : "",
      });
      return "ready";
    } catch (error) {
      console.error("Failed to load team access:", error);
      const message = String(error?.message || "");
      const schemaMissing = /claim_membership|workspace_members|schema cache|PGRST202|does not exist/i.test(message);
      set({
        status: "error",
        error: schemaMissing
          ? "The database needs the latest setup. An administrator should run supabase/schema.sql in the Supabase SQL editor, then reload this page."
          : message || "Could not load your access.",
      });
      return "error";
    }
  },

  reset: () => {
    writePreview("");
    set({ status: "idle", me: null, members: [], previewMemberId: "", error: "", rolePermissions: DEFAULT_ROLE_PERMISSIONS, rules: DEFAULT_RULES });
  },

  refreshMembers: async () => {
    const members = await get().service().listMembers();
    const me = members.find((member) => member.id === get().me?.id) || get().me;
    set({ members, me });
    return members;
  },

  refreshSettings: async () => {
    const settings = await get().service().getSettings();
    set({ rolePermissions: settings.roles, rules: settings.rules });
    return settings;
  },

  saveSettings: async (changes) => {
    const settings = await get().service().saveSettings(changes);
    set({ rolePermissions: settings.roles, rules: settings.rules });
    return settings;
  },

  addMember: async (member) => {
    const created = await get().service().addMember(member);
    await get().refreshMembers();
    return created;
  },

  updateMember: async (id, changes) => {
    const updated = await get().service().updateMember(id, changes);
    await get().refreshMembers();
    return updated;
  },

  removeMember: async (id) => {
    await get().service().removeMember(id);
    if (get().previewMemberId === id) get().setPreview("");
    await get().refreshMembers();
  },

  setPreview: (memberId) => {
    writePreview(memberId);
    set({ previewMemberId: memberId || "" });
  },

  logEvent: (action, target, detail) => {
    get()
      .service()
      .logEvent(action, target, detail)
      .catch(() => {});
  },
}));

/**
 * The access the app should apply right now: the signed-in member, or the
 * person an administrator is previewing as.
 */
export function getAccess(state = useAccessStore.getState()) {
  // Before access is loaded (local mode start-up, unit tests) nothing is
  // restricted; cloud mode always loads access before showing any data.
  if (state.status === "idle") {
    return {
      mode: state.mode,
      member: null,
      realMember: null,
      previewing: null,
      permissions: resolvePermissions({ role: "admin" }),
      rules: state.rules,
      unrestricted: true,
    };
  }
  const real = state.me;
  const previewing =
    state.previewMemberId && real && (real.role === "admin" || state.mode === "local")
      ? state.members.find((member) => member.id === state.previewMemberId && member.id !== real.id) || null
      : null;
  const member = previewing || real;
  return {
    mode: state.mode,
    member,
    realMember: real,
    previewing,
    permissions: resolvePermissions(member, state.rolePermissions),
    rules: state.rules,
  };
}

let cached = { key: null, value: null };

function accessKey(state) {
  return [state.status, state.me, state.members, state.rolePermissions, state.rules, state.previewMemberId, state.mode];
}

function memoAccess(state) {
  const key = accessKey(state);
  if (cached.key && cached.key.every((value, index) => value === key[index])) return cached.value;
  cached = { key, value: getAccess(state) };
  return cached.value;
}

export function useAccess() {
  return useAccessStore(memoAccess);
}

export function useCan(permission) {
  return useAccessStore((state) => Boolean(memoAccess(state).permissions[permission]));
}

/** Projects the current person may see. */
export function useVisibleProjects(projects) {
  const access = useAccess();
  if (access.unrestricted || !access.member || access.member.role === "admin" || !Array.isArray(access.member.projectIds)) return projects;
  return projects.filter((project) => canAccessProject(access.member, project.id));
}

export function canSee(projectId) {
  const access = getAccess();
  return access.unrestricted || canAccessProject(access.member, projectId);
}
