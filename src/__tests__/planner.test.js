import { describe, expect, it } from "vitest";
import { applySingleGridDraftToTask, getTaskDuration } from "../utils/planner";
import { addWorkingDays, buildPlanTasks, nextWorkingDay } from "../domain/planBuilder";

const tasks = [
  { id: "a", title: "A", plannedStart: "2025-07-01", plannedEnd: "2025-07-03", durationDays: 3, dependencyIds: [] },
  { id: "b", title: "B", plannedStart: "2025-07-07", plannedEnd: "2025-07-11", durationDays: 1, dependencyIds: ["a"], owner: "Ann" },
];

function draftFor(task, changes = {}) {
  return {
    title: task.title,
    owner: task.owner || "",
    sprintId: "",
    status: "Not Started",
    durationDays: getTaskDuration(task),
    plannedStart: task.plannedStart,
    plannedEnd: task.plannedEnd,
    predecessorInput: "",
    plannedProgress: 0,
    isMilestone: false,
    isManualLocked: false,
    ...changes,
  };
}

describe("schedule grid edits (regressions)", () => {
  it("prefers dates over a stale durationDays", () => {
    expect(getTaskDuration(tasks[1])).toBe(5);
  });

  it("editing the owner keeps dependencies and dates", () => {
    const updated = applySingleGridDraftToTask(tasks[1], draftFor(tasks[1], { owner: "Bo" }), tasks);
    expect(updated.owner).toBe("Bo");
    expect(updated.dependencyIds).toEqual(["a"]);
    expect(updated.plannedStart).toBe("2025-07-07");
    expect(updated.plannedEnd).toBe("2025-07-11");
    expect(updated.durationDays).toBe(5);
  });

  it("'none' clears dependencies; numbers replace them", () => {
    expect(applySingleGridDraftToTask(tasks[1], draftFor(tasks[1], { predecessorInput: "none" }), tasks).dependencyIds).toEqual([]);
  });

  it("changing the finish date recomputes the duration", () => {
    const updated = applySingleGridDraftToTask(tasks[1], draftFor(tasks[1], { plannedEnd: "2025-07-14" }), tasks);
    expect(updated.plannedStart).toBe("2025-07-07");
    expect(updated.durationDays).toBe(8);
  });

  it("changing the duration moves the finish date", () => {
    const updated = applySingleGridDraftToTask(tasks[1], draftFor(tasks[1], { durationDays: 2 }), tasks);
    expect(updated.plannedEnd).toBe("2025-07-08");
  });
});

describe("planBuilder", () => {
  it("skips weekends", () => {
    expect(nextWorkingDay("2025-07-05")).toBe("2025-07-07");
    expect(addWorkingDays("2025-07-04", 2)).toBe("2025-07-07");
  });

  it("schedules phases, dependencies and milestones", () => {
    const plan = buildPlanTasks(
      [
        { key: "T1", title: "Requirements", phase: "Discover", durationDays: 3, dependsOn: [], isMilestone: false, priority: "High" },
        { key: "T2", title: "Sign-off", phase: "Discover", durationDays: 1, dependsOn: ["T1"], isMilestone: true, priority: "High" },
        { key: "T3", title: "Build", phase: "Deliver", durationDays: 5, dependsOn: ["T2", "T9", "T3"], isMilestone: false, priority: "Medium" },
        { key: "T4", title: "Bad forward link", phase: "Deliver", durationDays: 2, dependsOn: ["T5"], isMilestone: false, priority: "Low" },
      ],
      { projectId: "p1", startDate: "2025-07-03" }
    );
    const byTitle = Object.fromEntries(plan.map((task) => [task.title, task]));
    expect(byTitle.Discover.isSummaryTask).toBe(true);
    expect(byTitle.Requirements).toMatchObject({ plannedStart: "2025-07-03", plannedEnd: "2025-07-07", parentTaskId: byTitle.Discover.id });
    expect(byTitle["Sign-off"]).toMatchObject({ plannedStart: "2025-07-08", plannedEnd: "2025-07-08", isMilestone: true });
    expect(byTitle.Build.dependencyIds).toEqual([byTitle["Sign-off"].id]);
    expect(byTitle.Build.plannedStart).toBe("2025-07-08");
    expect(byTitle["Bad forward link"].dependencyIds).toEqual([]);
    expect(plan.every((task) => task.projectId === "p1")).toBe(true);
  });
});
