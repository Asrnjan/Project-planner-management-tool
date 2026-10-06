import { supabase } from "../lib/supabaseClient";

// Reads the user from the locally stored session instead of calling
// auth.getUser(), which costs a network round trip on every save. Row level
// security on the server still checks the token on each request.
export async function getCurrentUser() {
  if (!supabase) return null;

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session?.user || null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function makeSafeProjectData(project) {
  return {
    ...project,

    id: project.id || "",
    cloudId: project.cloudId || project.dbId || "",
    dbId: project.dbId || project.cloudId || "",

    projects: Array.isArray(project.projects) ? project.projects : [],
    tasks: Array.isArray(project.tasks) ? project.tasks : [],
    sprints: Array.isArray(project.sprints) ? project.sprints : [],
    baselineSnapshots: Array.isArray(project.baselineSnapshots)
      ? project.baselineSnapshots
      : [],
    weeklyReports: Array.isArray(project.weeklyReports)
      ? project.weeklyReports
      : [],
    projectDocuments: Array.isArray(project.projectDocuments)
      ? project.projectDocuments
      : [],
    plannerSettings:
      project.plannerSettings && typeof project.plannerSettings === "object"
        ? project.plannerSettings
        : { schedulingMode: "manual" },

    savedAt: project.savedAt || new Date().toISOString(),
    saveType: project.saveType || "single_project_workspace",
    selectedProjectId: project.selectedProjectId || "",
    autoSaved: Boolean(project.autoSaved),
  };
}

function mapProjectRow(row) {
  const projectData =
    row.project_data && typeof row.project_data === "object"
      ? row.project_data
      : {};

  return {
    ...projectData,

    id: projectData.id || row.id,

    cloudId: row.id,
    dbId: row.id,

    userId: row.user_id,
    user_id: row.user_id,

    name: row.name || projectData.name || "Untitled Project",
    description: row.description || projectData.description || "",
    owner: projectData.owner || "",
    status: projectData.status || "Active",
    startDate: projectData.startDate || "",
    targetEndDate: projectData.targetEndDate || "",

    createdAt: projectData.createdAt || row.created_at || "",
    updatedAt: projectData.updatedAt || row.updated_at || "",
    created_at: row.created_at || "",
    updated_at: row.updated_at || "",

    project_data: projectData,
  };
}

export async function getCurrentUserProfile() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data;
  }

  const { data: createdProfile, error: insertError } = await supabase
    .from("user_profiles")
    .insert({
      id: user.id,
      email: user.email,
      role: "user",
    })
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  return createdProfile;
}

export async function isCurrentUserAdmin() {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("is_workspace_admin");
  if (error) {
    // Workspaces set up before team roles: fall back to the old profile role.
    const profile = await getCurrentUserProfile();
    return profile?.role === "admin";
  }
  return data === true;
}

async function findExistingProjectRow(localProjectId) {
  if (!localProjectId) return null;

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("project_data->>id", localProjectId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function projectRowContainsProjectId(row, projectId) {
  const projectData =
    row?.project_data && typeof row.project_data === "object"
      ? row.project_data
      : {};

  if (!projectId) return false;

  if (row?.id === projectId) return true;
  if (projectData.id === projectId) return true;
  if (projectData.cloudId === projectId) return true;
  if (projectData.dbId === projectId) return true;
  if (projectData.selectedProjectId === projectId) return true;

  if (Array.isArray(projectData.projects)) {
    const found = projectData.projects.some((project) => {
      return (
        project?.id === projectId ||
        project?.cloudId === projectId ||
        project?.dbId === projectId
      );
    });

    if (found) return true;
  }

  if (Array.isArray(projectData.tasks)) {
    const found = projectData.tasks.some(
      (task) => task?.projectId === projectId
    );

    if (found) return true;
  }

  if (Array.isArray(projectData.sprints)) {
    const found = projectData.sprints.some(
      (sprint) => sprint?.projectId === projectId
    );

    if (found) return true;
  }

  if (Array.isArray(projectData.weeklyReports)) {
    const found = projectData.weeklyReports.some(
      (report) => report?.projectId === projectId
    );

    if (found) return true;
  }

  if (Array.isArray(projectData.projectDocuments)) {
    const found = projectData.projectDocuments.some(
      (document) => document?.projectId === projectId
    );

    if (found) return true;
  }

  return false;
}

/**
 * Saves one project. With `expectedUpdatedAt`, the save only goes through if
 * nobody else saved the project since; otherwise it returns
 * { conflict: true, latest } with the server's current version so the
 * caller can merge. Row level security decides who may save what.
 */
export async function saveProject(project, { expectedUpdatedAt = "" } = {}) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("User not logged in.");
  }

  const safeProjectData = makeSafeProjectData(project);
  const fields = {
    name: project.name || safeProjectData.name || "Untitled Project",
    description: project.description || safeProjectData.description || "",
    project_data: safeProjectData,
  };

  let cloudId = isUuid(project.cloudId) ? project.cloudId : isUuid(project.dbId) ? project.dbId : "";

  if (!cloudId) {
    const existingRow = await findExistingProjectRow(project.id);
    cloudId = existingRow?.id || "";
  }

  if (cloudId) {
    let query = supabase.from("projects").update(fields).eq("id", cloudId);
    if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);

    const { data, error } = await query.select().maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return { project: mapProjectRow(data), conflict: false };
    }

    const { data: latest, error: latestError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", cloudId)
      .maybeSingle();

    if (latestError) {
      throw latestError;
    }

    if (latest) {
      return { project: null, conflict: true, latest: mapProjectRow(latest) };
    }

    throw new Error("This project was deleted or you no longer have access to it.");
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ ...fields, user_id: user.id })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return { project: mapProjectRow(data), conflict: false };
}

export async function loadProjects(options = {}) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("User not logged in.");
  }

  let query = supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  // Row level security returns exactly the projects this person may see.
  void options;

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data || []).map(mapProjectRow);
}

export async function loadAllProjectsForCentralizedReport() {
  const admin = await isCurrentUserAdmin();

  if (!admin) {
    return loadProjects({ allUsers: false });
  }

  return loadProjects({ allUsers: true });
}

export async function deleteProject(projectOrId) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("User not logged in.");
  }

  const project =
    projectOrId && typeof projectOrId === "object" ? projectOrId : null;

  const idsToDelete = Array.from(
    new Set(
      [
        project?.id,
        project?.cloudId,
        project?.dbId,
        typeof projectOrId === "string" ? projectOrId : "",
      ].filter(Boolean)
    )
  );

  if (idsToDelete.length === 0) {
    return true;
  }

  const { data: rows, error: fetchError } = await supabase
    .from("projects")
    .select("*");

  if (fetchError) {
    throw fetchError;
  }

  const rowsToDelete = [];

  for (const row of rows || []) {
    const shouldDelete = idsToDelete.some((id) => {
      if (isUuid(id) && row.id === id) return true;
      return projectRowContainsProjectId(row, id);
    });

    if (shouldDelete) {
      rowsToDelete.push(row.id);
    }
  }

  if (rowsToDelete.length === 0) {
    return true;
  }

  const { error: deleteError } = await supabase
    .from("projects")
    .delete()
    .in("id", rowsToDelete);

  if (deleteError) {
    throw deleteError;
  }

  return true;
}