import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRightLeft,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardList,
  Copy,
  Flag,
  FolderPlus,
  ListChecks,
  MoreHorizontal,
  OctagonAlert,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  UserX,
  X,
} from "lucide-react";

import CentralizedManagerReportButton from "../components/CentralizedManagerReportButton";
import ProjectForm from "../components/projects/ProjectForm";
import AiInsightCard from "../components/ai/AiInsightCard";
import { usePlannerStore } from "../store/usePlannerStore";
import { useUiStore } from "../ui/uiStore";
import { confirmAction, notify } from "../ui/feedback";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Modal,
  PageHeader,
  ProgressBar,
  cx,
  inputClass,
} from "../ui/primitives";
import { HEALTH_TONE, computePortfolio, todayIso } from "../domain/analytics";
import { PROJECT_STATUSES } from "../domain/vocabulary";
import { buildSampleWorkspace } from "../data/sampleWorkspace";

const CHECKLIST_KEY = "pm-checklist-dismissed";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate(iso) {
  if (!iso) return "—";
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function StatTile({ label, value, sub, icon: Icon, tone = "slate", to }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
    indigo: "bg-indigo-100 text-indigo-700",
  };
  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={cx("flex h-8 w-8 items-center justify-center rounded-lg", tones[tone])}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-slate-500">{sub}</div> : null}
    </>
  );
  const className = "block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition";
  return to ? (
    <Link to={to} className={cx(className, "hover:border-slate-300 hover:shadow")}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function Onboarding() {
  const openNewProject = useUiStore((state) => state.openNewProject);
  const importPlannerData = usePlannerStore((state) => state.importPlannerData);
  const navigate = useNavigate();

  function loadSample() {
    importPlannerData(buildSampleWorkspace(), { mode: "merge" });
    notify.success("Sample projects loaded. Explore freely; you can delete them any time.");
  }

  const options = [
    {
      icon: FolderPlus,
      title: "Start from scratch",
      text: "Create a project and add tasks step by step.",
      action: <Button variant="primary" onClick={openNewProject}>Create a project</Button>,
    },
    {
      icon: ArrowRightLeft,
      title: "Bring your existing plan",
      text: "Excel, CSV, Jira, Asana, Trello, Monday or MS Project. Columns are matched automatically.",
      action: <Button onClick={() => navigate("/data")}>Import a file</Button>,
    },
    {
      icon: Sparkles,
      title: "Look around first",
      text: "Load two realistic sample projects to see every feature in action.",
      action: <Button onClick={loadSample} data-testid="load-sample">Load sample data</Button>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Welcome"
        title="Let's set up your first project"
        description="Pick whichever start suits you. Nothing here is permanent, and the Help & Guide page explains every screen."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {options.map((option) => (
          <Card key={option.title} className="flex flex-col p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <option.icon className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="mt-3 text-base font-semibold text-slate-900">{option.title}</h2>
            <p className="mt-1 flex-1 text-sm text-slate-500">{option.text}</p>
            <div className="mt-4">{option.action}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function GettingStarted({ projects, tasks }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(CHECKLIST_KEY) === "1";
    } catch {
      return false;
    }
  });

  const steps = [
    { label: "Create a project", done: projects.length > 0, to: null },
    { label: "Add at least 3 tasks", done: tasks.length >= 3, to: "/planner?tab=schedule" },
    { label: "Give tasks start and due dates", done: tasks.some((t) => t.plannedStart && t.plannedEnd), to: "/planner?tab=schedule" },
    { label: "Assign tasks to people", done: tasks.some((t) => t.owner), to: "/planner?tab=board" },
    { label: "Look at the timeline", done: false, to: "/planner?tab=timeline", optional: true },
  ];
  const required = steps.filter((step) => !step.optional);
  const doneCount = required.filter((step) => step.done).length;

  if (dismissed || doneCount === required.length) return null;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Getting started</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {doneCount} of {required.length} done. These steps get the most out of the planner.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(CHECKLIST_KEY, "1");
            } catch {
              // ignore blocked storage
            }
          }}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Hide getting started checklist"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {steps.map((step) => {
          const Icon = step.done ? CheckCircle2 : Circle;
          const body = (
            <span className="flex items-center gap-2">
              <Icon className={cx("h-4 w-4 shrink-0", step.done ? "text-emerald-600" : "text-slate-300")} aria-hidden />
              <span className={step.done ? "text-slate-400 line-through" : "text-slate-700"}>{step.label}</span>
            </span>
          );
          return (
            <li key={step.label} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
              {step.to && !step.done ? (
                <Link to={step.to} className="hover:underline">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const ATTENTION_META = {
  overdue: { icon: OctagonAlert, tone: "red", label: (item) => `${item.days} day${item.days === 1 ? "" : "s"} overdue` },
  blocked: { icon: AlertTriangle, tone: "amber", label: () => "Blocked" },
  unassigned: { icon: UserX, tone: "violet", label: () => "Due soon, no owner" },
};

function NeedsAttention({ items }) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader
        title="Needs attention"
        subtitle={items.length ? "Late, blocked or unowned work across all projects" : "Nothing urgent right now"}
        icon={AlertTriangle}
      />
      <ul className="mt-3 max-h-[340px] divide-y divide-slate-100 overflow-y-auto px-2 pb-2">
        {items.length === 0 ? (
          <li className="flex items-center gap-2 px-3 py-6 text-sm text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> All tasks are on schedule and have owners.
          </li>
        ) : (
          items.slice(0, 12).map((item) => {
            const meta = ATTENTION_META[item.kind];
            return (
              <li key={`${item.kind}-${item.task.id}`}>
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/planner?projectId=${encodeURIComponent(item.task.projectId)}&tab=schedule&taskId=${encodeURIComponent(item.task.id)}`
                    )
                  }
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-50"
                >
                  <meta.icon
                    className={cx(
                      "h-4 w-4 shrink-0",
                      meta.tone === "red" ? "text-red-600" : meta.tone === "amber" ? "text-amber-600" : "text-violet-600"
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{item.task.title}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {item.projectName}
                      {item.task.owner ? ` · ${item.task.owner}` : ""}
                    </span>
                  </span>
                  <Badge tone={meta.tone}>{meta.label(item)}</Badge>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </Card>
  );
}

function ProjectCard({ project, metrics, onEdit }) {
  const deleteProject = usePlannerStore((state) => state.deleteProject);
  const duplicateProject = usePlannerStore((state) => state.duplicateProject);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleDelete() {
    setMenuOpen(false);
    const ok = await confirmAction({
      title: `Delete "${project.name}"?`,
      message: `This removes the project and its ${metrics.total + metrics.summaryRows} tasks, sprints, reports and documents. This cannot be undone.`,
      confirmLabel: "Delete project",
    });
    if (ok) {
      deleteProject(project.id);
      notify.success(`"${project.name}" deleted.`);
    }
  }

  const tone = HEALTH_TONE[metrics.health.level];
  const href = `/planner?projectId=${encodeURIComponent(project.id)}&tab=overview`;

  return (
    <Card className="relative flex flex-col p-5 transition hover:shadow-md" data-testid="project-card">
      <div className="flex items-start justify-between gap-3">
        <Link to={href} className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-slate-900 hover:text-indigo-700">{project.name}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
            {project.description || "No description yet."}
          </p>
        </Link>
        <div className="relative flex items-center gap-1">
          <Badge tone={tone}>{metrics.health.label}</Badge>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label={`More actions for ${project.name}`}
            aria-expanded={menuOpen}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
              <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                <button type="button" onClick={() => { setMenuOpen(false); onEdit(project); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <Pencil className="h-4 w-4" /> Edit details
                </button>
                <button type="button" onClick={() => { setMenuOpen(false); duplicateProject(project.id); notify.success(`Copied "${project.name}".`); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <Copy className="h-4 w-4" /> Duplicate
                </button>
                <button type="button" onClick={handleDelete} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-700 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>{metrics.percentComplete}% complete</span>
          <span>{metrics.percentPlanned}% planned by today</span>
        </div>
        <ProgressBar
          value={metrics.percentComplete}
          tone={tone === "red" ? "red" : tone === "amber" ? "amber" : tone === "green" ? "green" : "indigo"}
          label={`${project.name} progress`}
        />
      </div>

      <dl className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
        {[
          ["Tasks", metrics.total],
          ["Active", metrics.inProgress],
          ["Late", metrics.overdue],
          ["Blocked", metrics.blocked],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-50 py-2">
            <dd className={cx("font-semibold", (label === "Late" || label === "Blocked") && value ? "text-red-600" : "text-slate-900")}>{value}</dd>
            <dt className="text-slate-500">{label}</dt>
          </div>
        ))}
      </dl>

      <div className="mt-4 space-y-1.5 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          Target {formatDate(project.targetEndDate)}
          {metrics.slipDays > 0 ? <Badge tone="red">forecast +{metrics.slipDays}d</Badge> : null}
        </div>
        {metrics.nextMilestone ? (
          <div className="flex items-center gap-2">
            <Flag className="h-3.5 w-3.5 text-violet-500" aria-hidden />
            <span className="truncate">
              Next milestone: {metrics.nextMilestone.title} ({formatDate(metrics.nextMilestone.date)})
            </span>
          </div>
        ) : null}
        <div className="text-slate-400">
          {project.owner ? `Owner: ${project.owner} · ` : ""}
          {project.status}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Link
          to={href}
          className="inline-flex flex-1 items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Open
        </Link>
        <Link
          to={`/planner?projectId=${encodeURIComponent(project.id)}&tab=timeline`}
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Timeline
        </Link>
      </div>
    </Card>
  );
}

export default function PortfolioPage() {
  const projects = usePlannerStore((state) => state.projects);
  const tasks = usePlannerStore((state) => state.tasks);
  const updateProject = usePlannerStore((state) => state.updateProject);
  const openNewProject = useUiStore((state) => state.openNewProject);
  const navigate = useNavigate();

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("health");
  const [editing, setEditing] = useState(null);

  const today = todayIso();
  const portfolio = useMemo(() => computePortfolio(projects, tasks, today), [projects, tasks, today]);

  const visible = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const healthRank = { off: 0, risk: 1, good: 2, empty: 3, done: 4 };
    const list = portfolio.perProject.filter(({ project }) => {
      const matchesSearch =
        !query ||
        [project.name, project.owner, project.description].some((value) =>
          String(value || "").toLowerCase().includes(query)
        );
      return matchesSearch && (statusFilter === "All" || project.status === statusFilter);
    });

    const sorters = {
      health: (a, b) => healthRank[a.metrics.health.level] - healthRank[b.metrics.health.level],
      name: (a, b) => a.project.name.localeCompare(b.project.name),
      end: (a, b) => String(a.project.targetEndDate || "9999").localeCompare(String(b.project.targetEndDate || "9999")),
      updated: (a, b) => String(b.project.updatedAt || "").localeCompare(String(a.project.updatedAt || "")),
    };
    return [...list].sort(sorters[sortBy]);
  }, [portfolio, searchText, statusFilter, sortBy]);

  if (projects.length === 0) {
    return <Onboarding />;
  }

  const { healthCounts } = portfolio;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        title={`${greeting()}`}
        description={`${portfolio.activeProjects} active project${portfolio.activeProjects === 1 ? "" : "s"} · ${healthCounts.good} on track · ${healthCounts.risk} at risk · ${healthCounts.off} off track`}
        actions={
          <>
            <CentralizedManagerReportButton />
            <Button icon={Sparkles} variant="ai" onClick={() => navigate("/assistant")}>
              Ask Claude
            </Button>
            <Button icon={FolderPlus} variant="primary" onClick={openNewProject}>
              New project
            </Button>
          </>
        }
      />

      <GettingStarted projects={projects} tasks={tasks} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <StatTile label="Projects" value={portfolio.projectCount} sub={`${portfolio.activeProjects} active`} icon={BriefcaseBusiness} tone="indigo" />
        <StatTile label="Tasks done" value={`${portfolio.percentDone}%`} sub={`${portfolio.done} of ${portfolio.totalTasks}`} icon={ListChecks} tone="green" />
        <StatTile label="Overdue" value={portfolio.overdue} sub="Past their due date" icon={OctagonAlert} tone={portfolio.overdue ? "red" : "slate"} />
        <StatTile label="Blocked" value={portfolio.blocked} sub="Waiting on something" icon={AlertTriangle} tone={portfolio.blocked ? "amber" : "slate"} to="/planner?tab=board" />
        <StatTile label="Due in 7 days" value={portfolio.dueSoon} sub={`${portfolio.unassigned} open tasks unassigned`} icon={ClipboardList} tone="slate" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <NeedsAttention items={portfolio.attention} />
        <AiInsightCard scope="portfolio" />
      </div>

      <section aria-labelledby="projects-heading" className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 id="projects-heading" className="text-base font-semibold text-slate-900">
            Projects <span className="text-sm font-normal text-slate-500">({visible.length} of {projects.length})</span>
          </h2>
          <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_auto_auto]">
            <label className="relative">
              <span className="sr-only">Search projects</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search projects..."
                className={cx(inputClass, "pl-9")}
              />
            </label>
            <label>
              <span className="sr-only">Filter by status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}>
                <option value="All">All statuses</option>
                {PROJECT_STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Sort projects</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className={inputClass}>
                <option value="health">Sort: needs attention first</option>
                <option value="end">Sort: target date</option>
                <option value="name">Sort: name</option>
                <option value="updated">Sort: recently updated</option>
              </select>
            </label>
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No projects match"
            description="Try a different search or status filter."
          >
            <Button onClick={() => { setSearchText(""); setStatusFilter("All"); }}>Clear filters</Button>
          </EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {visible.map(({ project, metrics }) => (
              <ProjectCard key={project.id} project={project} metrics={metrics} onEdit={setEditing} />
            ))}
          </div>
        )}
      </section>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit project">
        {editing ? (
          <ProjectForm
            initialValue={editing}
            submitLabel="Save changes"
            onCancel={() => setEditing(null)}
            onSubmit={(values) => {
              updateProject(editing.id, values);
              setEditing(null);
              notify.success("Project updated.");
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}
