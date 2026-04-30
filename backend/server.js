const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const xml2js = require("xml2js");

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json({ limit: "25mb" }));

const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

function safeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getText(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (Array.isArray(value)) return getText(value[0], fallback);
  if (typeof value === "object" && "_" in value) return String(value._ || fallback);
  return String(value || fallback);
}

function msProjectDateToDateOnly(value) {
  if (!value) return "";
  const text = String(value);
  if (!text) return "";
  return text.slice(0, 10);
}

function dateOnlyToMsProjectDate(value) {
  if (!value) return "";
  return `${value}T09:00:00`;
}

function mapPercent(value) {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(100, num));
}

function normalizeStatus(percentComplete) {
  const percent = mapPercent(percentComplete);

  if (percent >= 100) return "Done";
  if (percent > 0) return "In Progress";
  return "Not Started";
}

function makeTaskId(index) {
  return `task-import-${Date.now()}-${index}`;
}

function runMppToXmlConverter(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const javaProjectDir = path.join(__dirname, "java-mpxj");

    const javaHome =
      "C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.18.8-hotspot";

    const javaExe = path.join(javaHome, "bin", "java.exe");

    const targetClasses = path.join(javaProjectDir, "target", "classes");
    const dependencyDir = path.join(javaProjectDir, "target", "dependency");

    if (!fs.existsSync(javaExe)) {
      reject(new Error(`Java 17 not found at: ${javaExe}`));
      return;
    }

    if (!fs.existsSync(targetClasses)) {
      reject(
        new Error(
          "Java classes not found. Run Maven compile first inside backend\\java-mpxj."
        )
      );
      return;
    }

    if (!fs.existsSync(dependencyDir)) {
      reject(
        new Error(
          "Dependency jars not found. Run: C:\\Tools\\apache-maven-4.0.0-rc-5\\bin\\mvn.cmd -q compile dependency:copy-dependencies inside backend\\java-mpxj."
        )
      );
      return;
    }

    const dependencyJars = fs
      .readdirSync(dependencyDir)
      .filter((file) => file.toLowerCase().endsWith(".jar"))
      .map((file) => path.join(dependencyDir, file));

    const classpath = [targetClasses, ...dependencyJars].join(";");

    const args = [
      "-cp",
      classpath,
      "com.planner.MppToXmlConverter",
      inputPath,
      outputPath,
    ];

    const child = spawn(javaExe, args, {
      cwd: javaProjectDir,
      shell: false,
      windowsHide: true,
      env: {
        ...process.env,
        JAVA_HOME: javaHome,
        PATH: `${path.join(javaHome, "bin")};${process.env.PATH}`,
      },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      reject(new Error(`Could not run Java converter. ${error.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new Error(
            stderr ||
              stdout ||
              "MPP conversion failed. Please check if the .mpp file is valid."
          )
        );
      }
    });
  });
}

function projectXmlToPlannerData(xmlObject) {
  const projectRoot = xmlObject.Project || xmlObject.project;

  if (!projectRoot) {
    throw new Error("Invalid MS Project XML. Project root node not found.");
  }

  const rawTasks = safeArray(projectRoot.Tasks?.[0]?.Task);

  const uidToTaskId = {};
  const tempTasks = [];
  const parentByOutlineLevel = {};

  rawTasks.forEach((task, index) => {
    const uid = getText(task.UID);
    const idValue = getText(task.ID);
    const name = getText(task.Name);

    const isNull =
      getText(task.IsNull) === "1" ||
      getText(task.IsNull).toLowerCase() === "true";

    if (isNull) return;
    if (!name || !name.trim()) return;

    const id = makeTaskId(index);
    uidToTaskId[uid] = id;

    const outlineLevelRaw = getText(task.OutlineLevel, "1");
    const outlineLevel = Number(outlineLevelRaw) || 1;
    const outlineNumber = getText(task.OutlineNumber, "");

    const plannedStart = msProjectDateToDateOnly(getText(task.Start));
    const plannedEnd = msProjectDateToDateOnly(getText(task.Finish));
    const percentComplete = mapPercent(getText(task.PercentComplete));

    const milestoneFlag =
      getText(task.Milestone) === "1" ||
      getText(task.Milestone).toLowerCase() === "true";

    const summaryFlag =
      getText(task.Summary) === "1" ||
      getText(task.Summary).toLowerCase() === "true";

    const parentTaskId =
      outlineLevel > 1 && parentByOutlineLevel[outlineLevel - 1]
        ? parentByOutlineLevel[outlineLevel - 1]
        : "";

    const dependencyIds = safeArray(task.PredecessorLink).map((link) => {
      const predecessorUid = getText(link.PredecessorUID);
      return predecessorUid;
    });

    const importedTask = {
      id,
      externalUid: uid,
      externalId: idValue,
      outlineLevel,
      outlineNumber,
      projectId: "",
      sprintId: "",
      parentTaskId,
      dependencyIds,
      title: name || `Imported Task ${index + 1}`,
      owner: "",
      priority: "Medium",
      status: normalizeStatus(percentComplete),
      plannedStart,
      plannedEnd,
      actualStart: msProjectDateToDateOnly(getText(task.ActualStart)),
      actualEnd: msProjectDateToDateOnly(getText(task.ActualFinish)),
      baselineStart: "",
      baselineEnd: "",
      plannedProgress: percentComplete,
      actualProgress: percentComplete,
      isMilestone: milestoneFlag,
      isSummary: summaryFlag,
    };

    tempTasks.push(importedTask);

    parentByOutlineLevel[outlineLevel] = id;

    Object.keys(parentByOutlineLevel).forEach((levelKey) => {
      if (Number(levelKey) > outlineLevel) {
        delete parentByOutlineLevel[levelKey];
      }
    });
  });

  const resolvedTasks = tempTasks.map((task) => ({
    ...task,
    dependencyIds: task.dependencyIds
      .map((externalUid) => uidToTaskId[externalUid])
      .filter(Boolean),
  }));

  const projectName =
    getText(projectRoot.Name) ||
    getText(projectRoot.Title) ||
    "Imported MS Project Plan";

  const projectId = `project-import-${Date.now()}`;

  const tasksWithProject = resolvedTasks.map((task) => ({
    ...task,
    projectId,
  }));

  const projectDates = tasksWithProject
    .flatMap((task) => [task.plannedStart, task.plannedEnd])
    .filter(Boolean)
    .sort();

  const project = {
    id: projectId,
    name: projectName,
    owner: "",
    description:
      "Imported from Microsoft Project file with task hierarchy and subtasks.",
    status: "Active",
    startDate: projectDates[0] || "",
    targetEndDate: projectDates[projectDates.length - 1] || "",
  };

  return {
    projects: [project],
    tasks: tasksWithProject,
    sprints: [],
    plannerSettings: {
      schedulingMode: "manual",
    },
    baselineSnapshots: [],
  };
}

function plannerDataToProjectXml(payload) {
  const projects = Array.isArray(payload.projects) ? payload.projects : [];
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];

  const firstProject = projects[0] || {
    name: "Planner Export",
    startDate: "",
    targetEndDate: "",
  };

  const taskUidMap = {};
  tasks.forEach((task, index) => {
    taskUidMap[task.id] = index + 1;
  });

  const xmlTasks = tasks.map((task, index) => {
    const uid = index + 1;
    const dependencyIds = Array.isArray(task.dependencyIds)
      ? task.dependencyIds
      : [];

    const predecessorLinks = dependencyIds
      .filter((dependencyId) => taskUidMap[dependencyId])
      .map((dependencyId) => ({
        PredecessorUID: taskUidMap[dependencyId],
        Type: 1,
      }));

    const item = {
      UID: uid,
      ID: uid,
      Name: task.title || `Task ${uid}`,
      Type: 1,
      IsNull: 0,
      CreateDate: new Date().toISOString(),
      WBS: String(uid),
      OutlineNumber: String(uid),
      OutlineLevel: 1,
      Priority: 500,
      Start: dateOnlyToMsProjectDate(task.plannedStart),
      Finish: dateOnlyToMsProjectDate(task.plannedEnd),
      Duration: "PT8H0M0S",
      Manual: 1,
      Milestone: task.isMilestone ? 1 : 0,
      PercentComplete: mapPercent(task.plannedProgress),
      Notes: task.owner ? `Owner: ${task.owner}` : "",
    };

    if (predecessorLinks.length) {
      item.PredecessorLink = predecessorLinks;
    }

    return item;
  });

  const projectXmlObject = {
    Project: {
      $: {
        xmlns: "http://schemas.microsoft.com/project",
      },
      SaveVersion: 14,
      Name: firstProject.name || "Planner Export",
      Title: firstProject.name || "Planner Export",
      Subject: "Exported from Project Planner & Tracker",
      Author: "Project Planner & Tracker",
      CreationDate: new Date().toISOString(),
      ScheduleFromStart: 1,
      StartDate: dateOnlyToMsProjectDate(firstProject.startDate),
      FinishDate: dateOnlyToMsProjectDate(firstProject.targetEndDate),
      CurrentDate: new Date().toISOString(),
      CalendarUID: 1,
      DefaultStartTime: "09:00:00",
      DefaultFinishTime: "17:00:00",
      MinutesPerDay: 480,
      MinutesPerWeek: 2400,
      DaysPerMonth: 20,
      Tasks: {
        Task: xmlTasks,
      },
      Resources: "",
      Assignments: "",
    },
  };

  const builder = new xml2js.Builder({
    headless: false,
    renderOpts: {
      pretty: true,
      indent: "  ",
      newline: "\n",
    },
  });

  return builder.buildObject(projectXmlObject);
}

async function readXmlFileAsPlannerData(xmlPath) {
  const xmlContent = fs.readFileSync(xmlPath, "utf8");

  const parser = new xml2js.Parser({
    explicitArray: true,
    mergeAttrs: false,
    normalizeTags: false,
  });

  const parsed = await parser.parseStringPromise(xmlContent);
  return projectXmlToPlannerData(parsed);
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "planner-ms-project-backend",
    message: "Backend is running.",
  });
});

app.post("/api/import/msproject", upload.single("file"), async (req, res) => {
  let uploadedPath = "";
  let convertedXmlPath = "";

  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded.",
      });
    }

    uploadedPath = req.file.path;

    const originalName = req.file.originalname || "";
    const ext = path.extname(originalName).toLowerCase();

    if (ext !== ".xml" && ext !== ".mpp") {
      return res.status(400).json({
        error: "Unsupported file type. Please upload .mpp or MS Project .xml file.",
      });
    }

    let plannerData;

    if (ext === ".xml") {
      plannerData = await readXmlFileAsPlannerData(uploadedPath);
    }

    if (ext === ".mpp") {
      convertedXmlPath = `${uploadedPath}.converted.xml`;

      await runMppToXmlConverter(uploadedPath, convertedXmlPath);

      plannerData = await readXmlFileAsPlannerData(convertedXmlPath);
    }

    res.json({
      ok: true,
      plannerData,
    });
  } catch (error) {
    res.status(500).json({
      error:
        error.message ||
        "Failed to import Microsoft Project file. Please check the file and try again.",
    });
  } finally {
    if (uploadedPath && fs.existsSync(uploadedPath)) {
      fs.unlinkSync(uploadedPath);
    }

    if (convertedXmlPath && fs.existsSync(convertedXmlPath)) {
      fs.unlinkSync(convertedXmlPath);
    }
  }
});

app.post("/api/export/msproject", async (req, res) => {
  try {
    const xml = plannerDataToProjectXml(req.body || {});

    const filename = `${String(req.body?.name || "planner-export")
      .replace(/[^a-z0-9-_]/gi, "_")
      .toLowerCase()}.xml`;

    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(xml);
  } catch (error) {
    res.status(500).json({
      error: error.message || "Failed to export MS Project XML.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`MS Project backend running on http://localhost:${PORT}`);
});