import { describe, expect, it } from "vitest";
import { autoMapColumns, mappingQuality } from "../services/importExport/columnMapper";
import { rowsToPlannerData } from "../services/importExport/tableToPlanner";
import { flattenRecord, gridToTable, msProjectXmlToPlanner } from "../services/importExport/readers";
import { buildMsProjectXml, buildIcs, scopeWorkspace } from "../services/importExport/exporters";

describe("autoMapColumns", () => {
  it("maps Jira CSV headers", () => {
    const headers = ["Issue key", "Summary", "Status", "Assignee", "Priority", "Due date", "Created", "Parent summary", "Labels"];
    const mapping = autoMapColumns(headers);
    expect(mapping).toMatchObject({
      "Issue key": "externalId",
      Summary: "title",
      Status: "status",
      Assignee: "owner",
      Priority: "priority",
      "Due date": "plannedEnd",
      Created: "plannedStart",
      "Parent summary": "parent",
      Labels: "tags",
    });
    expect(mappingQuality(mapping)).toBe("good");
  });

  it("maps Asana CSV headers", () => {
    const mapping = autoMapColumns(["Task ID", "Name", "Section/Column", "Assignee", "Start Date", "Due Date", "Notes", "Completed At"]);
    expect(mapping).toMatchObject({
      "Task ID": "externalId",
      Name: "title",
      "Section/Column": "sprint",
      Assignee: "owner",
      "Start Date": "plannedStart",
      "Due Date": "plannedEnd",
      Notes: "notes",
      "Completed At": "actualEnd",
    });
  });

  it("maps MS Project / Smartsheet style headers and never reuses a field", () => {
    const mapping = autoMapColumns(["WBS", "Task Name", "Duration", "Start", "Finish", "Predecessors", "Resource Names", "% Complete"]);
    expect(mapping).toMatchObject({
      WBS: "wbs",
      "Task Name": "title",
      Duration: "durationDays",
      Start: "plannedStart",
      Finish: "plannedEnd",
      Predecessors: "predecessors",
      "Resource Names": "owner",
      "% Complete": "actualProgress",
    });
    const used = Object.values(mapping).filter((field) => field !== "ignore");
    expect(new Set(used).size).toBe(used.length);
  });

  it("falls back to the first text column for the task name", () => {
    const mapping = autoMapColumns(["Thing", "Count"], [{ Thing: "Write docs", Count: 3 }]);
    expect(mapping.Thing).toBe("title");
  });

  it("recognises Monday-style timeline columns", () => {
    expect(autoMapColumns(["Item", "Person", "Timeline"])).toMatchObject({ Item: "title", Person: "owner", Timeline: "dateRange" });
  });
});

describe("gridToTable", () => {
  it("skips title rows above the real header and empty columns", () => {
    const table = gridToTable([
      ["Q3 delivery plan"],
      [],
      ["Task", "Owner", "Due", ""],
      ["Write spec", "Ann", "2025-07-01", ""],
      ["Review", "Bo", "2025-07-05", ""],
    ]);
    expect(table.headers).toEqual(["Task", "Owner", "Due"]);
    expect(table.rows).toHaveLength(2);
  });
});

describe("rowsToPlannerData", () => {
  const rows = [
    { Project: "Apollo", WBS: "1", Task: "Design", Owner: "Ann", Status: "Closed", Start: "01/07/2025", Finish: "10/07/2025", "% Complete": "100%", Predecessors: "" },
    { Project: "Apollo", WBS: "1.1", Task: "Sketches", Owner: "Ann; Bo", Status: "Done", Start: "01/07/2025", Finish: "03/07/2025", "% Complete": "1", Predecessors: "" },
    { Project: "Apollo", WBS: "2", Task: "Build", Owner: "Bo", Status: "In Review", Start: "14/07/2025", Duration: "2w", "% Complete": "0.4", Predecessors: "1FS+2d" },
    { Project: "Apollo", WBS: "3", Task: "Launch", Owner: "", Status: "", Start: "", Finish: "01/08/2025", Milestone: "yes", Predecessors: "Build, Unknown" },
    { Project: "Zeus", WBS: "1", Task: "Kickoff", Owner: "Cy", Status: "to do" },
    { Project: "", WBS: "", Task: "", Owner: "ignored", Status: "" },
  ];
  const mapping = autoMapColumns(Object.keys({ ...rows[0], ...rows[2], ...rows[3] }));
  const result = rowsToPlannerData(rows, mapping, { fileName: "plan.xlsx" });
  const byTitle = Object.fromEntries(result.data.tasks.map((task) => [task.title, task]));

  it("creates projects from the project column", () => {
    expect(result.data.projects.map((project) => project.name).sort()).toEqual(["Apollo", "Zeus"]);
  });

  it("detects day-first dates and fills missing ends from durations", () => {
    expect(result.dateOrder).toBe("dmy");
    expect(byTitle.Design.plannedStart).toBe("2025-07-01");
    expect(byTitle.Design.plannedEnd).toBe("2025-07-10");
    expect(byTitle.Build.durationDays).toBe(10);
    expect(byTitle.Build.plannedEnd).toBe("2025-07-23");
  });

  it("normalises status, progress, owners and milestones", () => {
    expect(byTitle.Design.status).toBe("Done");
    expect(byTitle.Build.status).toBe("In Progress");
    expect(byTitle.Build.actualProgress).toBe(40);
    expect(byTitle.Sketches.owner).toBe("Ann, Bo");
    expect(byTitle.Launch.isMilestone).toBe(true);
    expect(byTitle.Launch.plannedStart).toBe("2025-08-01");
    expect(byTitle.Kickoff.status).toBe("Not Started");
  });

  it("builds hierarchy from WBS and resolves dependencies", () => {
    expect(byTitle.Sketches.parentTaskId).toBe(byTitle.Design.id);
    expect(byTitle.Build.dependencyIds).toEqual([byTitle.Design.id]);
    expect(byTitle.Launch.dependencyIds).toEqual([byTitle.Build.id]);
    expect(result.warnings.join(" ")).toMatch(/could not be matched/);
  });

  it("skips rows without a task name and reports it", () => {
    expect(result.data.tasks).toHaveLength(5);
    expect(result.warnings.join(" ")).toMatch(/1 row had no task name/);
  });

  it("reuses existing projects with the same name when merging", () => {
    const merged = rowsToPlannerData(rows, mapping, {
      fileName: "plan.xlsx",
      existingProjects: [{ id: "existing", name: "apollo" }],
    });
    expect(merged.reusedProjects).toEqual(["apollo"]);
    expect(merged.data.projects.map((project) => project.name)).toEqual(["Zeus"]);
    expect(merged.data.tasks.find((task) => task.title === "Design").projectId).toBe("existing");
  });

  it("creates parent groups for epics that are not rows", () => {
    const epic = rowsToPlannerData(
      [
        { Summary: "Login page", "Epic Link": "Auth" },
        { Summary: "Password reset", "Epic Link": "Auth" },
      ],
      { Summary: "title", "Epic Link": "parent" },
      { fileName: "jira.csv" }
    );
    const parent = epic.data.tasks.find((task) => task.title === "Auth");
    expect(parent.isSummaryTask).toBe(true);
    expect(epic.data.tasks.filter((task) => task.parentTaskId === parent.id)).toHaveLength(2);
  });

  it("splits date ranges", () => {
    const ranged = rowsToPlannerData([{ Item: "Do it", Timeline: "2025-03-01 - 2025-03-05" }], { Item: "title", Timeline: "dateRange" });
    expect(ranged.data.tasks[0]).toMatchObject({ plannedStart: "2025-03-01", plannedEnd: "2025-03-05", durationDays: 5 });
  });

  it("requires a task name column", () => {
    expect(() => rowsToPlannerData(rows, { Owner: "owner" })).toThrow(/task name/);
  });
});

