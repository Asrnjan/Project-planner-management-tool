// Runs the Java converter (backend/java-mpxj) that turns binary project
// files (.mpp and other formats MPXJ reads) into Microsoft Project XML.
//
// The converter builds itself on first use: it needs Java 17+, and uses
// Maven from MAVEN_HOME or the PATH, falling back to the bundled Maven
// Wrapper (mvnw), which downloads Maven automatically.

const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const PROJECT_DIR = path.join(__dirname, "java-mpxj");
const CLASS_FILE = path.join(PROJECT_DIR, "target", "classes", "com", "planner", "MppToXmlConverter.class");
const DEPENDENCY_DIR = path.join(PROJECT_DIR, "target", "dependency");
const SOURCE_FILES = [
  path.join(PROJECT_DIR, "pom.xml"),
  path.join(PROJECT_DIR, "src", "main", "java", "com", "planner", "MppToXmlConverter.java"),
];
const IS_WINDOWS = process.platform === "win32";
const CONVERT_TIMEOUT_MS = 2 * 60 * 1000;
const BUILD_TIMEOUT_MS = 10 * 60 * 1000;

// Formats MPXJ's UniversalProjectReader understands, besides MS Project XML
// which the browser reads itself.
const CONVERTIBLE_EXTENSIONS = [
  ".mpp", // Microsoft Project
  ".mpt", // Microsoft Project template
  ".mpx", // Microsoft Project exchange
  ".xer", // Primavera P6
  ".pmxml", // Primavera P6 XML
  ".xml", // Primavera P6 / Phoenix / other project XML
  ".gan", // GanttProject
  ".pod", // ProjectLibre
  ".pp", // Asta Powerproject
];

const state = {
  status: "idle", // idle | building | ready | failed | no-java
  message: "",
  log: "",
};

let buildPromise = null;

function quote(value) {
  return /\s/.test(value) ? `"${value}"` : value;
}

function commandWorks(command, args) {
  try {
    // On Windows a shell is needed to find mvn.cmd; pass one command string
    // (passing an args array with shell: true is deprecated in Node).
    const result = IS_WINDOWS
      ? spawnSync([command, ...args].join(" "), { shell: true, stdio: "ignore", timeout: 20_000, windowsHide: true })
      : spawnSync(command, args, { stdio: "ignore", timeout: 20_000 });
    return result.status === 0;
  } catch {
    return false;
  }
}

function findJava() {
  const javaHome = process.env.JAVA_HOME;
  if (javaHome) {
    const candidate = path.join(javaHome, "bin", IS_WINDOWS ? "java.exe" : "java");
    if (fs.existsSync(candidate)) return candidate;
  }
  return commandWorks("java", ["-version"]) ? "java" : null;
}

function findMaven() {
  const mavenHome = process.env.MAVEN_HOME || process.env.M2_HOME;
  if (mavenHome) {
    const candidate = path.join(mavenHome, "bin", IS_WINDOWS ? "mvn.cmd" : "mvn");
    if (fs.existsSync(candidate)) return { command: candidate, args: [] };
  }
  if (commandWorks("mvn", ["-v"])) return { command: "mvn", args: [] };

  // Maven Wrapper: downloads Maven on first run (needs only Java).
  if (IS_WINDOWS) {
    return { command: path.join(PROJECT_DIR, "mvnw.cmd"), args: [] };
  }
  return { command: "sh", args: [path.join(PROJECT_DIR, "mvnw")] };
}

function isBuilt() {
  if (!fs.existsSync(CLASS_FILE) || !fs.existsSync(DEPENDENCY_DIR)) return false;
  const jars = fs.readdirSync(DEPENDENCY_DIR).filter((file) => file.endsWith(".jar"));
  if (!jars.length) return false;

  // Rebuild when the converter source or its dependencies changed.
  const builtAt = fs.statSync(CLASS_FILE).mtimeMs;
  return SOURCE_FILES.every((file) => !fs.existsSync(file) || fs.statSync(file).mtimeMs <= builtAt);
}

