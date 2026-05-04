import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Edit3,
  FileText,
  Gauge,
  Save,
  Trash2,
} from "lucide-react";
import pptxgen from "pptxgenjs";

const EMPTY_FORM = {
  reportingWeek: "",
  reportDate: "",
  preparedBy: "",
  projectManager: "",
  clientDepartment: "",
  overallStatus: "Green",

  executiveSummary: "",
  leadershipMessage: "",
  overallHealthNotes: "",

  plannedProgress: 0,
  actualProgress: 0,
  scheduleVariance: 0,
  completedTasks: 0,
  inProgressTasks: 0,
  blockedTasks: 0,

  milestonesCompleted: "",
  milestonesNextWeek: "",
  achievements: "",
  nextWeekPlan: "",

  currentStatus: "",
  majorMilestoneAchieved: "",
  upcomingMilestone: "",
  potentialRisk: "",
  outstandingIssuesJustification: "",
  challengesFaced: "",
  teamMembers: "",

  pocScopeAcceptanceStatus: "",
  pocDevelopmentStatus: "",
  pocInternalDemoStatus: "",
  pocFinalDemoStatus: "",
  pocNextSteps: "",

  proposalStatus: "",
  documentationStatus: "",

  risks: "",
  issues: "",
  mitigationPlan: "",

  escalationRequired: "No",
  escalationDetails: "",

  decisionRequired: "No",
  decisionDetails: "",
  decisionImpact: "",
  decisionRequiredBy: "",

  budgetStatus: "On Track",
  plannedBudget: "",
  actualSpend: "",
  forecastedSpend: "",
  costVariance: "",

  timelineNotes: "",
  supportNeeded: "",
  pmRemarks: "",
  confidenceLevel: "High",
};

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isNaN(number) ? 0 : number;
}

function cleanFileName(value) {
  return String(value || "weekly-manager-report")
    .replace(/[^a-z0-9-_]/gi, "_")
    .toLowerCase();
}

function getStatusClass(status) {
  if (status === "Green") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Amber") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-red-200 bg-red-50 text-red-700";
}

function getStatusDotClass(status) {
  if (status === "Green") return "bg-emerald-500";
  if (status === "Amber") return "bg-amber-500";
  return "bg-red-500";
}

function calculateAutoStatus(form) {
  const planned = safeNumber(form.plannedProgress);
  const actual = safeNumber(form.actualProgress);
  const variance = actual - planned;
  const blocked = safeNumber(form.blockedTasks);

  if (blocked > 0 || variance <= -15 || form.escalationRequired === "Yes") {
    return {
      scheduleVariance: variance,
      overallStatus: "Red",
      confidenceLevel: "Low",
    };
  }

  if (
    variance < 0 ||
    form.decisionRequired === "Yes" ||
    form.budgetStatus === "At Risk" ||
    form.budgetStatus === "Over Budget"
  ) {
    return {
      scheduleVariance: variance,
      overallStatus: "Amber",
      confidenceLevel: "Medium",
    };
  }

  return {
    scheduleVariance: variance,
    overallStatus: "Green",
    confidenceLevel: "High",
  };
}

function getManagerActionSummary(report) {
  const planned = safeNumber(report.plannedProgress);
  const actual = safeNumber(report.actualProgress);
  const variance = actual - planned;
  const blocked = safeNumber(report.blockedTasks);

  if (report.overallStatus === "Red") {
    if (blocked > 0) {
      return `Immediate attention required. ${blocked} task(s) are currently blocked and may impact delivery unless resolved quickly.`;
    }

    if (variance <= -15) {
      return `Immediate attention required. Actual progress is behind planned progress by ${Math.abs(
        variance
      )}%, which may impact the project timeline.`;
    }

    return "Immediate management attention is required due to critical project health indicators.";
  }

  if (report.overallStatus === "Amber") {
    if (report.decisionRequired === "Yes") {
      return "Management decision is required to avoid timeline or delivery impact.";
    }

    if (report.escalationRequired === "Yes") {
      return "Escalation support is required to bring the project back to a stable path.";
    }

    return "Project is generally progressing but has risk indicators that should be monitored closely.";
  }

  return "No immediate management intervention required. Project is currently tracking within acceptable limits.";
}

function Field({ label, children }) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white ${
        props.readOnly || props.disabled
          ? "cursor-not-allowed bg-slate-100 text-slate-600"
          : "bg-slate-50"
      }`}
    />
  );
}

function SelectInput(props) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 focus:bg-white ${
        props.disabled
          ? "cursor-not-allowed bg-slate-100 text-slate-600"
          : "bg-slate-50"
      }`}
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      rows={props.rows || 3}
      className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-5 text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
    />
  );
}

function CompactMetric({ label, value, icon: Icon, tone = "slate" }) {
  const toneClass =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "red"
      ? "bg-red-50 text-red-700"
      : "bg-slate-50 text-slate-700";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </div>
          <div className="text-base font-semibold text-slate-900">{value}</div>
        </div>

        <div
          className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneClass}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function FormSection({
  sectionKey,
  title,
  subtitle,
  openSection,
  onOpenSection,
  children,
}) {
  const open = openSection === sectionKey;

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        onClick={() => onOpenSection(open ? "" : sectionKey)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
      >
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>
          ) : null}
        </div>

        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
      </button>

      {open ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
  );
}

function pptText(value, fallback = "-") {
  return value && String(value).trim() ? String(value).trim() : fallback;
}

function pptLines(value, fallback = "No update provided.") {
  const lines = String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length ? lines : [fallback];
}

function getPptStatusMeta(status) {
  if (status === "Green") {
    return {
      label: "ON TRACK",
      bg: "DCFCE7",
      text: "166534",
      border: "86EFAC",
    };
  }

  if (status === "Amber") {
    return {
      label: "AT RISK",
      bg: "FEF3C7",
      text: "92400E",
      border: "FCD34D",
    };
  }

  return {
    label: "CRITICAL",
    bg: "FEE2E2",
    text: "991B1B",
    border: "FCA5A5",
  };
}

function addPptHeader(slide, title, subtitle = "") {
  slide.background = { color: "FFFFFF" };

  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.18,
    fill: { color: "0F172A" },
    line: { color: "0F172A" },
  });

  slide.addText(title, {
    x: 0.45,
    y: 0.34,
    w: 9.5,
    h: 0.38,
    fontFace: "Aptos Display",
    fontSize: 21,
    bold: true,
    color: "111827",
    margin: 0,
  });

  slide.addText(subtitle, {
    x: 0.45,
    y: 0.78,
    w: 10.8,
    h: 0.25,
    fontFace: "Aptos",
    fontSize: 10,
    color: "111827",
    margin: 0,
  });
}

