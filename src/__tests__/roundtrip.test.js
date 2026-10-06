import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { readImportFile } from "../services/importExport/readers";
import { buildCsv, buildJsonBackup, buildWorkbook } from "../services/importExport/exporters";
import { buildSampleWorkspace } from "../data/sampleWorkspace";

const workspace = buildSampleWorkspace();

function fingerprint(tasks) {
  return tasks
    .map((task) => [task.id, task.title, task.projectId, task.parentTaskId || "", (task.dependencyIds || []).join("|"), task.plannedStart, task.plannedEnd, task.status, Number(task.actualProgress || 0), Boolean(task.isMilestone)].join("~"))
    .sort();
}

describe("export -> import round trips", () => {
  it("JSON backup restores everything including reports and documents", async () => {
    const file = new File([buildJsonBackup(workspace)], "backup.json");
    const result = await readImportFile(file);
    expect(result.kind).toBe("planner");
    expect(result.data.weeklyReports).toHaveLength(workspace.weeklyReports.length);
    expect(result.data.projectDocuments).toHaveLength(workspace.projectDocuments.length);
    expect(fingerprint(result.data.tasks)).toEqual(fingerprint(workspace.tasks));
  });

  it("CSV keeps ids, hierarchy, dependencies, sprints and project names", async () => {
    const file = new File([buildCsv(workspace)], "tasks.csv");
    const result = await readImportFile(file);
    expect(result.kind).toBe("planner");
    expect(fingerprint(result.data.tasks)).toEqual(fingerprint(workspace.tasks));
    expect(result.data.projects.map((project) => project.name).sort()).toEqual(workspace.projects.map((project) => project.name).sort());
    expect(result.data.sprints.map((sprint) => sprint.name).sort()).toEqual(workspace.sprints.map((sprint) => sprint.name).sort());
  });

  it("Excel workbook keeps projects, sprints and tasks", async () => {
    const buffer = XLSX.write(buildWorkbook(workspace), { type: "array", bookType: "xlsx" });
    const result = await readImportFile(new File([buffer], "plan.xlsx"));
    expect(result.kind).toBe("planner");
    expect(fingerprint(result.data.tasks)).toEqual(fingerprint(workspace.tasks));
    expect(result.data.projects.map((project) => project.name).sort()).toEqual(workspace.projects.map((project) => project.name).sort());
    expect(result.data.sprints).toHaveLength(workspace.sprints.length);
  });

  it("a foreign Excel file goes to column mapping with real dates", async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Activity", "Assigned", "Begin", "Deadline"],
      ["Write spec", "Ann", new Date(Date.UTC(2025, 6, 1)), new Date(Date.UTC(2025, 6, 4))],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["notes only"]]), "Notes");
    XLSX.utils.book_append_sheet(book, sheet, "Plan");
    const buffer = XLSX.write(book, { type: "array", bookType: "xlsx" });

    const result = await readImportFile(new File([buffer], "foreign.xlsx"));
    expect(result.kind).toBe("table");
    expect(result.sheetName).toBe("Plan");
    expect(result.mapping).toMatchObject({ Activity: "title", Assigned: "owner", Begin: "plannedStart", Deadline: "plannedEnd" });
  });

  it("reads Trello board exports with checklists as subtasks", async () => {
    const board = {
      name: "Marketing",
      lists: [{ id: "l1", name: "Doing" }, { id: "l2", name: "Done" }],
      members: [{ id: "m1", fullName: "Ann Lee" }],
      labels: [{ id: "lb", name: "Urgent" }],
      cards: [
        { id: "c1", name: "Write blog", idList: "l1", idMembers: ["m1"], idLabels: ["lb"], due: "2025-07-04T12:00:00.000Z" },
        { id: "c2", name: "Old card", idList: "l2", closed: true },
        { id: "c3", name: "Publish", idList: "l2" },
      ],
      checklists: [{ idCard: "c1", checkItems: [{ name: "Draft", state: "complete" }, { name: "Edit", state: "incomplete" }] }],
    };
    const result = await readImportFile(new File([JSON.stringify(board)], "trello.json"));
    expect(result.label).toMatch(/Trello/);
    const byTitle = Object.fromEntries(result.data.tasks.map((task) => [task.title, task]));
    expect(Object.keys(byTitle).sort()).toEqual(["Draft", "Edit", "Publish", "Write blog"]);
    expect(byTitle["Write blog"]).toMatchObject({ status: "In Progress", owner: "Ann Lee", plannedEnd: "2025-07-04" });
    expect(byTitle.Publish.status).toBe("Done");
    expect(byTitle.Draft.parentTaskId).toBe(byTitle["Write blog"].id);
  });

  it("generic JSON arrays become a mappable table", async () => {
    const json = { data: [{ name: "Task A", assignee: { name: "Ann" }, due_on: "2025-07-01", completed: true }] };
    const result = await readImportFile(new File([JSON.stringify(json)], "asana.json"));
    expect(result.kind).toBe("table");
    expect(result.rows[0]).toMatchObject({ name: "Task A", assignee: "Ann", due_on: "2025-07-01" });
    expect(result.mapping.name).toBe("title");
  });

  it("rejects unsupported and empty files with clear messages", async () => {
    await expect(readImportFile(new File(["x"], "photo.png"))).rejects.toThrow(/not supported/);
    await expect(readImportFile(new File([""], "empty.csv"))).rejects.toThrow(/empty/);
    await expect(readImportFile(new File(["{bad"], "x.json"))).rejects.toThrow(/could not be read/);
  });
});
