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

function mapProjectDocumentRow(row) {
  return {
    ...(row.document_data || {}),
    id: row.id,
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
    document_data: document,
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

export async function loadProjectDocuments() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("User not logged in.");
  }

  const { data, error } = await supabase
    .from("project_documents")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(mapProjectDocumentRow);
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
