import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildDeckAiInput, buildDeckModel, cleanSlideText, splitLines } from "../domain/deckData";
import { buildPortfolioDeck } from "../utils/portfolioDeck";
import { buildSampleWorkspace } from "../data/sampleWorkspace";

const today = "2026-10-07";

function workspace(extraProjects = 0) {
  const ws = buildSampleWorkspace();
  for (let index = 0; index < extraProjects; index += 1) {
    const id = `extra-${index}`;
    ws.projects.push({ id, name: `Programme ${index + 1} with a fairly long name for wrapping`, status: "Active", owner: "Alex Long-Surname", targetEndDate: "2026-12-01" });
    ws.tasks.push(
      { id: `${id}-a`, projectId: id, title: "Kick-off \u0007 with a control character", status: "Done", plannedStart: "2026-09-20", plannedEnd: "2026-10-01", actualProgress: 100, owner: "Alex" },
      { id: `${id}-b`, projectId: id, title: "A very long task title ".repeat(8), status: "Blocked", plannedStart: "2026-10-01", plannedEnd: "2026-10-03", owner: "Sam", notes: "Waiting on vendor ".repeat(10) }
    );
  }
  return ws;
}

describe("deck model", () => {
  it("cleans text that would corrupt the file", () => {
    expect(cleanSlideText("a\u0000b\u0007c￾  d")).toBe("abc d");
    expect(cleanSlideText("x".repeat(500), 10)).toHaveLength(10);
    expect(splitLines("- one\n- two\nNone")).toEqual(["one", "two"]);
  });

  it("summarises each project from data, with no money fields", () => {
    const model = buildDeckModel({ ...workspace(), title: "Q4 Review", today });
    expect(model.title).toBe("Q4 Review");
    expect(model.kpis.map((kpi) => kpi.label)).toContain("At risk");
    const crm = model.projects.find((project) => project.name === "CRM Migration");
    expect(crm.health.label).toBe("Off track");
    expect(crm.risks.join(" ")).toMatch(/Blocked: Map fields to CRM objects/);
    expect(crm.nextSteps.length).toBeGreaterThan(0);
    expect(JSON.stringify(model)).not.toMatch(/budget|spend|cost/i);
  });

  it("uses Claude's narrative for text but keeps numbers from the data", () => {
    const base = buildDeckModel({ ...workspace(), today });
    const input = buildDeckAiInput(base);
    expect(input.projects[0].key).toBe("p1");
    const narrative = {
      headline: "Two projects need attention.",
      summary: "Summary.",
      projects: [{ key: "p1", statusSummary: "AI status", keyUpdates: ["AI update"], risks: [], nextSteps: ["AI next"], decisionsNeeded: [] }],
    };
    const model = buildDeckModel({ ...workspace(), today, narrative });
    expect(model.headline).toBe("Two projects need attention.");
    expect(model.projects[0].statusLine).toBe("AI status");
    expect(model.projects[0].keyUpdates).toEqual(["AI update"]);
    expect(model.projects[0].risks).toEqual(base.projects[0].risks);
    expect(model.projects[0].percentComplete).toBe(base.projects[0].percentComplete);
  });
});

describe("deck file", () => {
  it("is a valid PowerPoint with banner, summary pages and one slide per project", async () => {
    const model = buildDeckModel({ ...workspace(8), today });
    const buffer = await buildPortfolioDeck(model).write({ outputType: "nodebuffer" });
    const zip = await JSZip.loadAsync(buffer);
    const slides = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
    // 10 projects: 1 banner + 2 summary pages + 10 project slides.
    expect(slides).toHaveLength(13);
    for (const name of slides) {
      const xml = await zip.file(name).async("string");
      // eslint-disable-next-line no-control-regex
      expect(xml).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
      expect(xml).not.toMatch(/<p:pic/); // text and shapes only, so everything stays editable
    }
  });
});
