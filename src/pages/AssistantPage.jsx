import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Bot,
  Gauge,
  ListTree,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  User,
  Wand2,
} from "lucide-react";

import AiInsightCard, { AiNotConfigured } from "../components/ai/AiInsightCard";
import { describeUsage } from "../components/ai/useAiJob";
import { usePlannerStore } from "../store/usePlannerStore";
import { useAccess } from "../store/useAccessStore";
import { buildAskInput } from "../domain/aiContext";
import { buildPlanTasks } from "../domain/planBuilder";
import { todayIso } from "../domain/analytics";
import { getAiStatus, getUsageThisMonth, runAi } from "../services/aiService";
import { notify } from "../ui/feedback";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  PageHeader,
  cx,
  inputClass,
} from "../ui/primitives";
import { useUiStore } from "../ui/uiStore";

const SUGGESTIONS = [
  "What are the biggest risks this week?",
  "Who is overloaded, and what could be reassigned?",
  "Summarise progress in three sentences for my manager.",
  "Which milestones are likely to slip?",
];

/** Renders Claude's plain-text answer: paragraphs and "- " bullets. */
function AnswerText({ text }) {
  const blocks = String(text || "").split(/\n{2,}/);
  return (
    <div className="space-y-2 text-sm leading-6 text-slate-700">
      {blocks.map((block, index) => {
        const lines = block.split("\n").filter(Boolean);
        if (lines.length && lines.every((line) => /^\s*[-*•]\s+/.test(line))) {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {lines.map((line, i) => (
                <li key={i}>{line.replace(/^\s*[-*•]\s+/, "").replace(/\*\*/g, "")}</li>
              ))}
            </ul>
          );
        }
        return <p key={index}>{block.replace(/\*\*/g, "")}</p>;
      })}
    </div>
  );
}

