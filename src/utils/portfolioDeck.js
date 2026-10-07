// Renders the portfolio deck (see src/domain/deckData.js) as a PowerPoint
// file. Everything is native, editable PowerPoint: text boxes, shapes and
// bullet lists in Calibri, no images of text, no embedded fonts or macros.
//
// Slides: 1 banner, then summary cards (6 per slide), then one slide per
// project.

import pptxgen from "pptxgenjs";
import { cleanSlideText, formatDeckDate } from "../domain/deckData";

const W = 13.333;
const H = 7.5;
const FONT = "Calibri";

const C = {
  navy: "1E1B4B",
  navy2: "312E81",
  indigo: "4F46E5",
  indigoSoft: "EEF2FF",
  lilac: "C7D2FE",
  ink: "0F172A",
  text: "334155",
  muted: "64748B",
  line: "E2E8F0",
  page: "F8FAFC",
  white: "FFFFFF",
  track: "E2E8F0",
};

const TONES = {
  green: { fg: "047857", bg: "D1FAE5", bar: "10B981" },
  amber: { fg: "B45309", bg: "FEF3C7", bar: "F59E0B" },
  red: { fg: "B91C1C", bg: "FEE2E2", bar: "EF4444" },
  blue: { fg: "1D4ED8", bg: "DBEAFE", bar: "3B82F6" },
  grey: { fg: "475569", bg: "F1F5F9", bar: "94A3B8" },
};

const tone = (name) => TONES[name] || TONES.grey;

// Font size by text length, so text fits its box the moment the file opens
// (PowerPoint's own shrink-to-fit only applies after an edit).
function sizeFor(value, steps) {
  const length = String(value || "").length;
  const step = steps.find(([max]) => length <= max);
  return step ? step[1] : steps[steps.length - 1][1];
}
const t = (value, max) => cleanSlideText(value, max) || " ";

function text(slide, value, options) {
  slide.addText(t(value, options.max || 600), {
    fontFace: FONT,
    color: C.text,
    fontSize: 12,
    margin: 0,
    valign: "top",
    ...options,
    max: undefined,
  });
}

function box(slide, pptx, { x, y, w, h, fill, line, radius }) {
  slide.addShape(radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, {
    x,
    y,
    w,
    h,
    fill: { color: fill },
    line: line ? { color: line, width: 0.75 } : { color: fill, width: 0 },
    ...(radius ? { rectRadius: radius } : {}),
  });
}

function chip(slide, pptx, label, toneName, x, y, w = 1.3) {
  const colours = tone(toneName);
  box(slide, pptx, { x, y, w, h: 0.32, fill: colours.bg, radius: 0.08 });
  text(slide, label, { x, y, w, h: 0.32, fontSize: 10, bold: true, color: colours.fg, align: "center", valign: "middle" });
}

function bar(slide, pptx, percent, x, y, w, colour, h = 0.14) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  box(slide, pptx, { x, y, w, h, fill: C.track });
  if (value > 0) box(slide, pptx, { x, y, w: Math.max(0.04, (w * value) / 100), h, fill: colour });
}

function bullets(slide, items, options) {
  const list = (items && items.length ? items : [options.empty || "None reported"]).map((item, index, all) => ({
    text: t(item, options.itemMax || 150),
    options: {
      bullet: items && items.length ? { indent: 12 } : false,
      color: items && items.length ? C.text : C.muted,
      breakLine: index < all.length - 1,
      paraSpaceAfter: 3,
    },
  }));
  slide.addText(list, { fontFace: FONT, fontSize: options.fontSize || 11, margin: 0, valign: "top", ...options, empty: undefined, itemMax: undefined });
}

function footer(slide, model, page) {
  text(slide, `${model.title}  ·  ${model.dateLabel}`, { x: 0.5, y: H - 0.42, w: 8, h: 0.25, fontSize: 9, color: C.muted });
  text(slide, String(page), { x: W - 1.5, y: H - 0.42, w: 1, h: 0.25, fontSize: 9, color: C.muted, align: "right" });
}

