import { BriefcaseBusiness, FolderOpen, ListChecks, RotateCcw } from "lucide-react";
import ProjectForm from "../components/projects/ProjectForm";
import ProjectCard from "../components/projects/ProjectCard";
import CollapsibleCard from "../components/common/AppCollapsibleCard";
import { usePlannerStore } from "../store/usePlannerStore";
import { summarizeProject } from "../utils/calculations";

function PortfolioStatCard({ title, value, icon: Icon, subtitle }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
          {title}
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900">{value}</div>
      {subtitle ? <div className="mt-0.5 text-[11px] text-slate-500">{subtitle}</div> : null}
    </div>
  );
}

export default function PortfolioPage() {
  const { projects, tasks, addProject, updateProject, deleteProject, resetAllData } =
    usePlannerStore();

  const totalProjects = projects.length;
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.status === "Done").length;
  const activeProjects = projects.filter((project) => project.status === "Active").length;

  function handleReset() {
    const confirmed = window.confirm(
      "This will remove all current data and restore the sample data. Continue?"
    );
    if (confirmed) {
      resetAllData();
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Project Portfolio
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              A compact overview of projects, progress, and planning access.
            </p>
          </div>

          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-100"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Sample Data
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <PortfolioStatCard title="Projects" value={totalProjects} icon={BriefcaseBusiness} />
        <PortfolioStatCard title="Active" value={activeProjects} icon={FolderOpen} />
        <PortfolioStatCard title="Tasks" value={totalTasks} icon={ListChecks} />
        <PortfolioStatCard
          title="Completed"
          value={completedTasks}
          icon={ListChecks}
          subtitle={totalTasks ? `${Math.round((completedTasks / totalTasks) * 100)}% done` : "No tasks yet"}
        />
      </section>

      <CollapsibleCard
        title="Create Project"
        subtitle="Open only when you want to add a new project."
        defaultOpen={false}
      >
        <ProjectForm onSubmit={addProject} />
      </CollapsibleCard>

      <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {projects.map((project) => {
          const projectTasks = tasks.filter((task) => task.projectId === project.id);
          const summary = summarizeProject(projectTasks);

          return (
            <ProjectCard
              key={project.id}
              project={project}
              summary={summary}
              onDelete={deleteProject}
              onUpdate={updateProject}
            />
          );
        })}

        {projects.length === 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm lg:col-span-2 2xl:col-span-3">
            No projects found. Create your first project above.
          </div>
        )}
      </section>
    </div>
  );
}