function run(command, args, { cwd, timeout, env }) {
  return new Promise((resolve, reject) => {
    // Windows needs a shell to run .cmd files (mvn.cmd, mvnw.cmd).
    const useShell = IS_WINDOWS && /\.(cmd|bat)$|^mvn$/i.test(command);
    const options = { cwd, env: env || process.env, windowsHide: true };
    const child = useShell
      ? spawn([quote(command), ...args.map(quote)].join(" "), { ...options, shell: true })
      : spawn(command, args, options);

    let output = "";
    const append = (chunk) => {
      output = (output + chunk.toString()).slice(-8000);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Timed out after ${Math.round(timeout / 1000)}s.\n${output}`));
    }, timeout);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`${error.message}\n${output}`));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else reject(new Error(output.trim() || `Exited with code ${code}`));
    });
  });
}

/** Builds the converter if needed. Concurrent callers share one build. */
function ensureBuilt() {
  if (isBuilt()) {
    state.status = "ready";
    state.message = "";
    return Promise.resolve();
  }
  if (buildPromise) return buildPromise;

  const java = findJava();
  if (!java) {
    state.status = "no-java";
    state.message =
      "Java 17 or newer is required to read .mpp files. Install it (for example from adoptium.net), then restart the backend.";
    return Promise.reject(new Error(state.message));
  }

  const maven = findMaven();
  state.status = "building";
  state.message = "Preparing the .mpp converter (first run only, can take a few minutes)...";
  console.log(`[converter] ${state.message}`);

  // Make sure mvnw (and JAVA_HOME for it) work when Java came from PATH.
  const env = { ...process.env };
  if (!env.JAVA_HOME && java !== "java") env.JAVA_HOME = path.dirname(path.dirname(java));

  buildPromise = run(
    maven.command,
    [...maven.args, "-q", "-B", "compile", "dependency:copy-dependencies", "-DincludeScope=runtime"],
    { cwd: PROJECT_DIR, timeout: BUILD_TIMEOUT_MS, env }
  )
    .then(() => {
      if (!fs.existsSync(CLASS_FILE)) throw new Error("Build finished but the converter class was not created.");
      // Touch the class file so isBuilt() sees it as newer than the sources.
      const now = new Date();
      fs.utimesSync(CLASS_FILE, now, now);
      state.status = "ready";
      state.message = "";
      console.log("[converter] Ready.");
    })
    .catch((error) => {
      state.status = "failed";
      state.message = "The .mpp converter could not be built. See the backend console for details.";
      state.log = String(error.message || error).slice(-4000);
      console.error(`[converter] Build failed:\n${state.log}`);
      throw new Error(state.message);
    })
    .finally(() => {
      buildPromise = null;
    });

  return buildPromise;
}

/** Converts a project file to Microsoft Project XML (MSPDI). */
async function convertToMsProjectXml(inputPath, outputPath) {
  await ensureBuilt();

  const java = findJava();
  const jars = fs
    .readdirSync(DEPENDENCY_DIR)
    .filter((file) => file.toLowerCase().endsWith(".jar"))
    .map((file) => path.join(DEPENDENCY_DIR, file));
  const classpath = [path.join(PROJECT_DIR, "target", "classes"), ...jars].join(path.delimiter);

  try {
    await run(java, ["-cp", classpath, "com.planner.MppToXmlConverter", inputPath, outputPath], {
      cwd: PROJECT_DIR,
      timeout: CONVERT_TIMEOUT_MS,
    });
  } catch (error) {
    const detail = String(error.message || "");
    if (/password|encrypt/i.test(detail)) {
      throw new Error("This project file is password protected. Remove the password in Microsoft Project and try again.");
    }
    if (/unsupported|not supported|unrecognized|unknown file/i.test(detail)) {
      throw new Error("This file format isn't supported by the converter.");
    }
    console.error(`[converter] Conversion failed:\n${detail.slice(-4000)}`);
    throw new Error("The file could not be converted. It may be damaged or from an unsupported version.");
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error("The converter did not produce any output.");
  }
}

function getConverterStatus() {
  if (state.status !== "building" && state.status !== "failed" && isBuilt()) {
    state.status = "ready";
  }
  return {
    status: state.status,
    message: state.message,
    extensions: CONVERTIBLE_EXTENSIONS,
  };
}

module.exports = {
  CONVERTIBLE_EXTENSIONS,
  convertToMsProjectXml,
  ensureBuilt,
  getConverterStatus,
  isBuilt,
};