function card(slide, pptx, { x, y, w, h, title, accent = C.indigo }) {
  box(slide, pptx, { x, y, w, h, fill: C.white, line: C.line, radius: 0.06 });
  if (title) {
    text(slide, title.toUpperCase(), { x: x + 0.2, y: y + 0.14, w: w - 0.4, h: 0.26, fontSize: 10, bold: true, color: accent, charSpacing: 1 });
  }
}

// --------------------------------------------------------------- slide 1

function bannerSlide(pptx, model) {
  const slide = pptx.addSlide();
  slide.background = { color: C.navy };
  box(slide, pptx, { x: W - 4.2, y: 0, w: 4.2, h: H, fill: C.navy2 });
  box(slide, pptx, { x: 0.6, y: 1.05, w: 0.12, h: 2.3, fill: "818CF8" });

  text(slide, `PORTFOLIO REPORT  ·  ${model.dateLabel.toUpperCase()}`, { x: 0.95, y: 1.0, w: 8, h: 0.35, fontSize: 12, bold: true, color: "A5B4FC", charSpacing: 2 });
  const titleSize = sizeFor(model.title, [[28, 40], [44, 34], [60, 28], [80, 24]]);
  text(slide, model.title, { x: 0.95, y: 1.4, w: 7.6, h: 1.4, fontSize: titleSize, bold: true, color: C.white, valign: "middle" });
  text(slide, model.description, { x: 0.95, y: 2.9, w: 7.6, h: 0.75, fontSize: sizeFor(model.description, [[110, 16], [240, 13]]), color: C.lilac });
  if (model.headline) {
    text(slide, model.headline, { x: 0.95, y: 3.7, w: 7.6, h: 0.6, fontSize: 13, italic: true, color: C.white });
  }
  if (model.preparedBy) {
    text(slide, `Prepared by ${model.preparedBy}`, { x: 0.95, y: 4.35, w: 8, h: 0.3, fontSize: 12, color: "A5B4FC" });
  }

  // Right panel: the projects in this report, with their health.
  text(slide, "IN THIS REPORT", { x: W - 3.75, y: 1.0, w: 3.3, h: 0.3, fontSize: 11, bold: true, color: "A5B4FC", charSpacing: 2 });
  const listed = model.projects.slice(0, 9);
  listed.forEach((project, index) => {
    const y = 1.45 + index * 0.38;
    box(slide, pptx, { x: W - 3.75, y: y + 0.09, w: 0.14, h: 0.14, fill: tone(project.health.tone).bar, radius: 0.07 });
    text(slide, project.name, { x: W - 3.5, y, w: 3.1, h: 0.32, fontSize: 12, color: C.white, valign: "middle", max: 34 });
  });
  if (model.projects.length > listed.length) {
    text(slide, `and ${model.projects.length - listed.length} more`, { x: W - 3.5, y: 1.45 + listed.length * 0.38, w: 3.1, h: 0.3, fontSize: 11, italic: true, color: C.lilac });
  }

  const gap = 0.18;
  const kpiW = (W - 1.2 - gap * 5) / 6;
  model.kpis.forEach((kpi, index) => {
    const x = 0.6 + index * (kpiW + gap);
    const y = 5.2;
    box(slide, pptx, { x, y, w: kpiW, h: 1.35, fill: C.navy2, line: "4338CA", radius: 0.06 });
    const colour = kpi.tone ? tone(kpi.tone).bar : C.white;
    text(slide, kpi.value, { x: x + 0.2, y: y + 0.18, w: kpiW - 0.4, h: 0.6, fontSize: 30, bold: true, color: colour });
    text(slide, kpi.label, { x: x + 0.2, y: y + 0.82, w: kpiW - 0.4, h: 0.4, fontSize: 11, color: C.lilac });
  });
}

// ---------------------------------------------------------- summary cards

