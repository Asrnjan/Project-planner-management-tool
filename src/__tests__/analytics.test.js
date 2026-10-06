import { describe, expect, it } from "vitest";
import {
  computePortfolio,
  computeProjectMetrics,
  deriveHealth,
  expectedProgressRatio,
} from "../domain/analytics";

const TODAY = "2025-06-15";
const project = { id: "p1", name: "Alpha", targetEndDate: "2025-06-30", status: "Active" };

function task(fields) {
  return { projectId: "p1", status: "Not Started", actualProgress: 0, owner: "Ann", ...fields };
}

describe("expectedProgressRatio", () => {
  it("is 0 before start, 1 after end, linear in between", () => {
    const t = { plannedStart: "2025-06-11", plannedEnd: "2025-06-20" };
    expect(expectedProgressRatio(t, "2025-06-01")).toBe(0);
    expect(expectedProgressRatio(t, "2025-06-25")).toBe(1);
    expect(expectedProgressRatio(t, "2025-06-15")).toBeCloseTo(0.5);
  });
});

describe("computeProjectMetrics", () => {
  const tasks = [
    task({ id: "a", title: "Done", status: "Done", plannedStart: "2025-06-01", plannedEnd: "2025-06-05", actualProgress: 100 }),
    task({ id: "b", title: "Late", status: "In Progress", plannedStart: "2025-06-06", plannedEnd: "2025-06-10", actualProgress: 50 }),
    task({ id: "c", title: "Blocked", status: "Blocked", plannedStart: "2025-06-16", plannedEnd: "2025-06-18" }),
    task({ id: "d", title: "Soon", owner: "", plannedStart: "2025-06-17", plannedEnd: "2025-06-19" }),
    task({ id: "parent", title: "Summary" }),
    task({ id: "e", title: "Child", parentTaskId: "parent", plannedStart: "2025-07-01", plannedEnd: "2025-07-03" }),
    { id: "other", projectId: "p2", title: "Other project", status: "Not Started" },
  ];

  const metrics = computeProjectMetrics(project, tasks, TODAY);

  it("counts only this project's leaf tasks", () => {
    expect(metrics.total).toBe(5);
    expect(metrics.summaryRows).toBe(1);
    expect(metrics.done).toBe(1);
    expect(metrics.blocked).toBe(1);
  });

  it("finds overdue, due-soon and unassigned work", () => {
    expect(metrics.overdue).toBe(1);
    expect(metrics.overdueTasks[0].id).toBe("b");
    expect(metrics.dueSoon).toBe(2);
    expect(metrics.unassigned).toBe(1);
  });

  it("computes a schedule index below 1 when behind", () => {
    expect(metrics.spi).toBeGreaterThan(0);
    expect(metrics.spi).toBeLessThan(1);
  });

  it("forecasts the finish and slip against the target", () => {
    expect(metrics.forecastFinish >= "2025-07-03").toBe(true);
    expect(metrics.slipDays).toBeGreaterThan(0);
    // spi is exactly 0.75 and 1 of 4 open tasks is late: on the boundary,
    // so the project is "at risk" rather than "off track".
    expect(metrics.spi).toBe(0.75);
    expect(metrics.health.level).toBe("risk");
  });
});

describe("deriveHealth", () => {
  it("handles empty and complete projects", () => {
    expect(deriveHealth({ total: 0 }).level).toBe("empty");
    expect(deriveHealth({ total: 3, done: 3 }).level).toBe("done");
  });

  it("is on track when nothing is wrong", () => {
    expect(deriveHealth({ total: 4, done: 1, overdue: 0, blocked: 0, spi: 1, slipDays: -2 }).level).toBe("good");
  });

  it("flags risk for a single blocked task", () => {
    expect(deriveHealth({ total: 4, done: 1, overdue: 0, blocked: 1, spi: 1, slipDays: 0 }).level).toBe("risk");
  });
});

describe("computePortfolio", () => {
  it("aggregates projects and ranks attention items", () => {
    const portfolio = computePortfolio(
      [project, { id: "p2", name: "Beta", status: "Completed" }],
      [
        task({ id: "late", title: "Late", plannedEnd: "2025-06-01", plannedStart: "2025-05-30" }),
        task({ id: "blk", title: "Blocked", status: "Blocked", plannedStart: "2025-06-20", plannedEnd: "2025-06-21" }),
        { id: "x", projectId: "p2", title: "Done", status: "Done" },
      ],
      TODAY
    );
    expect(portfolio.projectCount).toBe(2);
    expect(portfolio.activeProjects).toBe(1);
    expect(portfolio.totalTasks).toBe(3);
    expect(portfolio.attention[0].kind).toBe("overdue");
    expect(portfolio.attention.map((item) => item.kind)).toContain("blocked");
  });
});
