import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  ThumbsUp,
} from "lucide-react";

import { usePlannerStore } from "../../store/usePlannerStore";
import { buildPortfolioDigest, buildProjectDigest } from "../../domain/aiContext";
import { Badge, Button, Card, cx } from "../../ui/primitives";
import { describeUsage, useAiJob } from "./useAiJob";
import { getAiStatus } from "../../services/aiService";

const VERDICT = {
  on_track: { label: "On track", tone: "green" },
  at_risk: { label: "At risk", tone: "amber" },
  off_track: { label: "Off track", tone: "red" },
  not_enough_data: { label: "Not enough data", tone: "slate" },
};

const WHEN = { today: "Today", this_week: "This week", next_week: "Next week" };

/** Explains why Claude is unavailable: no server, or no API key on it. */
export function AiNotConfigured({ compact = false }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let alive = true;
    getAiStatus().then((value) => {
      if (alive) setStatus(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  const serverMissing = status && !status.reachable;

  return (
    <div
      className={cx("rounded-xl bg-slate-50 text-sm text-slate-600", compact ? "p-3" : "p-4")}
      data-testid="ai-not-configured"
    >
      <p className="font-medium text-slate-800">Claude isn't connected yet.</p>
      <p className="mt-1">
        {serverMissing ? (
          <>
            The Claude server isn't running. Locally, start the app with{" "}
            <code className="rounded bg-slate-200 px-1">npm run dev</code>, which starts it too.
          </>
        ) : (
          <>
            The server is running but has no Anthropic API key. Add{" "}
            <code className="rounded bg-slate-200 px-1">ANTHROPIC_API_KEY</code> to the{" "}
            <code className="rounded bg-slate-200 px-1">.env</code> file and restart.
          </>
        )}{" "}
        <Link to="/help#claude" className="font-semibold text-indigo-600 hover:underline">
          How to enable it
        </Link>
      </p>
    </div>
  );
}

export function AiInsightsView({ result }) {
  const verdict = VERDICT[result.verdict] || VERDICT.not_enough_data;
  return (
    <div className="space-y-4" data-testid="ai-insights">
      <div>
        <Badge tone={verdict.tone}>{verdict.label}</Badge>
        <p className="mt-2 text-base font-semibold text-slate-900">{result.headline}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{result.summary}</p>
      </div>

      {result.risks?.length ? (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Risks
          </h4>
          <ul className="space-y-2">
            {result.risks.map((risk, index) => (
              <li key={index} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={risk.severity === "high" ? "red" : risk.severity === "medium" ? "amber" : "slate"}>
                    {risk.severity}
                  </Badge>
                  <span className="text-sm font-medium text-slate-900">{risk.title}</span>
                  {risk.project ? <span className="text-xs text-slate-500">· {risk.project}</span> : null}
                </div>
                <p className="mt-1 text-sm text-slate-600">{risk.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.recommendations?.length ? (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Lightbulb className="h-3.5 w-3.5" aria-hidden /> Recommended actions
          </h4>
          <ol className="space-y-2">
            {result.recommendations.map((item, index) => (
              <li key={index} className="flex gap-3 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">
                  {index + 1}
                </span>
                <span>
                  <span className="font-medium text-slate-900">{item.action}</span>{" "}
                  <span className="text-xs font-semibold text-indigo-600">{WHEN[item.when] || ""}</span>
                  <span className="block text-slate-500">{item.reason}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {result.positives?.length ? (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <ThumbsUp className="h-3.5 w-3.5" aria-hidden /> Going well
          </h4>
          <ul className="space-y-1 text-sm text-slate-600">
            {result.positives.map((item, index) => (
              <li key={index} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** "Claude briefing" card for the whole portfolio or one project. */
export default function AiInsightCard({ scope = "portfolio", projectId = "" }) {
  const projects = usePlannerStore((state) => state.projects);
  const tasks = usePlannerStore((state) => state.tasks);
  const sprints = usePlannerStore((state) => state.sprints);

  const project = scope === "project" ? projects.find((item) => item.id === projectId) : null;
  const task = scope === "project" ? "project_insights" : "portfolio_insights";

  const input = useMemo(() => {
    if (scope === "project") {
      return project ? buildProjectDigest(project, tasks, sprints) : null;
    }
    return projects.length ? buildPortfolioDigest(projects, tasks) : null;
  }, [scope, project, projects, tasks, sprints]);

  const { status, response, error, run, aiStatus } = useAiJob(task, input);
  const notConfigured = aiStatus && !aiStatus.configured;

  return (
    <Card className="flex flex-col overflow-hidden" data-testid="ai-insight-card">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-indigo-50 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm">
            <Sparkles className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Claude briefing{project ? `: ${project.name}` : ""}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Risks, verdict and next actions, written from your live data.
            </p>
          </div>
        </div>
        {response ? (
          <Button
            size="sm"
            variant="ghost"
            icon={status === "loading" ? Loader2 : RefreshCw}
            onClick={() => run({ force: true })}
            disabled={status === "loading"}
            aria-label="Refresh briefing"
          >
            Refresh
          </Button>
        ) : null}
      </div>

      <div className="flex-1 px-5 py-4">
        {notConfigured ? (
          <AiNotConfigured />
        ) : status === "loading" && !response ? (
          <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Claude is reviewing your data...
          </div>
        ) : response ? (
          <AiInsightsView result={response.result} />
        ) : (
          <div className="flex flex-col items-start gap-3 py-2">
            <p className="text-sm text-slate-600">
              Get a short, plain-English assessment of{" "}
              {project ? "this project" : "all your projects"}: what's at risk, why, and what to do
              next. Only a compact summary of your data is sent.
            </p>
            <Button
              variant="ai"
              icon={Sparkles}
              onClick={() => run()}
              disabled={!input || status === "loading"}
              data-testid="ai-briefing-run"
            >
              Get Claude's briefing
            </Button>
          </div>
        )}

        {error ? (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {error.message}
          </p>
        ) : null}
      </div>

      {response ? (
        <div className="border-t border-slate-100 px-5 py-2 text-[11px] text-slate-400">
          {describeUsage(response)} · {new Date(response.cachedAt).toLocaleString()}
        </div>
      ) : null}
    </Card>
  );
}
