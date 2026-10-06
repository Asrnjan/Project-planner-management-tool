import { describe, expect, it } from "vitest";
import { buildAskInput, buildColumnMappingInput, buildPortfolioDigest, buildProjectDigest } from "../domain/aiContext";
import { buildSampleWorkspace } from "../data/sampleWorkspace";

const workspace = buildSampleWorkspace();

describe("AI inputs stay small and contain no internal ids", () => {
  it("portfolio digest", () => {
    const digest = buildPortfolioDigest(workspace.projects, workspace.tasks);
    const text = JSON.stringify(digest);
    expect(text.length).toBeLessThan(4000);
    expect(text).not.toMatch(/task-sample|project-sample/);
    expect(digest.projects).toHaveLength(2);
    expect(digest.projects[0]).toHaveProperty("health");
  });

  it("project digest", () => {
    const digest = buildProjectDigest(workspace.projects[0], workspace.tasks, workspace.sprints);
    const text = JSON.stringify(digest);
    expect(text.length).toBeLessThan(5000);
    expect(text).not.toMatch(/task-sample|sprint-sample/);
    expect(digest.metrics.percentComplete).toBeGreaterThan(0);
    expect(digest.currentSprint?.name).toMatch(/Sprint 3/);
  });

  it("caps long fields and big portfolios", () => {
    const projects = Array.from({ length: 60 }, (_, index) => ({ id: `p${index}`, name: `Project ${index} ${"x".repeat(200)}` }));
    const digest = buildPortfolioDigest(projects, []);
    expect(digest.projects).toHaveLength(25);
    expect(digest.projects[0].name.length).toBeLessThanOrEqual(60);
    expect(JSON.stringify(buildAskInput("y".repeat(5000), { projects, tasks: [], sprints: [] })).length).toBeLessThan(24000);
  });

  it("column mapping input only sends three short samples per column", () => {
    const rows = Array.from({ length: 50 }, (_, index) => ({ Name: `Task ${index} ${"z".repeat(100)}`, Who: "" }));
    const input = buildColumnMappingInput(["Name", "Who"], rows);
    expect(input.columns[0].samples).toHaveLength(3);
    expect(input.columns[0].samples[0].length).toBeLessThanOrEqual(40);
    expect(input.columns[1].samples).toHaveLength(0);
  });
});
