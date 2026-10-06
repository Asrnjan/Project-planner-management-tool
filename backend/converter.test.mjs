// Builds and runs the real Java converter (skipped when Java isn't
// installed). An MS Project XML file exported by the app is converted by
// MPXJ and read back with the browser's XML reader.
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildMsProjectXml } from "../src/services/importExport/exporters.js";
import { msProjectXmlToPlanner } from "../src/services/importExport/readers.js";

const require = createRequire(import.meta.url);
const converter = require("./converter.js");

const hasJava =
  Boolean(process.env.JAVA_HOME) ||
  spawnSync("java", ["-version"], { shell: process.platform === "win32" }).status === 0;

describe.skipIf(!hasJava)("Java project file converter", () => {
  it(
    "builds itself and round-trips a project through MPXJ",
    async () => {
      await converter.ensureBuilt();
      expect(converter.getConverterStatus().status).toBe("ready");

      const workspace = {
        projects: [{ id: "p1", name: "Converter check", startDate: "2025-07-01" }],
        tasks: [
          { id: "a", projectId: "p1", title: "Phase", status: "Not Started", plannedStart: "2025-07-01", plannedEnd: "2025-07-04", dependencyIds: [] },
          { id: "b", projectId: "p1", parentTaskId: "a", title: "Design", owner: "Ann", status: "Done", actualProgress: 100, plannedStart: "2025-07-01", plannedEnd: "2025-07-02", dependencyIds: [] },
          { id: "c", projectId: "p1", parentTaskId: "a", title: "Build", owner: "Bo", status: "In Progress", actualProgress: 50, plannedStart: "2025-07-03", plannedEnd: "2025-07-04", dependencyIds: ["b"] },
          { id: "d", projectId: "p1", title: "Go live", isMilestone: true, status: "Not Started", plannedStart: "2025-07-07", plannedEnd: "2025-07-07", dependencyIds: ["c"] },
        ],
      };

      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "converter-"));
      const input = path.join(dir, "plan.xml");
      const output = path.join(dir, "plan.converted.xml");
      fs.writeFileSync(input, buildMsProjectXml(workspace));

      await converter.convertToMsProjectXml(input, output);
      const data = msProjectXmlToPlanner(fs.readFileSync(output, "utf8"), "plan.xml");
      const byTitle = Object.fromEntries(data.tasks.map((task) => [task.title, task]));

      expect(Object.keys(byTitle).sort()).toEqual(["Build", "Design", "Go live", "Phase"]);
      expect(byTitle.Design.parentTaskId).toBe(byTitle.Phase.id);
      expect(byTitle.Build.dependencyIds).toEqual([byTitle.Design.id]);
      expect(byTitle["Go live"].isMilestone).toBe(true);
      expect(byTitle.Design).toMatchObject({ owner: "Ann", status: "Done", plannedStart: "2025-07-01" });
      expect(byTitle.Build.actualProgress).toBe(50);

      fs.rmSync(dir, { recursive: true, force: true });
    },
    10 * 60 * 1000
  );

  it("rejects files that are not project files", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "converter-"));
    const input = path.join(dir, "junk.mpp");
    fs.writeFileSync(input, "this is not a project file");
    await expect(converter.convertToMsProjectXml(input, path.join(dir, "out.xml"))).rejects.toThrow();
    fs.rmSync(dir, { recursive: true, force: true });
  }, 120_000);
});
