import { supabase } from "../lib/supabaseClient";
import { getCurrentUser, isCurrentUserAdmin } from "./projectService";

function mapWeeklyReportRow(row) {
  return {
    ...(row.report_data || {}),
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    reportingWeek:
      row.report_data?.reportingWeek || row.reporting_week || "",
    reportDate: row.report_data?.reportDate || row.report_date || "",
    overallStatus:
      row.report_data?.overallStatus || row.overall_status || "Green",
    createdAt: row.report_data?.createdAt || row.created_at || "",
    updatedAt: row.report_data?.updatedAt || row.updated_at || "",
  };
}

export async function saveWeeklyReport(report) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("User not logged in.");
  }

  const payload = {
    id: report.id,
    user_id: user.id,
    project_id: report.projectId,
    report_data: {
      ...report,
      userId: user.id,
      updatedAt: new Date().toISOString(),
    },
    reporting_week: report.reportingWeek || "",
    report_date: report.reportDate || "",
    overall_status: report.overallStatus || "Green",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("weekly_reports")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapWeeklyReportRow(data);
}

export async function loadWeeklyReports(options = {}) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("User not logged in.");
  }

  let query = supabase
    .from("weekly_reports")
    .select("*")
    .order("updated_at", { ascending: false });

  if (!options.allUsers) {
    query = query.eq("user_id", user.id);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data || []).map(mapWeeklyReportRow);
}

export async function loadAllWeeklyReportsForCentralizedReport() {
  const admin = await isCurrentUserAdmin();

  if (!admin) {
    return loadWeeklyReports({ allUsers: false });
  }

  return loadWeeklyReports({ allUsers: true });
}

export async function deleteWeeklyReportCloud(reportId) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("User not logged in.");
  }

  const { error } = await supabase
    .from("weekly_reports")
    .delete()
    .eq("id", reportId)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }

  return true;
}

export async function saveCentralizedReportRecord(reportData) {
  const user = await getCurrentUser();
  const admin = await isCurrentUserAdmin();

  if (!user) {
    throw new Error("User not logged in.");
  }

  if (!admin) {
    throw new Error("Only admin users can save centralized reports.");
  }

  const payload = {
    created_by: user.id,
    title: reportData.title || "Centralized Projects Report",
    report_date: new Date().toISOString().slice(0, 10),
    report_data: reportData,
  };

  const { data, error } = await supabase
    .from("centralized_reports")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}