import { supabase } from "../lib/supabaseClient";
import { getCurrentUser, isCurrentUserAdmin } from "./projectService";

function mapProjectDocumentRow(row) {
  return {
    ...(row.document_data || {}),
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    title: row.document_data?.title || row.title || "Untitled Document",
    documentType:
      row.document_data?.documentType || row.document_type || "Other",
    status: row.document_data?.status || row.status || "Draft",
    createdAt: row.document_data?.createdAt || row.created_at || "",
    updatedAt: row.document_data?.updatedAt || row.updated_at || "",
  };
}

export async function saveProjectDocument(document) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("User not logged in.");
  }

  const payload = {
    id: document.id,
    user_id: user.id,
    project_id: document.projectId,
    document_data: {
      ...document,
      userId: user.id,
      updatedAt: new Date().toISOString(),
    },
    title: document.title || "Untitled Document",
    document_type: document.documentType || "Other",
    status: document.status || "Draft",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("project_documents")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapProjectDocumentRow(data);
}

export async function loadProjectDocuments(options = {}) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("User not logged in.");
  }

  let query = supabase
    .from("project_documents")
    .select("*")
    .order("updated_at", { ascending: false });

  if (!options.allUsers) {
    query = query.eq("user_id", user.id);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data || []).map(mapProjectDocumentRow);
}

export async function loadAllProjectDocumentsForCentralizedReport() {
  const admin = await isCurrentUserAdmin();

  if (!admin) {
    return loadProjectDocuments({ allUsers: false });
  }

  return loadProjectDocuments({ allUsers: true });
}

export async function deleteProjectDocumentCloud(documentId) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("User not logged in.");
  }

  const { error } = await supabase
    .from("project_documents")
    .delete()
    .eq("id", documentId)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }

  return true;
}