function addPptFooter(slide, report) {
  slide.addShape("line", {
    x: 0.45,
    y: 7.05,
    w: 12.4,
    h: 0,
    line: { color: "CBD5E1", width: 1 },
  });

  slide.addText("Weekly Manager Project Report", {
    x: 0.45,
    y: 7.17,
    w: 5,
    h: 0.18,
    fontSize: 8,
    color: "475569",
    margin: 0,
  });

  slide.addText(report.reportDate || new Date().toLocaleDateString(), {
    x: 10.85,
    y: 7.17,
    w: 2,
    h: 0.18,
    fontSize: 8,
    color: "475569",
    align: "right",
    margin: 0,
  });
}

function addPptKpiCard(slide, x, y, w, h, label, value, options = {}) {
  const fill = options.fill || "F8FAFC";
  const valueColor = options.valueColor || "111827";
  const border = options.border || "CBD5E1";

  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: border, width: 1 },
  });

  slide.addText(label, {
    x: x + 0.15,
    y: y + 0.12,
    w: w - 0.3,
    h: 0.18,
    fontSize: 8,
    bold: true,
    color: "334155",
    margin: 0,
  });

  slide.addText(String(value || "-"), {
    x: x + 0.15,
    y: y + 0.38,
    w: w - 0.3,
    h: h - 0.42,
    fontSize: options.fontSize || 17,
    bold: true,
    color: valueColor,
    fit: "shrink",
    margin: 0,
  });
}

function addPptSectionTitle(slide, title, x, y, w = 5) {
  slide.addText(title, {
    x,
    y,
    w,
    h: 0.28,
    fontSize: 13,
    bold: true,
    color: "111827",
    margin: 0,
  });

  slide.addShape("line", {
    x,
    y: y + 0.36,
    w,
    h: 0,
    line: { color: "CBD5E1", width: 1 },
  });
}

function addPptParagraph(slide, value, x, y, w, h, fontSize = 11.5) {
  slide.addText(pptText(value, "No update provided."), {
    x,
    y,
    w,
    h,
    fontSize,
    color: "111827",
    fit: "shrink",
    valign: "top",
    breakLine: false,
    margin: 0.06,
    fontFace: "Aptos",
  });
}

function addPptBullets(slide, value, x, y, w, h, maxItems = 5) {
  const lines = pptLines(value).slice(0, maxItems);
  const lineHeight = Math.min(0.36, h / Math.max(lines.length, 1));

  lines.forEach((line, index) => {
    const itemY = y + index * lineHeight;

    slide.addText("•", {
      x,
      y: itemY,
      w: 0.22,
      h: 0.25,
      fontSize: 13,
      bold: true,
      color: "111827",
      margin: 0,
    });

    slide.addText(line, {
      x: x + 0.28,
      y: itemY,
      w: w - 0.28,
      h: lineHeight,
      fontSize: 11.5,
      color: "111827",
      fit: "shrink",
      valign: "top",
      margin: 0,
      fontFace: "Aptos",
    });
  });
}

function addProgressBar(slide, x, y, w, h, label, value, color = "0F172A") {
  const finalValue = Math.max(0, Math.min(100, safeNumber(value)));
  const filledWidth = (w * finalValue) / 100;

  slide.addText(label, {
    x,
    y: y - 0.27,
    w,
    h: 0.22,
    fontSize: 9.5,
    bold: true,
    color: "111827",
    margin: 0,
  });

  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    rectRadius: 0.05,
    fill: { color: "E2E8F0" },
    line: { color: "E2E8F0" },
  });

  slide.addShape("roundRect", {
    x,
    y,
    w: filledWidth,
    h,
    rectRadius: 0.05,
    fill: { color },
    line: { color },
  });

  slide.addText(`${finalValue}%`, {
    x: x + w + 0.12,
    y: y - 0.04,
    w: 0.65,
    h: 0.22,
    fontSize: 9,
    bold: true,
    color: "111827",
    margin: 0,
  });
}

function addTwoColumnPanel(slide, leftTitle, leftValue, rightTitle, rightValue) {
  addPptSectionTitle(slide, leftTitle, 0.6, 1.25, 5.6);
  addPptBullets(slide, leftValue, 0.75, 1.78, 5.35, 4.15, 7);

  addPptSectionTitle(slide, rightTitle, 6.8, 1.25, 5.6);
  addPptBullets(slide, rightValue, 6.95, 1.78, 5.35, 4.15, 7);
}

function addMetadataBullets(slide, items, x, y, w) {
  const lineHeight = 0.34;

  items.forEach((item, index) => {
    const itemY = y + index * lineHeight;

    slide.addText("•", {
      x,
      y: itemY,
      w: 0.22,
      h: 0.25,
      fontSize: 12,
      bold: true,
      color: "111827",
      margin: 0,
    });

    slide.addText(item, {
      x: x + 0.28,
      y: itemY,
      w: w - 0.28,
      h: 0.28,
      fontSize: 10.5,
      color: "111827",
      fit: "shrink",
      margin: 0,
      fontFace: "Aptos",
    });
  });
}

