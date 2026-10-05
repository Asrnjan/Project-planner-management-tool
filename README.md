# Project Planner & Tracker

A web app for planning and tracking projects: a portfolio of projects, Gantt-style timelines, task boards, sprints, resources, dependencies, baselines, risk tracking and management reports. Data and sign-in are handled by Supabase.

## Features

- **Portfolio** (`/`): all projects at a glance with summary cards.
- **Project page** (`/project/:projectId`): tasks, sprints, timeline and project documents.
- **Planner** (`/planner`): board, timeline (Gantt), schedule table, resources and reports views, plus:
  - dependency graph and relationship panel
  - baselines, schedule warnings and scheduling assistance
  - risk summary
- **Import / export**: CSV, Excel (`.xlsx`), JSON and Microsoft Project XML. Microsoft Project `.mpp` files are imported through the optional backend.
- **Reports**: weekly CEO report and a centralized manager report exported to PowerPoint.

## Tech stack

- **Frontend**: React 19, Vite 7, Tailwind CSS 4, React Router, Zustand, date-fns
- **Data / auth**: Supabase
- **Exports**: SheetJS (`xlsx`), PapaParse, pptxgenjs
- **Backend** (optional, for MS Project): Node.js + Express, with a Java 17 converter built on [MPXJ](https://www.mpxj.org/)

## Getting started

### 1. Frontend

```bash
npm install
cp .env.example .env   # then fill in your values
npm run dev
```

Environment variables (`.env`):

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon (public) key |
| `VITE_MSPROJECT_BACKEND_URL` | URL of the MS Project backend (default `http://localhost:5050`) |

`.env` is git-ignored. For deployments (e.g. Netlify), set these variables in the hosting provider's environment settings.

Other scripts: `npm run build` (production build into `dist/`) and `npm run preview`.

### 2. MS Project backend (optional)

Needed only for importing `.mpp` files and MS Project XML import/export.

Build the Java converter (requires JDK 17 and Maven):

```bash
cd backend/java-mpxj
mvn -q compile dependency:copy-dependencies
```

This creates `target/classes` and `target/dependency`, which are git-ignored.

Then start the server:

```bash
cd backend
npm install
npm start   # listens on PORT, default 5050
```

Endpoints:

- `GET /api/health`
- `POST /api/import/msproject` (multipart upload, field `file`)
- `POST /api/export/msproject`

> Note: `backend/server.js` currently looks for Java at a fixed Windows path (`C:\Program Files\Eclipse Adoptium\jdk-17...`). Adjust it if your JDK is installed elsewhere.

## Deployment

The frontend is a static Vite build. `public/_redirects` sends all routes to `index.html` so client-side routing works on Netlify.

## Project structure

```
src/
  pages/          Portfolio, Project and Planner pages
  components/     UI (Planner views, tasks, sprints, gantt, reports, documents, ...)
  services/       Supabase data access, reports, MS Project and import/export formats
  store/          Zustand planner store
  utils/          Calculations, scheduling helpers, PowerPoint report builder
  lib/            Supabase client and auth
backend/
  server.js       Express server for MS Project import/export
  java-mpxj/      Java .mpp -> XML converter (Maven project)
```