function summarySlides(pptx, model, startPage) {
  const perSlide = 6;
  const pages = Math.max(1, Math.ceil(model.projects.length / perSlide));
  for (let page = 0; page < pages; page += 1) {
    const slide = pptx.addSlide();
    slide.background = { color: C.page };
    const heading = pages > 1 ? `Portfolio at a glance (${page + 1} of ${pages})` : "Portfolio at a glance";
    text(slide, heading, { x: 0.5, y: 0.35, w: 9, h: 0.55, fontSize: 26, bold: true, color: C.ink });
    text(slide, model.summary || model.description, { x: 0.5, y: 0.92, w: 10.5, h: 0.55, fontSize: 12, color: C.muted });
    text(slide, model.dateLabel, { x: W - 3, y: 0.45, w: 2.5, h: 0.3, fontSize: 11, color: C.muted, align: "right" });

    const cols = 3;
    const gap = 0.25;
    const cardW = (W - 1 - gap * (cols - 1)) / cols;
    const cardH = 2.6;
    model.projects.slice(page * perSlide, page * perSlide + perSlide).forEach((project, index) => {
      const x = 0.5 + (index % cols) * (cardW + gap);
      const y = 1.6 + Math.floor(index / cols) * (cardH + 0.2);
      const colours = tone(project.health.tone);
      box(slide, pptx, { x, y, w: cardW, h: cardH, fill: C.white, line: C.line, radius: 0.06 });
      box(slide, pptx, { x, y: y + 0.12, w: 0.07, h: cardH - 0.24, fill: colours.bar });

      text(slide, project.name, { x: x + 0.25, y: y + 0.13, w: cardW - 1.75, h: 0.55, fontSize: sizeFor(project.name, [[22, 14], [40, 12], [80, 10.5]]), bold: true, color: C.ink, valign: "middle", max: 70 });
      chip(slide, pptx, project.health.label, project.health.tone, x + cardW - 1.4, y + 0.17, 1.2);

      bar(slide, pptx, project.percentComplete, x + 0.25, y + 0.78, cardW - 0.5, colours.bar);
      text(slide, `${project.percentComplete}% done  ·  ${project.percentPlanned}% planned by today`, { x: x + 0.25, y: y + 0.98, w: cardW - 0.5, h: 0.25, fontSize: 10, color: C.muted });
      const dates = [project.target ? `Target ${formatDeckDate(project.target)}` : "", project.forecast ? `Forecast ${formatDeckDate(project.forecast)}` : ""].filter(Boolean).join("  ·  ");
      text(slide, dates || "No dates yet", { x: x + 0.25, y: y + 1.22, w: cardW - 0.5, h: 0.25, fontSize: 10, color: C.muted });
      const nextDate = project.nextMilestone?.date ? ` (${formatDeckDate(project.nextMilestone.date)})` : "";
      const next = project.nextMilestone ? `Next: ${cleanSlideText(project.nextMilestone.title, 34 - nextDate.length)}${nextDate}` : "No upcoming milestone";
      text(slide, next, { x: x + 0.25, y: y + 1.46, w: cardW - 0.5, h: 0.25, fontSize: 9.5, bold: true, color: C.text });

      const highlights = [...project.keyUpdates.slice(0, 1), ...project.risks.slice(0, 1)];
      bullets(slide, highlights, { x: x + 0.25, y: y + 1.76, w: cardW - 0.5, h: cardH - 1.86, fontSize: 9.5, itemMax: 82, empty: "No updates yet" });
    });
    footer(slide, model, startPage + page);
  }
  return pages;
}

// ------------------------------------------------------ project slides

function dataStatusLine(project) {
  const parts = [`${project.percentComplete}% of the work is done against ${project.percentPlanned}% planned by today`];
  const problems = [
    project.counts.overdue ? `${project.counts.overdue} overdue` : "",
    project.counts.blocked ? `${project.counts.blocked} blocked` : "",
  ].filter(Boolean);
  if (problems.length) parts.push(`${problems.join(" and ")} task${project.counts.overdue + project.counts.blocked === 1 ? "" : "s"}`);
  if (project.forecast && project.target) {
    parts.push(`forecast finish ${formatDeckDate(project.forecast)} against a target of ${formatDeckDate(project.target)}`);
  }
  return `${parts.join("; ")}.`;
}

