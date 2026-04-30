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

function mapWeeklyReportRow(row) {
  return {
    ...(row.report_data || {}),
    id: row.id,
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
    report_data: report,
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

export async function loadWeeklyReports() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("User not logged in.");
  }

  const { data, error } = await supabase
    .from("weekly_reports")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(mapWeeklyReportRow);
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