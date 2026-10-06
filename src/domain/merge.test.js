import { describe, expect, it } from "vitest";
import { fingerprint, mergeProjectPayload } from "./merge";

const base = {
  id: "p1",
  name: "Launch",
  description: "v1",
  tasks: [
    { id: "t1", title: "Design", status: "Not Started" },
    { id: "t2", title: "Build", status: "Not Started" },
  ],
  sprints: [],
};

describe("mergeProjectPayload", () => {
  it("keeps both people's changes to different tasks", () => {
    const ours = { ...base, tasks: [{ ...base.tasks[0], status: "Done" }, base.tasks[1]] };
    const theirs = { ...base, tasks: [base.tasks[0], { ...base.tasks[1], status: "In Progress" }] };
    const { merged, conflicts } = mergeProjectPayload(base, ours, theirs);
    expect(merged.tasks.map((task) => task.status)).toEqual(["Done", "In Progress"]);
    expect(conflicts).toEqual([]);
  });

  it("keeps tasks added on either side and honours deletions", () => {
    const ours = { ...base, tasks: [...base.tasks, { id: "t3", title: "Test" }] };
    const theirs = { ...base, tasks: [base.tasks[1]] };
    const { merged } = mergeProjectPayload(base, ours, theirs);
    expect(merged.tasks.map((task) => task.id)).toEqual(["t2", "t3"]);
  });

  it("lets the saved version win when both changed the same task", () => {
    const ours = { ...base, tasks: [{ ...base.tasks[0], title: "Ours" }, base.tasks[1]] };
    const theirs = { ...base, tasks: [{ ...base.tasks[0], title: "Theirs" }, base.tasks[1]] };
    const { merged, conflicts } = mergeProjectPayload(base, ours, theirs);
    expect(merged.tasks[0].title).toBe("Theirs");
    expect(conflicts).toEqual([{ kind: "tasks", id: "t1", title: "Theirs" }]);
  });

  it("merges project fields", () => {
    const { merged } = mergeProjectPayload(base, { ...base, description: "v2" }, { ...base, name: "Launch 2" });
    expect(merged).toMatchObject({ name: "Launch 2", description: "v2" });
  });

  it("ignores volatile fields when comparing", () => {
    expect(fingerprint({ a: 1, savedAt: "x", b: [1] })).toBe(fingerprint({ b: [1], a: 1, savedAt: "y" }));
  });
});
