# Project Planner

A project management tool for planning, tracking and reporting on any number
of projects, with Claude built in for risk analysis, Q&A, plan drafting and
status reports.

- **Dashboard**: health of every project (on track / at risk / off track), a
  "needs attention" list of late, blocked and unowned work, KPIs, and a Claude
  briefing.
- **Planner** per project:
  - **Overview**: progress against plan, forecast finish, milestones and workload.
  - **Schedule**: a spreadsheet-style grid with subtasks, dependencies,
    milestones, locking, undo and MS Project-style recalculation.
  - **Board**: drag-and-drop Kanban.
  - **Timeline**: Gantt chart; drag bars to move or resize tasks.
  - **Sprints**, **People** (workload and task relationships) and **Documents**.
  - **Reports**: weekly status reports with PowerPoint export, baselines and
    dependency analysis.
- **Import from almost anything**: Excel, CSV/TSV, ODS, Google Sheets, Jira,
  Asana, Trello, Monday, ClickUp, Smartsheet, MS Project (`.mpp`, `.xml`,
  `.mpx`), Primavera P6 (`.xer`), GanttProject, ProjectLibre and Asta.
  Columns, date formats, statuses and priorities are matched automatically,
  with a review step before anything is imported.
- **Export** to a JSON backup, Excel, CSV, MS Project XML and calendar (.ics);
  plus a portfolio PowerPoint.
- **Ask Claude**: briefings, questions about your data, AI-drafted project
  plans, weekly report drafts and column matching for imports.
- **Works with or without an account**: Supabase sign-in syncs data to the
  cloud; local mode keeps everything in the browser.
- Search everything with **Ctrl+K**. The **Help & Guide** page explains every
  screen in plain language.

## Quick start

Requires Node.js 22+.

```bash
npm install
npm run dev            # http://localhost:5173
```

`npm run dev` starts the web app and the backend together (the backend
serves Claude and the `.mpp` converter; Ctrl+C stops both). Use
`npm run dev:web` for the web app alone.

With no `.env`, the app runs in **local mode**: no sign-in, data in the
browser. Click **Load sample data** on the first screen to explore.

### Testing Claude locally

1. Create an API key at console.anthropic.com → API Keys.
2. Add it to `.env` in the project folder:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   If your `.env` also has Supabase settings, sign in to use Claude, or add
   `AI_ALLOW_ANONYMOUS=true` to try it in local mode.
3. Restart `npm run dev`. The **Ask Claude** page shows "Connected".

The key is only read by the backend and never reaches the browser.

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | build | Sign-in and cloud sync. Leave empty for local mode only. |
| `VITE_MSPROJECT_BACKEND_URL` | build | Only if the converter is hosted on another domain. Locally it is reached through the dev proxy. |
| `ANTHROPIC_API_KEY` | server | Enables Claude. Never exposed to browsers. |
| `ANTHROPIC_WORKSPACE_ID` | server | Only for organisation-level keys that aren't tied to a workspace (Console → Settings → Workspaces). |
| `AI_MODEL` | server | Default `claude-opus-5-5`. |
| `AI_EFFORT` | server | Default `low` (cheapest). `medium`/`high` for deeper analysis. |
| `AI_RATE_LIMIT_PER_10_MIN`, `AI_DAILY_LIMIT` | server | Per-user limits. Defaults 20 and 200. |
| `AI_ALLOW_ANONYMOUS` | server | When Supabase is configured, Claude requires sign-in unless this is `true`. |
| `AI_FALLBACKS` | server | `off` disables automatic retry on another model when a request is declined. |

## Deploying to Netlify

1. Connect the repository. `netlify.toml` already sets the build command,
   output folder, function folder, routing, security headers and caching.
2. Under **Site configuration → Environment variables**, add the variables
   above. `VITE_*` values are baked into the build; the rest are read by the
   function at runtime.
3. Deploy. `/api/ai` is served by `netlify/functions/ai.mjs`.