function milestoneLines(project) {
  const done = project.milestonesDone.map((item) => `Done: ${item.title}${item.date ? ` (${formatDeckDate(item.date)})` : ""}`);
  const next = project.milestonesUpcoming.map((item) => `${item.title}${item.date ? ` (${formatDeckDate(item.date)})` : ""}`);
  return [...done, ...next];
}

function projectSlide(pptx, model, project, page) {
  const slide = pptx.addSlide();
  slide.background = { color: C.page };
  const colours = tone(project.health.tone);

  // Header
  text(slide, project.name, { x: 0.5, y: 0.3, w: 10.2, h: 0.6, fontSize: sizeFor(project.name, [[36, 26], [48, 22], [64, 18], [90, 15]]), bold: true, color: C.ink, valign: "middle", max: 90 });
  chip(slide, pptx, project.health.label, project.health.tone, W - 2.1, 0.38, 1.6);
  const meta = [
    project.owner ? `Owner: ${project.owner}` : "",
    `Status: ${project.status}`,
    project.reportDate ? `Last weekly report: ${formatDeckDate(project.reportDate)}` : "",
    project.team.length ? `Team: ${project.team.join(", ")}` : "",
  ].filter(Boolean).join("   ·   ");
  text(slide, meta, { x: 0.5, y: 0.94, w: W - 1, h: 0.3, fontSize: 11, color: C.muted, max: 170 });

  // Status line
  box(slide, pptx, { x: 0.5, y: 1.35, w: W - 1, h: 0.72, fill: C.indigoSoft, radius: 0.06 });
  box(slide, pptx, { x: 0.5, y: 1.35, w: 0.08, h: 0.72, fill: colours.bar });
  const statusLine = project.statusLine || dataStatusLine(project);
  text(slide, statusLine, { x: 0.75, y: 1.42, w: W - 1.45, h: 0.6, fontSize: sizeFor(statusLine, [[150, 12], [260, 11]]), color: C.ink, valign: "middle", max: 260 });

  // Left column
  const lx = 0.5;
  const lw = 3.9;
  card(slide, pptx, { x: lx, y: 2.25, w: lw, h: 1.45, title: "Progress", accent: C.indigo });
  text(slide, `Done ${project.percentComplete}%`, { x: lx + 0.2, y: 2.62, w: 1.6, h: 0.25, fontSize: 11, bold: true, color: C.ink });
  bar(slide, pptx, project.percentComplete, lx + 1.6, 2.68, lw - 1.85, colours.bar);
  text(slide, `Planned ${project.percentPlanned}%`, { x: lx + 0.2, y: 2.95, w: 1.6, h: 0.25, fontSize: 11, color: C.text });
  bar(slide, pptx, project.percentPlanned, lx + 1.6, 3.01, lw - 1.85, "94A3B8");
  const spiText = project.spi === null || project.spi === undefined ? "Schedule index: not enough dated work yet" : `Schedule index ${project.spi} (1.0 = on plan)`;
  text(slide, spiText, { x: lx + 0.2, y: 3.3, w: lw - 0.4, h: 0.25, fontSize: 10, color: C.muted });

  card(slide, pptx, { x: lx, y: 3.82, w: lw, h: 1.45, title: "Timeline", accent: C.indigo });
  const slip =
    project.slipDays === null || project.slipDays === undefined
      ? "No target date"
      : project.slipDays > 0
      ? `${project.slipDays} days behind target`
      : project.slipDays < 0
      ? `${Math.abs(project.slipDays)} days ahead of target`
      : "On target";
  const rows = [
    ["Start", formatDeckDate(project.start) || "Not set"],
    ["Target finish", formatDeckDate(project.target) || "Not set"],
    ["Forecast finish", formatDeckDate(project.forecast) || "Not set"],
    ["Variance", slip],
  ];
  rows.forEach(([label, value], index) => {
    const y = 4.18 + index * 0.25;
    text(slide, label, { x: lx + 0.2, y, w: 1.35, h: 0.24, fontSize: 10.5, color: C.muted });
    text(slide, value, { x: lx + 1.5, y, w: lw - 1.65, h: 0.24, fontSize: 10.5, bold: true, color: label === "Variance" && project.slipDays > 0 ? TONES.red.fg : C.ink });
  });

  card(slide, pptx, { x: lx, y: 5.39, w: lw, h: 1.5, title: "Work", accent: C.indigo });
  const tiles = [
    ["Tasks", project.counts.total],
    ["Done", project.counts.done],
    ["In progress", project.counts.inProgress],
    ["Not started", project.counts.notStarted],
    ["Overdue", project.counts.overdue],
    ["Blocked", project.counts.blocked],
  ];
  const tileW = (lw - 0.4 - 0.2) / 3;
  tiles.forEach(([label, value], index) => {
    const x = lx + 0.2 + (index % 3) * (tileW + 0.1);
    const y = 5.73 + Math.floor(index / 3) * 0.55;
    const alert = (label === "Overdue" || label === "Blocked") && value > 0;
    text(slide, String(value), { x, y, w: tileW, h: 0.3, fontSize: 16, bold: true, color: alert ? TONES.red.fg : C.ink });
    text(slide, label, { x, y: y + 0.28, w: tileW, h: 0.22, fontSize: 9, color: C.muted });
  });

  // Right grid
  const rx = 4.6;
  const rw = W - 0.5 - rx;
  const cw = (rw - 0.2) / 2;
  const hasAsks = project.decisions.length > 0;
  const ch = hasAsks ? 1.72 : 2.27;
  const listSize = hasAsks ? 9.5 : 10.5;
  const sections = [
    { title: "Key updates", items: project.keyUpdates, accent: TONES.green.fg, empty: "No updates reported" },
    { title: "Risks and issues", items: project.risks, accent: TONES.red.fg, empty: "No risks or issues reported" },
    { title: "Next steps", items: project.nextSteps, accent: C.indigo, empty: "No upcoming work in the next three weeks" },
    { title: "Milestones", items: milestoneLines(project), accent: "7C3AED", empty: "No milestones set" },
  ];
  sections.forEach((section, index) => {
    const x = rx + (index % 2) * (cw + 0.2);
    const y = 2.25 + Math.floor(index / 2) * (ch + 0.12);
    card(slide, pptx, { x, y, w: cw, h: ch, title: section.title, accent: section.accent });
    bullets(slide, section.items.slice(0, 4), { x: x + 0.2, y: y + 0.46, w: cw - 0.4, h: ch - 0.54, fontSize: listSize, itemMax: hasAsks ? 95 : 120, empty: section.empty });
  });

  if (hasAsks) {
    const y = 2.25 + 2 * (ch + 0.12);
    card(slide, pptx, { x: rx, y, w: rw, h: 6.89 - y, title: "Decisions and support needed", accent: TONES.amber.fg });
    bullets(slide, project.decisions.slice(0, 2), { x: rx + 0.2, y: y + 0.42, w: rw - 0.4, h: 6.89 - y - 0.46, fontSize: 10, itemMax: 120 });
  }

  if (project.aiWritten) {
    text(slide, "Narrative drafted by Claude from live project data", { x: W - 5.5, y: H - 0.42, w: 4, h: 0.25, fontSize: 8, italic: true, color: C.muted, align: "right" });
  }
  footer(slide, model, page);
}

/** Builds the presentation object (used by tests and the download). */
export function buildPortfolioDeck(model) {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = model.preparedBy || "Project Planner";
  pptx.company = "Project Planner";
  pptx.title = model.title;
  pptx.subject = "Portfolio status report";
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };

  bannerSlide(pptx, model);
  const summaryPages = summarySlides(pptx, model, 2);
  model.projects.forEach((project, index) => projectSlide(pptx, model, project, 2 + summaryPages + index));
  return pptx;
}

export async function downloadPortfolioDeck(model) {
  const pptx = buildPortfolioDeck(model);
  const safeTitle = model.title.replace(/[^\w -]+/g, "").trim().replace(/\s+/g, "_") || "Portfolio_Report";
  await pptx.writeFile({ fileName: `${safeTitle}_${model.today}.pptx` });
}