function AskClaude({ projectId, disabled }) {
  const projects = usePlannerStore((state) => state.projects);
  const tasks = usePlannerStore((state) => state.tasks);
  const sprints = usePlannerStore((state) => state.sprints);
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [thread.length]);

  async function ask(text) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setQuestion("");
    setThread((prev) => [...prev, { role: "user", text: trimmed }]);
    setLoading(true);
    try {
      const response = await runAi("ask", buildAskInput(trimmed, { projects, tasks, sprints, projectId }));
      setThread((prev) => [...prev, { role: "assistant", text: response.result, meta: describeUsage(response) }]);
    } catch (error) {
      setThread((prev) => [...prev, { role: "error", text: error.message }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex h-[560px] flex-col overflow-hidden xl:h-full">
      <CardHeader
        icon={MessageSquare}
        title="Ask about your projects"
        subtitle="Claude answers from a compact summary of your current data. Each question is answered on its own."
      />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
        {thread.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-500">Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={disabled}
                  onClick={() => ask(suggestion)}
                  className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          thread.map((message, index) => (
            <div key={index} className={cx("flex gap-3", message.role === "user" ? "justify-end" : "")}>
              {message.role !== "user" ? (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                  <Bot className="h-4 w-4" aria-hidden />
                </div>
              ) : null}
              <div
                className={cx(
                  "max-w-[85%] rounded-xl px-4 py-2.5",
                  message.role === "user"
                    ? "bg-slate-900 text-sm text-white"
                    : message.role === "error"
                    ? "bg-red-50 text-sm text-red-700"
                    : "bg-slate-50"
                )}
              >
                {message.role === "assistant" ? <AnswerText text={message.text} /> : message.text}
                {message.meta ? <div className="mt-1 text-[11px] text-slate-400">{message.meta}</div> : null}
              </div>
              {message.role === "user" ? (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                  <User className="h-4 w-4" aria-hidden />
                </div>
              ) : null}
            </div>
          ))
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Claude is thinking...
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
      <form
        className="flex shrink-0 gap-2 border-t border-slate-100 bg-white p-3"
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
      >
        <label className="sr-only" htmlFor="ask-input">
          Your question
        </label>
        <input
          id="ask-input"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={disabled ? "Claude is not connected" : "Ask anything about your projects..."}
          className={inputClass}
          maxLength={600}
          disabled={disabled}
        />
        <Button type="submit" variant="ai" icon={Send} disabled={disabled || loading || !question.trim()}>
          Ask
        </Button>
      </form>
    </Card>
  );
}

function PlanGenerator({ disabled, defaultProjectId, canCreateProject }) {
  const projects = usePlannerStore((state) => state.projects);
  const addProject = usePlannerStore((state) => state.addProject);
  const addTasks = usePlannerStore((state) => state.addTasks);
  const navigate = useNavigate();

  const [target, setTarget] = useState(defaultProjectId || (canCreateProject ? "new" : projects[0]?.id || ""));
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  async function generate() {
    setError("");
    if (brief.trim().length < 20) {
      setError("Describe the project in at least a sentence or two (goal, scope, team, deadline).");
      return;
    }
    setLoading(true);
    try {
      const existing = projects.find((project) => project.id === target);
      const response = await runAi("generate_plan", {
        projectName: existing?.name || name.trim() || "New project",
        brief: brief.trim().slice(0, 2000),
        startDate,
      });
      setPreview({ tasks: response.result.tasks || [], meta: describeUsage(response) });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function apply() {
    let projectId = target;
    if (target === "new") {
      const project = addProject({
        name: name.trim() || "New project",
        description: brief.trim().slice(0, 500),
        startDate,
        status: "Planned",
      });
      projectId = project.id;
    }
    const plan = buildPlanTasks(preview.tasks, { projectId, startDate });
    addTasks(plan);
    if (target === "new") {
      const ends = plan.map((task) => task.plannedEnd).filter(Boolean).sort();
      usePlannerStore.getState().updateProject(projectId, { targetEndDate: ends[ends.length - 1] || "" });
    }
    notify.success(`Added ${plan.length} tasks. Review owners and dates in the schedule.`);
    setPreview(null);
    navigate(`/planner?projectId=${encodeURIComponent(projectId)}&tab=schedule`);
  }

  const phases = preview
    ? preview.tasks.reduce((acc, task) => {
        (acc[task.phase] = acc[task.phase] || []).push(task);
        return acc;
      }, {})
    : null;

  return (
    <Card>
      <CardHeader
        icon={Wand2}
        title="Draft a plan with Claude"
        subtitle="Describe the project; Claude proposes phases, tasks, durations, dependencies and milestones. You review before anything is added."
      />
      <div className="space-y-4 px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Add the plan to" htmlFor="plan-target">
            <select id="plan-target" value={target} onChange={(event) => setTarget(event.target.value)} className={inputClass}>
              {canCreateProject ? <option value="new">A new project</option> : null}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Start date" htmlFor="plan-start">
            <input id="plan-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClass} />
          </Field>
          {target === "new" ? (
            <Field label="Project name" htmlFor="plan-name">
              <input id="plan-name" value={name} onChange={(event) => setName(event.target.value)} className={inputClass} placeholder="e.g. Mobile app v2" />
            </Field>
          ) : null}
        </div>
        <Field label="Project brief" htmlFor="plan-brief" hint="Goal, scope, team size, constraints and deadline. The more specific, the better the plan.">
          <textarea
            id="plan-brief"
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            className={cx(inputClass, "min-h-[110px]")}
            maxLength={2000}
            placeholder="e.g. Launch a customer feedback portal for our SaaS product. Team of 2 developers and 1 designer. Needs SSO, a feedback board with voting, and admin moderation. Must go live before the end of next quarter."
          />
        </Field>
        {error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {disabled ? <AiNotConfigured compact /> : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="ai" icon={loading ? Loader2 : Sparkles} onClick={generate} disabled={disabled || loading}>
            {loading ? "Drafting plan..." : preview ? "Regenerate" : "Draft plan"}
          </Button>
        </div>

        {preview ? (
          <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/40 p-4" data-testid="plan-preview">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">
                Proposed plan: {preview.tasks.length} tasks in {Object.keys(phases).length} phases
              </div>
              <span className="text-[11px] text-slate-400">{preview.meta}</span>
            </div>
            <div className="max-h-80 space-y-3 overflow-y-auto">
              {Object.entries(phases).map(([phase, items]) => (
                <div key={phase}>
                  <div className="text-xs font-semibold text-slate-500">{phase}</div>
                  <ul className="mt-1 space-y-1">
                    {items.map((task) => (
                      <li key={task.key} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-1.5 text-sm">
                        <span className="truncate">
                          {task.isMilestone ? "◆ " : ""}
                          {task.title}
                        </span>
                        <span className="shrink-0 text-xs text-slate-500">
                          {task.isMilestone ? "milestone" : `${task.durationDays}d`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" icon={ListTree} onClick={apply} data-testid="plan-apply">
                Add these tasks
              </Button>
              <Button onClick={() => setPreview(null)}>Discard</Button>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function UsagePanel() {
  const [usage] = useState(() => getUsageThisMonth());
  const total = usage.inputTokens + usage.outputTokens + usage.cacheReadTokens;
  return (
    <Card>
      <CardHeader icon={Gauge} title="Your Claude usage this month" subtitle="Counted in this browser." />
      <dl className="grid grid-cols-3 gap-2 px-5 py-4 text-center">
        <div className="rounded-xl bg-slate-50 py-3">
          <dd className="text-lg font-semibold text-slate-900">{usage.requests}</dd>
          <dt className="text-xs text-slate-500">Requests</dt>
        </div>
        <div className="rounded-xl bg-slate-50 py-3">
          <dd className="text-lg font-semibold text-slate-900">{total.toLocaleString()}</dd>
          <dt className="text-xs text-slate-500">Tokens</dt>
        </div>
        <div className="rounded-xl bg-slate-50 py-3">
          <dd className="text-lg font-semibold text-slate-900">{usage.cacheReadTokens.toLocaleString()}</dd>
          <dt className="text-xs text-slate-500">From cache</dt>
        </div>
      </dl>
      <div className="px-5 pb-4 text-xs leading-5 text-slate-500">
        To keep costs low, Claude only runs when you ask, receives a compact summary instead of
        your full workspace, and repeated questions about unchanged data are answered from a saved
        copy for free.
      </div>
    </Card>
  );
}

export default function AssistantPage() {
  const { permissions } = useAccess();
  const projects = usePlannerStore((state) => state.projects);
  const openNewProject = useUiStore((state) => state.openNewProject);
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get("projectId") || "";
  const [aiStatus, setAiStatus] = useState(null);

  useEffect(() => {
    getAiStatus().then(setAiStatus);
  }, []);

  const validProjectId = useMemo(
    () => (projects.some((project) => project.id === projectId) ? projectId : ""),
    [projects, projectId]
  );
  const notConfigured = aiStatus && !aiStatus.configured;

  if (!permissions["ai.use"]) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Claude isn't part of your role"
        description="Ask your administrator if you need AI briefings, answers or plan drafts."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI assistant"
        title="Ask Claude"
        description="Claude reads a summary of your projects to spot risks, answer questions, draft plans and write status reports."
        actions={
          <label className="flex items-center gap-2 text-sm">
            <span className="whitespace-nowrap text-slate-500">Focus on</span>
            <select
              value={validProjectId}
              onChange={(event) => {
                const next = new URLSearchParams(searchParams);
                if (event.target.value) next.set("projectId", event.target.value);
                else next.delete("projectId");
                setSearchParams(next, { replace: true });
              }}
              className={cx(inputClass, "w-56")}
            >
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {aiStatus?.configured ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Badge tone="violet">
            <Sparkles className="h-3 w-3" /> Connected
          </Badge>
          Model {aiStatus.model}, effort {aiStatus.effort}
        </div>
      ) : null}

      {projects.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Claude needs something to look at"
          description="Create or import a project first. Or skip ahead and let Claude draft a plan for you below."
        >
          <Button variant="primary" onClick={openNewProject}>Create a project</Button>
        </EmptyState>
      ) : (
        <div className="grid gap-6 xl:h-[calc(100vh-16rem)] xl:min-h-[480px] xl:grid-cols-2 xl:grid-rows-[minmax(0,1fr)]">
          <AiInsightCard
            key={validProjectId || "portfolio"}
            scope={validProjectId ? "project" : "portfolio"}
            projectId={validProjectId}
            className="max-h-[640px] xl:h-full xl:max-h-none"
          />
          <AskClaude projectId={validProjectId} disabled={notConfigured} />
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[2fr_1fr]">
        {permissions["tasks.create"] ? (
          <PlanGenerator disabled={notConfigured} defaultProjectId={validProjectId} canCreateProject={permissions["projects.create"]} />
        ) : null}
        <UsagePanel />
      </div>
    </div>
  );
}
