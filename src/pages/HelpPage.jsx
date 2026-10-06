import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRightLeft,
  BookOpen,
  ClipboardList,
  Keyboard,
  LayoutDashboard,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Card, CardHeader, PageHeader } from "../ui/primitives";

const STEPS = [
  { title: "Create a project", text: 'Click "New project" in the sidebar. Only a name is needed.' },
  { title: "Add tasks", text: 'Use "Add task" in the Planner for a simple form, or the Schedule tab to edit many tasks like a spreadsheet.' },
  { title: "Give tasks dates and owners", text: "Dates put tasks on the Timeline; owners show up in workload and reports." },
  { title: "Track progress", text: "Move cards on the Board, or update status and % complete in the Schedule." },
  { title: "Review and report", text: "The Dashboard shows what is late or blocked. Ask Claude for a briefing or to draft the weekly report." },
];

const GLOSSARY = [
  ["Milestone", "A key date such as a sign-off or launch. Shown as ◆. It has no duration."],
  ["Subtask / summary task", "Tasks can sit under a parent. The parent's dates and progress roll up from its subtasks."],
  ["Dependency (Pred)", 'A task that must finish before another can start. In the Schedule, type the row or WBS number of the earlier task, e.g. "3" or "1.2".'],
  ["WBS", "Work breakdown structure number, e.g. 2.1 is the first subtask of task 2."],
  ["Dur", "Duration in days. Changing it moves the finish date."],
  ["Lock", "A locked task keeps its dates when you press Recalc; unlocked tasks are re-dated from their dependencies."],
  ["Recalc", "Re-dates tasks from durations and dependencies, like Microsoft Project."],
  ["Overdue", "Not done and the due date has passed."],
  ["Schedule index", "Work done divided by work that should be done by today. 1.0 is on plan, below 0.9 is behind."],
  ["Health", "On track, At risk or Off track, worked out from overdue work, blocked tasks, schedule index and forecast slip."],
  ["Forecast finish", "When the project will likely end if late tasks finish from today."],
  ["Baseline", "A saved snapshot of the plan, used later to see how dates moved."],
  ["Sprint", "A fixed period (often two weeks) with a goal. Assign tasks to sprints in the Schedule."],
];

const SHORTCUTS = [
  ["Ctrl + K  or  /", "Search projects and tasks, or jump to any page"],
  ["Enter", "Save the cell you are editing in the Schedule"],
  ["Ctrl + Z", "Undo the last change in the Schedule"],
  ["Esc", "Close a dialog or the search box"],
];

