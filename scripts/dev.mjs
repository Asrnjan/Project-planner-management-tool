// `npm run dev`: starts the web app (Vite) and the backend (Claude endpoint
// and file converter) together. Ctrl+C stops both.
//
// Use `npm run dev:web` for the web app alone.

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const backendDir = path.join(root, "backend");
const isWindows = process.platform === "win32";

if (!fs.existsSync(path.join(backendDir, "node_modules"))) {
  console.log("[dev] Installing backend packages (first run only)...");
  const result = spawnSync("npm", ["install", "--no-audit", "--no-fund"], {
    cwd: backendDir,
    stdio: "inherit",
    shell: isWindows,
  });
  if (result.status !== 0) {
    console.error("[dev] Backend install failed; starting the web app only.");
  }
}

const colors = { api: "\x1b[35m", web: "\x1b[36m" };
const reset = "\x1b[0m";
const children = [];

function start(name, command, args, cwd) {
  const child = spawn(command, args, { cwd, env: process.env, stdio: ["inherit", "pipe", "pipe"] });
  const prefix = `${colors[name]}[${name}]${reset} `;
  const forward = (stream, target) => {
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      lines.forEach((line) => target.write(`${prefix}${line}\n`));
    });
  };
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);
  child.on("exit", (code) => {
    if (name === "api" && code) {
      console.log(`${prefix}stopped (exit ${code}). The app still works; .mpp import and Claude need the backend.`);
    }
    if (name === "web") shutdown(code ?? 0);
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  children.forEach((child) => {
    if (child.exitCode === null) child.kill();
  });
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

if (fs.existsSync(path.join(backendDir, "node_modules"))) {
  start(
    "api",
    process.execPath,
    ["server.js"],
    backendDir
  );
}

start("web", process.execPath, [path.join(root, "node_modules", "vite", "bin", "vite.js"), ...process.argv.slice(2)], root);
