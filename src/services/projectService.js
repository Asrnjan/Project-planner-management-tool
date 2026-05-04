import { supabase } from "../lib/supabaseClient";

export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function makeSafeProjectData(project) {
  return {
    ...project,

    id: project.id,
    cloudId: project.cloudId || project.dbId || "",

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
    saveType: project.saveType || "single_project",
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

    // Keep app/local project ID for routing and task relationships
    id: projectData.id || row.id,

    // Store Supabase DB UUID separately
    cloudId: row.id,
    dbId: row.id,

    userId: row.user_id,
    name: row.name || projectData.name || "Untitled Project",
    description: row.description || projectData.description || "",
    owner: projectData.owner || "",
    status: projectData.status || "Active",
    startDate: projectData.startDate || "",
    targetEndDate: projectData.targetEndDate || "",
    createdAt: projectData.createdAt || row.created_at || "",
    updatedAt: projectData.updatedAt || row.updated_at || "",
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
  const profile = await getCurrentUserProfile();
  return profile?.role === "admin";
}

async function findExistingProjectRow(userId, localProjectId) {
  if (!localProjectId) return null;

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .eq("project_data->>id", localProjectId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function saveProject(project) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("User not logged in.");
  }

  const safeProjectData = makeSafeProjectData(project);

  const payload = {
    user_id: user.id,
    name: project.name || "Untitled Project",
    description: project.description || "",
    project_data: safeProjectData,
    updated_at: new Date().toISOString(),
  };

  const cloudId = project.cloudId || project.dbId || "";

  // Update using Supabase UUID only if available
  if (cloudId && isUuid(cloudId)) {
    const { data, error } = await supabase
      .from("projects")
      .update(payload)
      .eq("id", cloudId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return mapProjectRow(data);
  }

  // If project already exists in DB by local project ID, update that row
  const existingRow = await findExistingProjectRow(user.id, project.id);

  if (existingRow?.id) {
    const { data, error } = await supabase
      .from("projects")
      .update(payload)
      .eq("id", existingRow.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return mapProjectRow(data);
  }

  // Otherwise insert new row and let Supabase generate UUID
  const { data, error } = await supabase
    .from("projects")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapProjectRow(data);
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

  if (!options.allUsers) {
    query = query.eq("user_id", user.id);
  }

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

export async function deleteProject(projectIdOrCloudId) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("User not logged in.");
  }

  // If it is a Supabase UUID, delete directly
  if (isUuid(projectIdOrCloudId)) {
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectIdOrCloudId)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    return true;
  }

  // Otherwise find DB row by local project ID
  const existingRow = await findExistingProjectRow(user.id, projectIdOrCloudId);

  if (!existingRow?.id) {
    return true;
  }

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", existingRow.id)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }

  return true;
}