async function generateManagerPpt({ report, project }) {
  const pptx = new pptxgen();

  pptx.layout = "LAYOUT_WIDE";
  pptx.author = report.preparedBy || report.projectManager || "Project Manager";
  pptx.subject = "Weekly Manager Project Report";
  pptx.title = `${project?.name || "Project"} Weekly Manager Report`;
  pptx.company = "Company";
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
    lang: "en-US",
  };

  const status = getPptStatusMeta(report.overallStatus);
  const plannedProgress = safeNumber(report.plannedProgress);
  const actualProgress = safeNumber(report.actualProgress);
  const variance = safeNumber(report.scheduleVariance);
  const blocked = safeNumber(report.blockedTasks);
  const managerActionSummary = getManagerActionSummary(report);

  let slide = pptx.addSlide();

  slide.background = { color: "0F172A" };

  slide.addText("Weekly Manager Project Report", {
    x: 0.6,
    y: 0.55,
    w: 7.5,
    h: 0.35,
    fontSize: 19,
    bold: true,
    color: "FFFFFF",
    margin: 0,
  });

  slide.addText(project?.name || "Project", {
    x: 0.6,
    y: 1.35,
    w: 8.8,
    h: 0.6,
    fontSize: 31,
    bold: true,
    color: "FFFFFF",
    margin: 0,
    fit: "shrink",
  });

  slide.addText(`Reporting Week: ${report.reportingWeek || "-"}`, {
    x: 0.62,
    y: 2.08,
    w: 4.5,
    h: 0.25,
    fontSize: 11,
    color: "F8FAFC",
    margin: 0,
  });

  slide.addText(`Prepared By: ${report.preparedBy || "-"}`, {
    x: 0.62,
    y: 2.42,
    w: 4.5,
    h: 0.25,
    fontSize: 11,
    color: "F8FAFC",
    margin: 0,
  });

  slide.addShape("roundRect", {
    x: 9.25,
    y: 0.65,
    w: 3,
    h: 0.9,
    rectRadius: 0.08,
    fill: { color: status.bg },
    line: { color: status.border },
  });

  slide.addText(status.label, {
    x: 9.45,
    y: 0.92,
    w: 2.6,
    h: 0.28,
    fontSize: 17,
    bold: true,
    color: status.text,
    align: "center",
    margin: 0,
  });

  slide.addShape("roundRect", {
    x: 0.6,
    y: 3.05,
    w: 12.1,
    h: 1.35,
    rectRadius: 0.08,
    fill: { color: "1E293B" },
    line: { color: "334155" },
  });

  slide.addText(
    pptText(report.executiveSummary, "No executive summary provided."),
    {
      x: 0.85,
      y: 3.3,
      w: 11.55,
      h: 0.85,
      fontSize: 18,
      bold: true,
      color: "FFFFFF",
      fit: "shrink",
      valign: "mid",
      margin: 0.05,
    }
  );

  addPptKpiCard(slide, 0.6, 5.05, 2.15, 0.95, "Planned", `${plannedProgress}%`);
  addPptKpiCard(slide, 3.05, 5.05, 2.15, 0.95, "Actual", `${actualProgress}%`, {
    fill: "DCFCE7",
    valueColor: "166534",
    border: "86EFAC",
  });
  addPptKpiCard(slide, 5.5, 5.05, 2.15, 0.95, "Variance", `${variance}%`, {
    fill: variance < 0 ? "FEE2E2" : "F8FAFC",
    valueColor: variance < 0 ? "991B1B" : "111827",
    border: variance < 0 ? "FCA5A5" : "CBD5E1",
  });
  addPptKpiCard(slide, 7.95, 5.05, 2.15, 0.95, "Blocked", blocked, {
    fill: blocked > 0 ? "FEE2E2" : "F8FAFC",
    valueColor: blocked > 0 ? "991B1B" : "111827",
    border: blocked > 0 ? "FCA5A5" : "CBD5E1",
  });
  addPptKpiCard(
    slide,
    10.4,
    5.05,
    2.15,
    0.95,
    "Confidence",
    report.confidenceLevel || "-"
  );

  slide.addText(report.reportDate || new Date().toLocaleDateString(), {
    x: 10.45,
    y: 6.95,
    w: 2.2,
    h: 0.2,
    fontSize: 8.5,
    color: "F8FAFC",
    align: "right",
    margin: 0,
  });

  slide = pptx.addSlide();
  addPptHeader(
    slide,
    "Manager Dashboard Snapshot",
    "High-level view of project health, progress, execution, and management attention."
  );

  slide.addShape("roundRect", {
    x: 0.6,
    y: 1.2,
    w: 2.65,
    h: 1.05,
    rectRadius: 0.08,
    fill: { color: status.bg },
    line: { color: status.border },
  });

  slide.addText("OVERALL STATUS", {
    x: 0.8,
    y: 1.38,
    w: 2.25,
    h: 0.18,
    fontSize: 8,
    bold: true,
    color: "111827",
    align: "center",
    margin: 0,
  });

  slide.addText(status.label, {
    x: 0.8,
    y: 1.68,
    w: 2.25,
    h: 0.3,
    fontSize: 17,
    bold: true,
    color: status.text,
    align: "center",
    margin: 0,
  });

  addPptKpiCard(slide, 3.55, 1.2, 1.95, 1.05, "Planned", `${plannedProgress}%`);
  addPptKpiCard(slide, 5.75, 1.2, 1.95, 1.05, "Actual", `${actualProgress}%`);
  addPptKpiCard(
    slide,
    7.95,
    1.2,
    1.95,
    1.05,
    "Completed",
    safeNumber(report.completedTasks)
  );
  addPptKpiCard(slide, 10.15, 1.2, 1.95, 1.05, "Blocked", blocked);

  addPptSectionTitle(slide, "Progress View", 0.6, 2.85, 5.4);
  addProgressBar(
    slide,
    0.75,
    3.45,
    4.5,
    0.18,
    "Planned Progress",
    plannedProgress,
    "475569"
  );
  addProgressBar(
    slide,
    0.75,
    4.15,
    4.5,
    0.18,
    "Actual Progress",
    actualProgress,
    "16A34A"
  );

  addPptSectionTitle(slide, "Leadership Message", 6.75, 2.85, 5.6);
  addPptParagraph(slide, report.leadershipMessage, 6.9, 3.32, 5.45, 1.35, 12);

  addPptSectionTitle(slide, "Overall Health Notes", 0.6, 5.05, 5.4);
  addPptBullets(slide, report.overallHealthNotes, 0.75, 5.5, 5.45, 1, 3);

  addPptSectionTitle(slide, "Management Attention Required", 6.75, 5.05, 5.6);
  addPptBullets(slide, managerActionSummary, 6.9, 5.5, 5.45, 1, 3);

  addPptFooter(slide, report);

  slide = pptx.addSlide();
  addPptHeader(
    slide,
    "Project Update Summary",
    "Status, milestones, risks, issues, challenges, achievements, and team information."
  );

  addPptSectionTitle(slide, "Current Status", 0.6, 1.2, 3.8);
  addPptBullets(
    slide,
    report.currentStatus || report.executiveSummary,
    0.75,
    1.68,
    3.65,
    1.05,
    4
  );

  addPptSectionTitle(slide, "Major Milestone Achieved", 4.75, 1.2, 3.8);
  addPptBullets(
    slide,
    report.majorMilestoneAchieved || report.milestonesCompleted,
    4.9,
    1.68,
    3.65,
    1.05,
    4
  );

  addPptSectionTitle(slide, "Upcoming Milestone", 8.9, 1.2, 3.7);
  addPptBullets(
    slide,
    report.upcomingMilestone || report.milestonesNextWeek,
    9.05,
    1.68,
    3.55,
    1.05,
    4
  );

  addPptSectionTitle(slide, "Potential Risk", 0.6, 3.1, 3.8);
  addPptBullets(
    slide,
    report.potentialRisk || report.risks,
    0.75,
    3.58,
    3.65,
    1.05,
    4
  );

  addPptSectionTitle(slide, "Outstanding Issues with Justification", 4.75, 3.1, 3.8);
  addPptBullets(
    slide,
    report.outstandingIssuesJustification || report.issues,
    4.9,
    3.58,
    3.65,
    1.05,
    4
  );

  addPptSectionTitle(slide, "Challenges Faced by Team", 8.9, 3.1, 3.7);
  addPptBullets(
    slide,
    report.challengesFaced || report.supportNeeded,
    9.05,
    3.58,
    3.55,
    1.05,
    4
  );

  addPptSectionTitle(slide, "Achievements", 0.6, 5.0, 3.8);
  addPptBullets(slide, report.achievements, 0.75, 5.48, 3.65, 1.05, 4);

  addPptSectionTitle(slide, "Team Members", 4.75, 5.0, 3.8);
  addPptBullets(slide, report.teamMembers, 4.9, 5.48, 3.65, 1.05, 4);

  addPptSectionTitle(slide, "Manager Remarks", 8.9, 5.0, 3.7);
  addPptBullets(slide, report.pmRemarks, 9.05, 5.48, 3.55, 1.05, 4);

  addPptFooter(slide, report);

  slide = pptx.addSlide();
  addPptHeader(
    slide,
    "Progress and Weekly Execution",
    "What moved this week and what is planned next week."
  );

  addTwoColumnPanel(
    slide,
    "Key Achievements This Week",
    report.achievements,
    "Next Week Plan",
    report.nextWeekPlan
  );

  slide.addShape("roundRect", {
    x: 0.6,
    y: 6.08,
    w: 5.8,
    h: 0.62,
    rectRadius: 0.05,
    fill: { color: "F8FAFC" },
    line: { color: "CBD5E1" },
  });

  slide.addText(`Milestones Completed: ${pptText(report.milestonesCompleted)}`, {
    x: 0.8,
    y: 6.23,
    w: 5.4,
    h: 0.28,
    fontSize: 10,
    color: "111827",
    fit: "shrink",
    margin: 0,
  });

  slide.addShape("roundRect", {
    x: 6.8,
    y: 6.08,
    w: 5.8,
    h: 0.62,
    rectRadius: 0.05,
    fill: { color: "F8FAFC" },
    line: { color: "CBD5E1" },
  });

  slide.addText(`Next Milestones: ${pptText(report.milestonesNextWeek)}`, {
    x: 7,
    y: 6.23,
    w: 5.4,
    h: 0.28,
    fontSize: 10,
    color: "111827",
    fit: "shrink",
    margin: 0,
  });

  addPptFooter(slide, report);

  slide = pptx.addSlide();
  addPptHeader(
    slide,
    "POC and Documentation Update",
    "Proof of concept progress, proposal readiness, and documentation status."
  );

  addPptSectionTitle(slide, "Scope Definition & Acceptance Criteria Status", 0.6, 1.15, 5.7);
  addPptBullets(slide, report.pocScopeAcceptanceStatus, 0.75, 1.62, 5.55, 1.0, 4);

  addPptSectionTitle(slide, "POC Development", 6.8, 1.15, 5.5);
  addPptBullets(slide, report.pocDevelopmentStatus, 6.95, 1.62, 5.4, 1.0, 4);

  addPptSectionTitle(slide, "Internal Demo & Feedback Incorporation", 0.6, 3.0, 5.7);
  addPptBullets(slide, report.pocInternalDemoStatus, 0.75, 3.47, 5.55, 1.0, 4);

  addPptSectionTitle(slide, "POC Final Demo", 6.8, 3.0, 5.5);
  addPptBullets(slide, report.pocFinalDemoStatus, 6.95, 3.47, 5.4, 1.0, 4);

  addPptSectionTitle(slide, "POC Next Steps", 0.6, 4.85, 5.7);
  addPptBullets(slide, report.pocNextSteps, 0.75, 5.32, 5.55, 1.0, 4);

  addPptSectionTitle(slide, "Proposal & Documentation Status", 6.8, 4.85, 5.5);
  addPptBullets(
    slide,
    `Proposal Status: ${pptText(report.proposalStatus)}\nDocumentation Status: ${pptText(
      report.documentationStatus
    )}`,
    6.95,
    5.32,
    5.4,
    1.0,
    4
  );

  addPptFooter(slide, report);

  slide = pptx.addSlide();
  addPptHeader(
    slide,
    "Risks, Issues, Decisions, and Escalations",
    "Critical items that may impact delivery, timeline, cost, or management decisions."
  );

  addPptKpiCard(
    slide,
    0.6,
    1.15,
    2.2,
    0.78,
    "Escalation",
    report.escalationRequired || "No"
  );
  addPptKpiCard(
    slide,
    3.05,
    1.15,
    2.2,
    0.78,
    "Decision",
    report.decisionRequired || "No"
  );
  addPptKpiCard(
    slide,
    5.5,
    1.15,
    2.2,
    0.78,
    "Required By",
    report.decisionRequiredBy || "-"
  );
  addPptKpiCard(slide, 7.95, 1.15, 2.2, 0.78, "Blocked", blocked);
  addPptKpiCard(
    slide,
    10.4,
    1.15,
    2.2,
    0.78,
    "Budget",
    report.budgetStatus || "-"
  );

  addPptSectionTitle(slide, "Top Risks", 0.6, 2.45, 3.55);
  addPptBullets(slide, report.risks, 0.75, 2.92, 3.45, 1.65, 4);

  addPptSectionTitle(slide, "Open Issues", 4.65, 2.45, 3.55);
  addPptBullets(slide, report.issues, 4.8, 2.92, 3.45, 1.65, 4);

  addPptSectionTitle(slide, "Mitigation Plan", 8.7, 2.45, 3.55);
  addPptBullets(slide, report.mitigationPlan, 8.85, 2.92, 3.45, 1.65, 4);

  addPptSectionTitle(slide, "Management Decision Required", 0.6, 5.05, 5.7);
  addPptBullets(
    slide,
    report.decisionDetails || report.escalationDetails,
    0.75,
    5.5,
    5.6,
    1,
    3
  );

  addPptSectionTitle(slide, "Impact if Delayed", 6.8, 5.05, 5.5);
  addPptBullets(slide, report.decisionImpact, 6.95, 5.5, 5.45, 1, 3);

  addPptFooter(slide, report);

  slide = pptx.addSlide();
  addPptHeader(
    slide,
    "Budget, Timeline, and Support Needed",
    "Commercial position, timeline view, and support required for closure."
  );

  addPptKpiCard(
    slide,
    0.6,
    1.15,
    2.45,
    0.85,
    "Budget Status",
    report.budgetStatus || "-"
  );
  addPptKpiCard(
    slide,
    3.3,
    1.15,
    2.45,
    0.85,
    "Planned Budget",
    report.plannedBudget || "-"
  );
  addPptKpiCard(
    slide,
    6,
    1.15,
    2.45,
    0.85,
    "Actual Spend",
    report.actualSpend || "-"
  );
  addPptKpiCard(
    slide,
    8.7,
    1.15,
    2.45,
    0.85,
    "Cost Variance",
    report.costVariance || "-"
  );

  addPptSectionTitle(slide, "Timeline Notes", 0.6, 2.65, 5.5);
  addPptBullets(slide, report.timelineNotes, 0.75, 3.12, 5.45, 1.45, 4);

  addPptSectionTitle(slide, "Support Needed", 6.8, 2.65, 5.5);
  addPptBullets(slide, report.supportNeeded, 6.95, 3.12, 5.45, 1.45, 4);

  addPptSectionTitle(slide, "Forecasted Spend", 0.6, 5.1, 5.5);
  addPptBullets(slide, report.forecastedSpend, 0.75, 5.55, 5.45, 0.95, 3);

  addPptSectionTitle(slide, "PM Remarks", 6.8, 5.1, 5.5);
  addPptBullets(slide, report.pmRemarks, 6.95, 5.55, 5.45, 0.95, 3);

  addPptFooter(slide, report);

  slide = pptx.addSlide();
  addPptHeader(
    slide,
    "Appendix and Additional Notes",
    "Detailed remarks and supporting project information."
  );

  addPptSectionTitle(slide, "PM Remarks", 0.6, 1.25, 5.7);
  addPptBullets(slide, report.pmRemarks, 0.75, 1.75, 5.6, 1.9, 5);

  addPptSectionTitle(slide, "Escalation Details", 6.8, 1.25, 5.5);
  addPptBullets(slide, report.escalationDetails, 6.95, 1.75, 5.45, 1.9, 5);

  addPptSectionTitle(slide, "Overall Health Notes", 0.6, 4.35, 5.7);
  addPptBullets(slide, report.overallHealthNotes, 0.75, 4.85, 5.6, 1.2, 4);

  addPptSectionTitle(slide, "Report Metadata", 6.8, 4.35, 5.5);
  addMetadataBullets(
    slide,
    [
      `Prepared By: ${report.preparedBy || "-"}`,
      `Project Manager: ${report.projectManager || "-"}`,
      `Client / Department: ${report.clientDepartment || "-"}`,
      `Report Date: ${report.reportDate || "-"}`,
      `Confidence Level: ${report.confidenceLevel || "-"}`,
    ],
    6.95,
    4.85,
    5.45
  );

  addPptFooter(slide, report);

  const fileName = `${cleanFileName(project?.name)}-${cleanFileName(
    report.reportingWeek
  )}-manager-weekly-report.pptx`;

  await pptx.writeFile({ fileName });
}

