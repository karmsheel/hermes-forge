import { app, BrowserWindow, shell } from "electron";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const isDev = !app.isPackaged;
const SERVER_PORT = process.env.FORGE_PORT || "3847";

let serverProcess = null;
let mainWindow = null;

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function npxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function getUserDataEnv() {
  const userData = app.getPath("userData");
  const dbPath = path.join(userData, "forge.db");
  const secretPath = path.join(userData, ".auth-secret");

  let authSecret = process.env.AUTH_SECRET;
  if (!authSecret && fs.existsSync(secretPath)) {
    authSecret = fs.readFileSync(secretPath, "utf8").trim();
  }
  if (!authSecret) {
    authSecret = crypto.randomBytes(32).toString("hex");
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(secretPath, authSecret, "utf8");
  }

  return {
    ...process.env,
    DATABASE_URL: `file:${dbPath}`,
    AUTH_SECRET: authSecret,
    PORT: SERVER_PORT,
    HOSTNAME: "127.0.0.1",
    FORGE_DESKTOP: "1",
  };
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: process.platform === "win32",
      ...options,
    });

    child.stdout?.on("data", (chunk) => console.log(`[${command}]`, chunk.toString()));
    child.stderr?.on("data", (chunk) => console.error(`[${command}]`, chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function waitForServer(url, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          res.resume();
          if (res.statusCode && res.statusCode < 500) resolve();
          else reject(new Error(`status ${res.statusCode}`));
        });
        req.on("error", reject);
        req.setTimeout(2000, () => {
          req.destroy(new Error("timeout"));
        });
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function migrateDatabase(env) {
  await runProcess(npxCommand(), ["prisma", "migrate", "deploy"], {
    cwd: ROOT,
    env,
  });
}

function startServer(env) {
  if (isDev) {
    serverProcess = spawn(
      npmCommand(),
      ["run", "dev", "--", "-p", SERVER_PORT, "-H", "127.0.0.1"],
      { cwd: ROOT, env }
    );
    return;
  }

  const serverDir = path.join(ROOT, ".next", "standalone");
  const serverPath = path.join(serverDir, "server.js");
  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: serverDir,
    env,
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    title: "Hermes Forge",
    backgroundColor: "#09090b",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${SERVER_PORT}`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(async () => {
  const env = getUserDataEnv();

  try {
    await migrateDatabase(env);
  } catch (error) {
    console.error("Database migration failed", error);
  }

  startServer(env);
  await waitForServer(`http://127.0.0.1:${SERVER_PORT}`);
  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});