describe("flattenRecord", () => {
  it("flattens Jira API issues", () => {
    const flat = flattenRecord({
      key: "PRJ-1",
      fields: { summary: "Fix login", status: { name: "In Progress" }, assignee: { displayName: "Ann" }, labels: ["ui", "auth"] },
    });
    expect(flat).toMatchObject({ key: "PRJ-1", summary: "Fix login", status: "In Progress", assignee: "Ann", labels: "ui, auth" });
  });
});

const workspace = {
  projects: [{ id: "p1", name: "Apollo", owner: "Ann", startDate: "2025-07-01" }],
  tasks: [
    { id: "t1", projectId: "p1", title: "Design", owner: "Ann", status: "Done", plannedStart: "2025-07-01", plannedEnd: "2025-07-04", durationDays: 4, actualProgress: 100, dependencyIds: [] },
    { id: "t2", projectId: "p1", title: "Sketch & plan", parentTaskId: "t1", owner: "Ann, Bo", status: "Done", plannedStart: "2025-07-01", plannedEnd: "2025-07-02", durationDays: 2, actualProgress: 100, dependencyIds: [] },
    { id: "t3", projectId: "p1", title: "Launch", isMilestone: true, status: "Not Started", plannedStart: "2025-07-10", plannedEnd: "2025-07-10", durationDays: 1, actualProgress: 0, dependencyIds: ["t1"] },
  ],
};

describe("MS Project XML", () => {
  it("round-trips hierarchy, dependencies, owners and milestones", () => {
    const xml = buildMsProjectXml(workspace);
    expect(xml).toContain("<Project xmlns=\"http://schemas.microsoft.com/project\">");
    expect(xml).not.toContain("undefined");

    const data = msProjectXmlToPlanner(xml, "apollo.xml");
    const byTitle = Object.fromEntries(data.tasks.map((task) => [task.title, task]));
    expect(data.projects[0].name).toBe("Apollo");
    expect(data.tasks).toHaveLength(3);
    expect(byTitle["Sketch & plan"].parentTaskId).toBe(byTitle.Design.id);
    expect(byTitle.Launch.dependencyIds).toEqual([byTitle.Design.id]);
    expect(byTitle.Launch.isMilestone).toBe(true);
    expect(byTitle["Sketch & plan"].owner).toBe("Ann, Bo");
    expect(byTitle.Design.plannedStart).toBe("2025-07-01");
    expect(byTitle.Design.plannedEnd).toBe("2025-07-04");
    expect(byTitle.Design.status).toBe("Done");
  });

  it("rejects XML that is not a project file", () => {
    expect(() => msProjectXmlToPlanner("<root/>")).toThrow(/not a Microsoft Project/);
  });
});

describe("other exports", () => {
  it("writes an all-day calendar event per dated task", () => {
    const ics = buildIcs(workspace);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics).toContain("DTSTART;VALUE=DATE:20250710");
    expect(ics).toContain("DTEND;VALUE=DATE:20250711");
    expect(ics).toContain("SUMMARY:Sketch & plan");
  });

  it("scopes a workspace to selected projects", () => {
    const scoped = scopeWorkspace({ ...workspace, projects: [...workspace.projects, { id: "p2", name: "Other" }] }, ["p2"]);
    expect(scoped.projects).toHaveLength(1);
    expect(scoped.tasks).toHaveLength(0);
  });
});
