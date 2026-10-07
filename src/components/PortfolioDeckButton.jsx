import { useEffect, useMemo, useState } from "react";
import { Loader2, Presentation, Sparkles } from "lucide-react";

import { buildDeckAiInput, buildDeckModel } from "../domain/deckData";
import { downloadPortfolioDeck } from "../utils/portfolioDeck";
import { getAiStatus, runAi } from "../services/aiService";
import { isCurrentUserAdmin } from "../services/projectService";
import { saveCentralizedReportRecord } from "../services/reportService";
import { useAccess, useVisibleProjects } from "../store/useAccessStore";
import { usePlannerStore } from "../store/usePlannerStore";
import { confirmAction, notify } from "../ui/feedback";
import { Button, Field, Modal, cx, inputClass } from "../ui/primitives";

const PREFS_KEY = "pm-deck-prefs";

function readPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function writePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Preferences are a convenience only.
  }
}

function DeckForm({ onClose }) {
  const access = useAccess();
  const allProjects = usePlannerStore((state) => state.projects);
  const tasks = usePlannerStore((state) => state.tasks);
  const weeklyReports = usePlannerStore((state) => state.weeklyReports);
  const storageMode = usePlannerStore((state) => state.storageMode);
  const visible = useVisibleProjects(allProjects);
  const projects = useMemo(() => visible.filter((project) => project.status !== "Archived"), [visible]);

  const prefs = useMemo(() => readPrefs(), []);
  const [title, setTitle] = useState(prefs.title || "Portfolio Status Report");
  const [description, setDescription] = useState(prefs.description || "");
  const [preparedBy, setPreparedBy] = useState(prefs.preparedBy || access.realMember?.displayName || "");
  const [selected, setSelected] = useState(() => projects.map((project) => project.id));
  const [aiStatus, setAiStatus] = useState(null);
  const canUseAi = Boolean(access.permissions["ai.use"]);
  const [mode, setMode] = useState(canUseAi ? "ai" : "data");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (canUseAi) getAiStatus().then(setAiStatus);
  }, [canUseAi]);

  const aiReady = canUseAi && aiStatus?.configured;
  useEffect(() => {
    if (aiStatus && !aiStatus.configured) setMode("data");
  }, [aiStatus]);

  async function generate(event) {
    event.preventDefault();
    const chosen = projects.filter((project) => selected.includes(project.id));
    if (!chosen.length) return notify.error("Pick at least one project.");
    writePrefs({ title, description, preparedBy });

    const base = { projects: chosen, tasks, weeklyReports, title, description, preparedBy };
    let model = buildDeckModel(base);

    try {
      if (mode === "ai" && aiReady) {
        setBusy("Claude is writing the narrative...");
        try {
          const response = await runAi("portfolio_deck", buildDeckAiInput(model));
          model = buildDeckModel({ ...base, narrative: response.result });
        } catch (error) {
          const ok = await confirmAction({
            title: "Claude couldn't write the narrative",
            message: `${error.message} Download the slides with text from your project data and weekly reports instead?`,
            confirmLabel: "Download without Claude",
            tone: "primary",
          });
          if (!ok) return;
        }
      }

      setBusy("Building slides...");
      await downloadPortfolioDeck(model);
      notify.success(`Downloaded ${model.projects.length + 2 + Math.floor((model.projects.length - 1) / 6)} slides. Open them in PowerPoint, Keynote or Google Slides to edit.`);

      if (storageMode === "cloud") {
        isCurrentUserAdmin()
          .then((admin) =>
            admin
              ? saveCentralizedReportRecord({
                  title: model.title,
                  generatedAt: new Date().toISOString(),
                  totalProjects: model.projects.length,
                  projects: model.projects.map((project) => ({ name: project.name, health: project.health.label, percentComplete: project.percentComplete })),
                  aiNarrative: Boolean(model.headline),
                })
              : null
          )
          .catch(() => {});
      }
      onClose();
    } catch (error) {
      console.error("Portfolio deck failed:", error);
      notify.error(error?.message || "Could not create the slides. Please try again.");
    } finally {
      setBusy("");
    }
  }

  return (
    <form onSubmit={generate} className="space-y-4" noValidate>
      <Field label="Title" htmlFor="deck-title" hint="Shown large on the first slide.">
        <input id="deck-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} maxLength={80} />
      </Field>
      <Field label="Description" htmlFor="deck-description" hint="One or two sentences under the title, e.g. who it is for.">
        <textarea
          id="deck-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={cx(inputClass, "min-h-[64px]")}
          maxLength={240}
          placeholder={`Status, progress, risks and next steps for ${selected.length} active projects.`}
        />
      </Field>
      <Field label="Prepared by" htmlFor="deck-by">
        <input id="deck-by" value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} className={inputClass} maxLength={60} />
      </Field>

      <fieldset>
        <legend className="mb-1.5 flex w-full items-center justify-between text-xs font-semibold text-slate-700">
          <span>Projects ({selected.length} of {projects.length})</span>
          <button
            type="button"
            className="font-medium text-indigo-600 hover:underline"
            onClick={() => setSelected(selected.length === projects.length ? [] : projects.map((project) => project.id))}
          >
            {selected.length === projects.length ? "Clear all" : "Select all"}
          </button>
        </legend>
        <div className="grid max-h-40 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
          {projects.map((project) => (
            <label key={project.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selected.includes(project.id)}
                onChange={(e) =>
                  setSelected((prev) => (e.target.checked ? [...prev, project.id] : prev.filter((id) => id !== project.id)))
                }
              />
              <span className="truncate">{project.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold text-slate-700">Slide text</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            {
              key: "ai",
              title: "Written by Claude",
              text: aiReady
                ? "Claude writes the status, updates, risks, next steps and asks from live data."
                : canUseAi
                ? "Claude isn't connected on this server."
                : "Claude isn't part of your role.",
              disabled: !aiReady,
            },
            { key: "data", title: "From project data", text: "Built from tasks, milestones and the latest weekly reports." },
          ].map((option) => (
            <label
              key={option.key}
              className={cx(
                "flex gap-3 rounded-lg border p-3 text-sm transition",
                option.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                mode === option.key ? "border-indigo-400 bg-indigo-50/60 ring-1 ring-indigo-200" : "border-slate-200 hover:border-slate-300"
              )}
            >
              <input type="radio" name="deck-mode" checked={mode === option.key} disabled={option.disabled} onChange={() => setMode(option.key)} className="mt-0.5" />
              <span>
                <span className="block font-semibold text-slate-900">{option.title}</span>
                <span className="block text-xs text-slate-500">{option.text}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="text-xs text-slate-500">
        Slides: a title banner, project summary cards, then one slide per project with progress, timeline, updates,
        risks, next steps, milestones and decisions needed. No budget figures. Every item is editable text.
      </p>

      <div className="flex justify-end gap-2">
        <Button onClick={onClose} disabled={Boolean(busy)}>
          Cancel
        </Button>
        <Button type="submit" variant={mode === "ai" ? "ai" : "primary"} icon={busy ? Loader2 : mode === "ai" ? Sparkles : Presentation} disabled={Boolean(busy)} data-testid="deck-generate">
          {busy || "Download slides"}
        </Button>
      </div>
    </form>
  );
}

export default function PortfolioDeckButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon={Presentation} onClick={() => setOpen(true)} title="Create an editable PowerPoint for stakeholders" data-testid="portfolio-slides">
        Portfolio slides
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Portfolio slides" description="An editable PowerPoint for stakeholders." size="lg">
        {open ? <DeckForm onClose={() => setOpen(false)} /> : null}
      </Modal>
    </>
  );
}