export default function HelpPage() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "start" });
    }
  }, [location.hash]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Help & Guide"
        title="How to use Project Planner"
        description="Everything in plain language. You can't break anything by exploring; most actions can be undone or edited."
      />

      <Card>
        <CardHeader icon={BookOpen} title="Get going in five steps" />
        <ol className="grid gap-3 px-5 py-4 md:grid-cols-5">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-xl bg-slate-50 p-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">{index + 1}</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{step.title}</div>
              <p className="mt-1 text-xs leading-5 text-slate-600">{step.text}</p>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={LayoutDashboard} title="The main areas" />
          <dl className="space-y-3 px-5 py-4 text-sm">
            <div>
              <dt className="font-semibold text-slate-900"><Link className="hover:underline" to="/">Dashboard</Link></dt>
              <dd className="text-slate-600">Every project's health, what needs attention today, and a Claude briefing.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900"><Link className="hover:underline" to="/planner">Planner</Link></dt>
              <dd className="text-slate-600">
                Pick a project at the top, then switch views: Overview, Schedule (spreadsheet), Board
                (Kanban), Timeline (Gantt), Sprints, People, Documents and Reports.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900"><Link className="hover:underline" to="/assistant">Ask Claude</Link></dt>
              <dd className="text-slate-600">Risk briefings, questions about your data, and plan drafting.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900"><Link className="hover:underline" to="/data">Import &amp; Export</Link></dt>
              <dd className="text-slate-600">Bring plans in from other tools, back up, or export to Excel, CSV, MS Project or your calendar.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900"><Link className="hover:underline" to="/timesheet">Timesheet</Link></dt>
              <dd className="text-slate-600">Clock in and out, time your work on assigned tasks, submit and approve weekly time.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900"><a className="hover:underline" href="#team">Admin</a></dt>
              <dd className="text-slate-600">For administrators: people, roles and permissions, workspace rules and the activity log.</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader icon={Keyboard} title="Keyboard shortcuts" />
          <dl className="space-y-2 px-5 py-4 text-sm">
            {SHORTCUTS.map(([keys, text]) => (
              <div key={keys} className="flex items-center justify-between gap-3">
                <dt>
                  <kbd className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">{keys}</kbd>
                </dt>
                <dd className="text-right text-slate-600">{text}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card>
        <CardHeader icon={ClipboardList} title="Words you'll see" subtitle="Especially in the Schedule tab" />
        <dl className="grid gap-x-8 gap-y-3 px-5 py-4 text-sm md:grid-cols-2">
          {GLOSSARY.map(([term, text]) => (
            <div key={term}>
              <dt className="font-semibold text-slate-900">{term}</dt>
              <dd className="text-slate-600">{text}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card id="import">
          <CardHeader icon={ArrowRightLeft} title="Importing from other tools" />
          <ul className="list-disc space-y-2 py-4 pl-10 pr-5 text-sm text-slate-600">
            <li><strong>Excel, Google Sheets, Smartsheet, Monday, ClickUp:</strong> export to .xlsx or .csv and drop it in. Columns like "Task", "Assignee", "Due date" or "% complete" are recognised automatically.</li>
            <li><strong>Jira:</strong> export issues as CSV, or use the JSON from the Jira API. Epics become parent tasks.</li>
            <li><strong>Asana:</strong> export the project as CSV or JSON. Sections become sprints.</li>
            <li><strong>Trello:</strong> board menu → Print, export and share → Export as JSON. Lists become statuses; checklists become subtasks.</li>
            <li><strong>Microsoft Project:</strong> drop in the .mpp file (or .xml, .mpx). Primavera P6 (.xer), GanttProject (.gan), ProjectLibre (.pod) and Asta (.pp) files work too. Binary files are converted by the backend, which starts with <code className="rounded bg-slate-100 px-1">npm run dev</code> and needs Java.</li>
            <li>Dates in any common format are understood; for dates like 03/04/2025 you can choose day-first or month-first.</li>
          </ul>
        </Card>

        <Card id="team">
          <CardHeader icon={ShieldCheck} title="Team, roles and timesheets" />
          <div className="space-y-3 px-5 py-4 text-sm text-slate-600">
            <p>
              <strong>Admin</strong> is where administrators add people by email, pick their role
              (Administrator, Project manager, Team member or Viewer), choose which projects they can
              see, and set exceptions for one person. <em>Roles &amp; permissions</em> decides what each
              role can do; <em>Rules</em> sets workspace policies such as timesheet approval, the daily
              hour limit and allowed email domains. Every change is in the <em>Activity log</em>.
            </p>
            <p>
              Use <strong>Preview</strong> next to a person to see the app exactly as they would. Tasks
              are linked to people by the task's owner, so use the same name in both places.
            </p>
            <p>
              <strong>Timesheet</strong>: clock in and out for attendance, start the timer on the task
              you're working on (times come from the server, not your computer), add time manually if
              your administrator allows it, and submit the week. Managers approve or send time back
              under <em>Approvals</em>; <em>Team hours</em> shows everyone's week.
            </p>
            <p>
              With Supabase connected, the first person to sign in becomes the administrator and
              nobody else gets in until they are added. Without Supabase everything stays in this
              browser, and people you add can be previewed but can't sign in.
            </p>
          </div>
        </Card>

        <Card id="claude">
          <CardHeader icon={Sparkles} title="About Claude" />
          <div className="space-y-3 px-5 py-4 text-sm text-slate-600">
            <p>
              Claude only runs when you click a Claude button. It receives a compact summary of the
              relevant projects (names, dates, counts and the most important tasks), not your whole
              workspace, and repeated questions about unchanged data are answered from a saved copy.
            </p>
            <p className="font-semibold text-slate-900">Enabling Claude (administrators)</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Create an API key in the Anthropic Console.</li>
              <li>In your hosting provider (e.g. Netlify → Site configuration → Environment variables) add <code className="rounded bg-slate-100 px-1">ANTHROPIC_API_KEY</code>.</li>
              <li>Optional: <code className="rounded bg-slate-100 px-1">AI_MODEL</code>, <code className="rounded bg-slate-100 px-1">AI_EFFORT</code> and the rate limits described in the README.</li>
              <li>Redeploy. The key stays on the server and is never sent to browsers.</li>
            </ol>
          </div>
        </Card>
      </div>
    </div>
  );
}
