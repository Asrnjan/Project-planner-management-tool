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

function makeSafeProjectData(project) {
  return {
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
    saveType: project.saveType || "full_workspace",
    selectedProjectId: project.selectedProjectId || "",
    autoSaved: Boolean(project.autoSaved),
  };
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

  if (project.id) {
    const { data, error } = await supabase
      .from("projects")
      .update(payload)
      .eq("id", project.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabase
    .from("projects")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function loadProjects() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("User not logged in.");
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function deleteProject(projectId) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("User not logged in.");
  }

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }

  return true;
}