### Supabase

Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor.
It creates the tables and **row level security** policies:

- Users can only read and change their own data.
- Admins can read everything, for the portfolio report.
- Nobody can make themselves an admin from the app.

The script is idempotent. Review it against your existing schema before
running it on a live database. `npm test` checks these rules against a real
Postgres engine (PGlite).

To make someone an admin:

```sql
update public.user_profiles set role = 'admin' where email = 'person@company.com';
```

## How Claude is used, and how cost is kept low

All requests go through `server/ai/core.mjs` (served by the Netlify Function
in production and the Express backend in development).

| Measure | Effect |
|---|---|
| Only runs when a user clicks a Claude button | No background or automatic calls |
| The browser sends a compact summary built by `src/domain/aiContext.js`: no IDs, short strings, capped lists, numbers pre-computed by `src/domain/analytics.js` | Typically 1–3k input tokens instead of the whole workspace |
| Fixed jobs only (`portfolio_insights`, `project_insights`, `weekly_report`, `generate_plan`, `map_columns`, `ask`); prompts and JSON schemas live on the server | The endpoint can't be used as a general-purpose Claude proxy |
| Low effort and a `max_tokens` cap per job | Short, focused answers |
| Stable system prompts marked for prompt caching | Repeated prompt text is billed at cache rates |
| Answers cached in the browser (24 h) and on the server (10 min) for identical data | Repeat questions cost nothing |
| Per-user rate limits, daily cap, 24 KB input limit, sign-in required when Supabase is on | Protects the API key from abuse |
| Structured JSON outputs | No retries on malformed answers |

The **Ask Claude** page shows the tokens used this month (counted in the
browser), and each answer shows its token count or "no tokens used" when it
came from a cache.

## Microsoft Project `.mpp` and other binary project files

MS Project XML import and export run entirely in the browser. Binary files
(`.mpp`, `.mpt`, `.mpx`, Primavera `.xer`/P6 XML, GanttProject `.gan`,
ProjectLibre `.pod`, Asta `.pp`) are converted by the backend using
[MPXJ](https://www.mpxj.org/):

- **Only Java 17+ is needed.** The converter builds itself the first time
  the backend starts (about 15–60 seconds). It uses Maven from `MAVEN_HOME`
  or the `PATH` if you have it, otherwise the bundled Maven Wrapper
  downloads Maven automatically. It rebuilds by itself when its source
  changes.
- Java is found through `JAVA_HOME`, or `java` on the `PATH`.
- `GET /api/convert/status` reports `building`, `ready`, `failed` or
  `no-java`.
- The converted MS Project XML is parsed in the browser, so every format
  gets the same handling of hierarchy, dependencies, resources and progress.

To host the converter separately in production, deploy `backend/` to any
Node host with Java, set `VITE_MSPROJECT_BACKEND_URL` to its URL, and set
`ALLOWED_ORIGINS` on the backend to your site's URL.

## Testing

```bash
npm run lint
npm test               # 98 unit tests: analytics, importers, exports, AI handler, database security, .mpp converter
npm run test:e2e       # 13 Playwright tests against the production build (Claude mocked)
npm run check          # lint + unit tests + build
```

GitHub Actions runs all of these on every push and pull request
(`.github/workflows/ci.yml`).

## Project structure

```
src/
  pages/            Dashboard, Planner, Ask Claude, Import & Export, Help
  components/       Planner views, AI cards, dialogs, layout
  domain/           analytics, AI input builders, plan builder, shared vocabulary
  services/         Supabase sync, Claude client, import readers and exporters
  store/            Zustand store (local + cloud persistence)
  ui/               design primitives, toasts and dialogs
server/ai/          Claude handler shared by Netlify and Express
netlify/functions/  /api/ai for production
backend/            Express server for .mpp conversion and local /api/ai
supabase/           schema with row level security, and its tests
e2e/                Playwright end-to-end tests
```