export default function WeeklyCeoReportView({
  selectedProject,
  tasks = [],
  weeklyReports = [],
  onAddReport,
  onUpdateReport,
  onDeleteReport,
}) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    reportDate: new Date().toISOString().slice(0, 10),
  });

  const [editingReportId, setEditingReportId] = useState("");
  const [message, setMessage] = useState("");
  const [openSection, setOpenSection] = useState("basic");

  const projectTasks = useMemo(() => {
    if (!selectedProject) return [];
    return tasks.filter((task) => task.projectId === selectedProject.id);
  }, [tasks, selectedProject]);

  const projectReports = useMemo(() => {
    if (!selectedProject) return [];
    return weeklyReports.filter(
      (report) => report.projectId === selectedProject.id
    );
  }, [weeklyReports, selectedProject]);

  const calculated = useMemo(() => {
    const total = projectTasks.length;

    const completed = projectTasks.filter((task) =>
      ["Done", "Completed", "Closed"].includes(task.status)
    ).length;

    const inProgress = projectTasks.filter((task) =>
      ["In Progress", "Ongoing"].includes(task.status)
    ).length;

    const blocked = projectTasks.filter((task) =>
      ["Blocked", "On Hold"].includes(task.status)
    ).length;

    const plannedAvg = total
      ? Math.round(
          projectTasks.reduce(
            (sum, task) => sum + Number(task.plannedProgress || 0),
            0
          ) / total
        )
      : 0;

    const actualAvg = total
      ? Math.round(
          projectTasks.reduce(
            (sum, task) => sum + Number(task.actualProgress || 0),
            0
          ) / total
        )
      : 0;

    return {
      completed,
      inProgress,
      blocked,
      plannedAvg,
      actualAvg,
      variance: actualAvg - plannedAvg,
    };
  }, [projectTasks]);

  useEffect(() => {
    setForm((current) => {
      const auto = calculateAutoStatus(current);

      if (
        Number(current.scheduleVariance) === auto.scheduleVariance &&
        current.overallStatus === auto.overallStatus &&
        current.confidenceLevel === auto.confidenceLevel
      ) {
        return current;
      }

      return {
        ...current,
        scheduleVariance: auto.scheduleVariance,
        overallStatus: auto.overallStatus,
        confidenceLevel: auto.confidenceLevel,
      };
    });
  }, [
    form.plannedProgress,
    form.actualProgress,
    form.blockedTasks,
    form.escalationRequired,
    form.decisionRequired,
    form.budgetStatus,
  ]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function applyPlannerMetrics() {
    setForm((current) => {
      const next = {
        ...current,
        plannedProgress: calculated.plannedAvg,
        actualProgress: calculated.actualAvg,
        completedTasks: calculated.completed,
        inProgressTasks: calculated.inProgress,
        blockedTasks: calculated.blocked,
      };

      const auto = calculateAutoStatus(next);

      return {
        ...next,
        scheduleVariance: auto.scheduleVariance,
        overallStatus: auto.overallStatus,
        confidenceLevel: auto.confidenceLevel,
      };
    });

    setMessage("Planner metrics applied and status recalculated.");
  }

  function resetForm() {
    setForm({
      ...EMPTY_FORM,
      reportDate: new Date().toISOString().slice(0, 10),
    });
    setEditingReportId("");
    setOpenSection("basic");
  }

  function handleEdit(report) {
    setEditingReportId(report.id);
    setForm({
      ...EMPTY_FORM,
      ...report,
    });
    setOpenSection("basic");
    setMessage("Editing submitted report.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!selectedProject) {
      setMessage("Please select a project first.");
      return;
    }

    if (!form.reportingWeek) {
      setMessage("Please select the reporting week.");
      setOpenSection("basic");
      return;
    }

    const auto = calculateAutoStatus(form);

    const payload = {
      ...form,
      projectId: selectedProject.id,
      plannedProgress: safeNumber(form.plannedProgress),
      actualProgress: safeNumber(form.actualProgress),
      scheduleVariance: auto.scheduleVariance,
      completedTasks: safeNumber(form.completedTasks),
      inProgressTasks: safeNumber(form.inProgressTasks),
      blockedTasks: safeNumber(form.blockedTasks),
      overallStatus: auto.overallStatus,
      confidenceLevel: auto.confidenceLevel,
    };

    if (editingReportId) {
      onUpdateReport(editingReportId, payload);
      setMessage("Weekly manager report updated successfully.");
    } else {
      onAddReport(payload);
      setMessage("Weekly manager report submitted successfully.");
    }

    resetForm();
  }

  if (!selectedProject) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          <FileText className="h-4 w-4" />
          Weekly Manager Report
        </div>

        <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
          Select a project first
        </h3>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Weekly manager report submission is available only for a selected
          project.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              <FileText className="h-3.5 w-3.5" />
              Weekly Manager Report
            </div>

            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
              {selectedProject.name}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              One compact weekly form for manager-level status reporting,
              centralized PPT reporting, POC tracking, proposals, and
              documentation updates.
            </p>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${getStatusClass(
              form.overallStatus
            )}`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${getStatusDotClass(
                form.overallStatus
              )}`}
            />
            {form.overallStatus}
          </div>
        </div>
      </section>

      <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <CompactMetric
          label="Planned"
          value={`${calculated.plannedAvg}%`}
          icon={BarChart3}
        />

        <CompactMetric
          label="Actual"
          value={`${calculated.actualAvg}%`}
          icon={Gauge}
          tone="green"
        />

        <CompactMetric
          label="Completed"
          value={calculated.completed}
          icon={CheckCircle2}
          tone="green"
        />

        <CompactMetric
          label="Blocked"
          value={calculated.blocked}
          icon={AlertTriangle}
          tone={calculated.blocked > 0 ? "red" : "slate"}
        />
      </section>

      <form
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">
                {editingReportId
                  ? "Edit Weekly Manager Report"
                  : "Weekly Manager Report Submission Form"}
              </h4>

              <p className="text-xs text-slate-500">
                Fill the required sections and submit from the bottom of this
                form.
              </p>
            </div>

            <button
              type="button"
              onClick={applyPlannerMetrics}
              className="inline-flex w-fit items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Use Planner Metrics
            </button>
          </div>

          {message ? (
            <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
              {message}
            </div>
          ) : null}
        </div>

        <FormSection
          sectionKey="basic"
          title="1. Basic Information"
          subtitle="Project week, owner, status, and report metadata."
          openSection={openSection}
          onOpenSection={setOpenSection}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Field label="Reporting Week">
              <TextInput
                type="date"
                value={form.reportingWeek}
                onChange={(event) =>
                  updateField("reportingWeek", event.target.value)
                }
              />
            </Field>

            <Field label="Report Date">
              <TextInput
                type="date"
                value={form.reportDate}
                onChange={(event) =>
                  updateField("reportDate", event.target.value)
                }
              />
            </Field>

            <Field label="Status">
              <SelectInput value={form.overallStatus} disabled>
                <option value="Green">Green - On Track</option>
                <option value="Amber">Amber - At Risk</option>
                <option value="Red">Red - Critical</option>
              </SelectInput>
            </Field>

            <Field label="Prepared By">
              <TextInput
                value={form.preparedBy}
                onChange={(event) =>
                  updateField("preparedBy", event.target.value)
                }
                placeholder="Prepared by"
              />
            </Field>

            <Field label="Project Manager">
              <TextInput
                value={form.projectManager}
                onChange={(event) =>
                  updateField("projectManager", event.target.value)
                }
                placeholder="PM name"
              />
            </Field>

            <Field label="Client / Dept.">
              <TextInput
                value={form.clientDepartment}
                onChange={(event) =>
                  updateField("clientDepartment", event.target.value)
                }
                placeholder="Client or department"
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          sectionKey="summary"
          title="2. Executive Summary"
          subtitle="Main message for management and leadership."
          openSection={openSection}
          onOpenSection={setOpenSection}
        >
          <div className="grid gap-3 xl:grid-cols-3">
            <Field label="Executive Summary">
              <TextArea
                rows={3}
                value={form.executiveSummary}
                onChange={(event) =>
                  updateField("executiveSummary", event.target.value)
                }
                placeholder="Management-level summary"
              />
            </Field>

            <Field label="Leadership Message">
              <TextArea
                rows={3}
                value={form.leadershipMessage}
                onChange={(event) =>
                  updateField("leadershipMessage", event.target.value)
                }
                placeholder="What leadership should know"
              />
            </Field>

            <Field label="Overall Health Notes">
              <TextArea
                rows={3}
                value={form.overallHealthNotes}
                onChange={(event) =>
                  updateField("overallHealthNotes", event.target.value)
                }
                placeholder="Overall health notes"
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          sectionKey="centralized"
          title="3. Centralized PPT Project Update"
          subtitle="These fields feed the centralized project-wise PPT slides."
          openSection={openSection}
          onOpenSection={setOpenSection}
        >
          <div className="grid gap-3 xl:grid-cols-2">
            <Field label="Current Status">
              <TextArea
                rows={3}
                value={form.currentStatus}
                onChange={(event) =>
                  updateField("currentStatus", event.target.value)
                }
                placeholder="Current status of the project"
              />
            </Field>

            <Field label="Major Milestone Achieved">
              <TextArea
                rows={3}
                value={form.majorMilestoneAchieved}
                onChange={(event) =>
                  updateField("majorMilestoneAchieved", event.target.value)
                }
                placeholder="Major milestone achieved"
              />
            </Field>

            <Field label="Upcoming Milestone">
              <TextArea
                rows={3}
                value={form.upcomingMilestone}
                onChange={(event) =>
                  updateField("upcomingMilestone", event.target.value)
                }
                placeholder="Upcoming milestone"
              />
            </Field>

            <Field label="Potential Risk">
              <TextArea
                rows={3}
                value={form.potentialRisk}
                onChange={(event) =>
                  updateField("potentialRisk", event.target.value)
                }
                placeholder="Potential project risk"
              />
            </Field>

            <Field label="Outstanding Issues with Justification">
              <TextArea
                rows={3}
                value={form.outstandingIssuesJustification}
                onChange={(event) =>
                  updateField(
                    "outstandingIssuesJustification",
                    event.target.value
                  )
                }
                placeholder="Outstanding issue and why it exists"
              />
            </Field>

            <Field label="Challenges Faced by Team">
              <TextArea
                rows={3}
                value={form.challengesFaced}
                onChange={(event) =>
                  updateField("challengesFaced", event.target.value)
                }
                placeholder="Team challenges"
              />
            </Field>

            <Field label="Achievements">
              <TextArea
                rows={3}
                value={form.achievements}
                onChange={(event) =>
                  updateField("achievements", event.target.value)
                }
                placeholder="Project achievements"
              />
            </Field>

            <Field label="Team Members">
              <TextArea
                rows={3}
                value={form.teamMembers}
                onChange={(event) =>
                  updateField("teamMembers", event.target.value)
                }
                placeholder="Team members involved"
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          sectionKey="poc"
          title="4. Proof of Concept Updates"
          subtitle="These fields feed the consolidated POC slide."
          openSection={openSection}
          onOpenSection={setOpenSection}
        >
          <div className="grid gap-3 xl:grid-cols-2">
            <Field label="Scope Definition & Acceptance Criteria Status">
              <TextArea
                rows={3}
                value={form.pocScopeAcceptanceStatus}
                onChange={(event) =>
                  updateField("pocScopeAcceptanceStatus", event.target.value)
                }
                placeholder="Scope, requirements, success criteria, and acceptance status"
              />
            </Field>

            <Field label="POC Development">
              <TextArea
                rows={3}
                value={form.pocDevelopmentStatus}
                onChange={(event) =>
                  updateField("pocDevelopmentStatus", event.target.value)
                }
                placeholder="Development progress"
              />
            </Field>

            <Field label="POC Internal Demo & Feedback Incorporation">
              <TextArea
                rows={3}
                value={form.pocInternalDemoStatus}
                onChange={(event) =>
                  updateField("pocInternalDemoStatus", event.target.value)
                }
                placeholder="Internal demo and feedback incorporation status"
              />
            </Field>

            <Field label="POC Final Demo">
              <TextArea
                rows={3}
                value={form.pocFinalDemoStatus}
                onChange={(event) =>
                  updateField("pocFinalDemoStatus", event.target.value)
                }
                placeholder="Final demo readiness/status"
              />
            </Field>

            <Field label="POC Next Steps">
              <TextArea
                rows={3}
                value={form.pocNextSteps}
                onChange={(event) =>
                  updateField("pocNextSteps", event.target.value)
                }
                placeholder="Immediate next steps for POC closure"
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          sectionKey="proposalDocs"
          title="5. Proposal and Documentation Updates"
          subtitle="These fields feed the proposal/documentation centralized PPT slide."
          openSection={openSection}
          onOpenSection={setOpenSection}
        >
          <div className="grid gap-3 xl:grid-cols-2">
            <Field label="Proposal Status">
              <TextArea
                rows={3}
                value={form.proposalStatus}
                onChange={(event) =>
                  updateField("proposalStatus", event.target.value)
                }
                placeholder="Proposal prepared, under review, submitted, approved, pending, etc."
              />
            </Field>

            <Field label="Documentation Status">
              <TextArea
                rows={3}
                value={form.documentationStatus}
                onChange={(event) =>
                  updateField("documentationStatus", event.target.value)
                }
                placeholder="BRD, MOM, proposal, technical document, UAT document, etc."
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          sectionKey="progress"
          title="6. Progress and Delivery"
          subtitle="Progress numbers, next week plan, and milestones."
          openSection={openSection}
          onOpenSection={setOpenSection}
        >
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Field label="Planned %">
              <TextInput
                type="number"
                value={form.plannedProgress}
                onChange={(event) =>
                  updateField("plannedProgress", event.target.value)
                }
              />
            </Field>

            <Field label="Actual %">
              <TextInput
                type="number"
                value={form.actualProgress}
                onChange={(event) =>
                  updateField("actualProgress", event.target.value)
                }
              />
            </Field>

            <Field label="Variance %">
              <TextInput
                type="number"
                value={form.scheduleVariance}
                readOnly
                title="Auto calculated as Actual % - Planned %"
              />
            </Field>

            <Field label="Completed">
              <TextInput
                type="number"
                value={form.completedTasks}
                onChange={(event) =>
                  updateField("completedTasks", event.target.value)
                }
              />
            </Field>

            <Field label="In Progress">
              <TextInput
                type="number"
                value={form.inProgressTasks}
                onChange={(event) =>
                  updateField("inProgressTasks", event.target.value)
                }
              />
            </Field>

            <Field label="Blocked">
              <TextInput
                type="number"
                value={form.blockedTasks}
                onChange={(event) =>
                  updateField("blockedTasks", event.target.value)
                }
              />
            </Field>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            <Field label="Next Week Plan">
              <TextArea
                rows={4}
                value={form.nextWeekPlan}
                onChange={(event) =>
                  updateField("nextWeekPlan", event.target.value)
                }
                placeholder="One planned activity per line"
              />
            </Field>

            <Field label="Milestones Completed">
              <TextArea
                rows={4}
                value={form.milestonesCompleted}
                onChange={(event) =>
                  updateField("milestonesCompleted", event.target.value)
                }
              />
            </Field>

            <Field label="Milestones Planned Next Week">
              <TextArea
                rows={3}
                value={form.milestonesNextWeek}
                onChange={(event) =>
                  updateField("milestonesNextWeek", event.target.value)
                }
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          sectionKey="risks"
          title="7. Risks, Issues, and Decisions"
          subtitle="Escalations, risks, issues, mitigation, and leadership decisions."
          openSection={openSection}
          onOpenSection={setOpenSection}
        >
          <div className="grid gap-3 xl:grid-cols-3">
            <Field label="Risks">
              <TextArea
                rows={3}
                value={form.risks}
                onChange={(event) => updateField("risks", event.target.value)}
                placeholder="One risk per line"
              />
            </Field>

            <Field label="Issues">
              <TextArea
                rows={3}
                value={form.issues}
                onChange={(event) => updateField("issues", event.target.value)}
                placeholder="One issue per line"
              />
            </Field>

            <Field label="Mitigation Plan">
              <TextArea
                rows={3}
                value={form.mitigationPlan}
                onChange={(event) =>
                  updateField("mitigationPlan", event.target.value)
                }
              />
            </Field>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Field label="Escalation">
              <SelectInput
                value={form.escalationRequired}
                onChange={(event) =>
                  updateField("escalationRequired", event.target.value)
                }
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </SelectInput>
            </Field>

            <Field label="Decision">
              <SelectInput
                value={form.decisionRequired}
                onChange={(event) =>
                  updateField("decisionRequired", event.target.value)
                }
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </SelectInput>
            </Field>

            <Field label="Decision By">
              <TextInput
                type="date"
                value={form.decisionRequiredBy}
                onChange={(event) =>
                  updateField("decisionRequiredBy", event.target.value)
                }
              />
            </Field>

            <Field label="Confidence">
              <SelectInput value={form.confidenceLevel} disabled>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </SelectInput>
            </Field>

            <Field label="Budget Status">
              <SelectInput
                value={form.budgetStatus}
                onChange={(event) =>
                  updateField("budgetStatus", event.target.value)
                }
              >
                <option value="On Track">On Track</option>
                <option value="At Risk">At Risk</option>
                <option value="Over Budget">Over Budget</option>
                <option value="Not Applicable">Not Applicable</option>
              </SelectInput>
            </Field>

            <Field label="Cost Variance">
              <TextInput
                value={form.costVariance}
                onChange={(event) =>
                  updateField("costVariance", event.target.value)
                }
              />
            </Field>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-3">
            <Field label="Decision / Escalation Details">
              <TextArea
                rows={3}
                value={form.decisionDetails}
                onChange={(event) =>
                  updateField("decisionDetails", event.target.value)
                }
              />
            </Field>

            <Field label="Impact if Delayed">
              <TextArea
                rows={3}
                value={form.decisionImpact}
                onChange={(event) =>
                  updateField("decisionImpact", event.target.value)
                }
              />
            </Field>

            <Field label="Support Needed">
              <TextArea
                rows={3}
                value={form.supportNeeded}
                onChange={(event) =>
                  updateField("supportNeeded", event.target.value)
                }
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          sectionKey="budget"
          title="8. Budget, Timeline, and Remarks"
          subtitle="Optional financial, timeline, and PM remarks."
          openSection={openSection}
          onOpenSection={setOpenSection}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Planned Budget">
              <TextInput
                value={form.plannedBudget}
                onChange={(event) =>
                  updateField("plannedBudget", event.target.value)
                }
              />
            </Field>

            <Field label="Actual Spend">
              <TextInput
                value={form.actualSpend}
                onChange={(event) =>
                  updateField("actualSpend", event.target.value)
                }
              />
            </Field>

            <Field label="Forecasted Spend">
              <TextInput
                value={form.forecastedSpend}
                onChange={(event) =>
                  updateField("forecastedSpend", event.target.value)
                }
              />
            </Field>

            <Field label="Escalation Details">
              <TextInput
                value={form.escalationDetails}
                onChange={(event) =>
                  updateField("escalationDetails", event.target.value)
                }
              />
            </Field>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            <Field label="Timeline Notes">
              <TextArea
                rows={3}
                value={form.timelineNotes}
                onChange={(event) =>
                  updateField("timelineNotes", event.target.value)
                }
              />
            </Field>

            <Field label="PM Remarks">
              <TextArea
                rows={3}
                value={form.pmRemarks}
                onChange={(event) => updateField("pmRemarks", event.target.value)}
              />
            </Field>
          </div>
        </FormSection>

        <div className="bg-slate-50 px-4 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="text-xs text-slate-500">
              Review all sections before submitting. Variance, status, and
              confidence are auto-calculated.
            </div>

            <div className="flex flex-wrap gap-2">
              {editingReportId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Cancel Edit
                </button>
              ) : null}

              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                <Save className="h-4 w-4" />
                {editingReportId
                  ? "Update Weekly Manager Report"
                  : "Submit Weekly Manager Report"}
              </button>
            </div>
          </div>
        </div>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">
              Submitted Reports
            </h4>

            <p className="text-xs text-slate-500">
              Edit submitted reports or generate manager-ready PPT.
            </p>
          </div>

          <div className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
            {projectReports.length} report(s)
          </div>
        </div>

        <div className="mt-3 grid gap-2">
          {projectReports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              No weekly reports submitted yet.
            </div>
          ) : (
            projectReports.map((report) => (
              <div
                key={report.id}
                className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${getStatusClass(
                          report.overallStatus
                        )}`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${getStatusDotClass(
                            report.overallStatus
                          )}`}
                        />
                        {report.overallStatus}
                      </span>

                      <h5 className="text-sm font-semibold text-slate-900">
                        Week: {report.reportingWeek || "-"}
                      </h5>
                    </div>

                    <p className="mt-2 line-clamp-2 max-w-5xl text-sm leading-5 text-slate-600">
                      {report.executiveSummary ||
                        report.currentStatus ||
                        "No executive summary added."}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                      <span className="rounded-xl bg-slate-50 px-2 py-1">
                        Prepared: {report.preparedBy || "-"}
                      </span>

                      <span className="rounded-xl bg-slate-50 px-2 py-1">
                        Planned: {safeNumber(report.plannedProgress)}%
                      </span>

                      <span className="rounded-xl bg-slate-50 px-2 py-1">
                        Actual: {safeNumber(report.actualProgress)}%
                      </span>

                      <span className="rounded-xl bg-slate-50 px-2 py-1">
                        Variance: {safeNumber(report.scheduleVariance)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(report)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        generateManagerPpt({ report, project: selectedProject })
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                    >
                      <Download className="h-3.5 w-3.5" />
                      PPT
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Are you sure you want to delete this weekly report?"
                          )
                        ) {
                          onDeleteReport(report.id);
                        }
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}