import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { execFile, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

function resolveServerPort() {
  const arg = process.argv.find((entry) => entry.startsWith("--forge-port="));
  if (arg) return arg.slice("--forge-port=".length);
  return process.env.FORGE_PORT || "3847";
}

const SERVER_PORT = resolveServerPort();

// Packaged builds copy the Next standalone bundle to resources/standalone
// (outside the asar) so electron-builder does not strip nested node_modules.
function standaloneDir() {
  if (isDev) return path.join(__dirname, "..", ".next", "standalone");
  return path.join(process.resourcesPath, "standalone");
}

function prismaCliPath() {
  if (isDev) return null; // use npx in dev
  return path.join(standaloneDir(), "node_modules", "prisma", "build", "index.js");
}

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

  // Ensure System32 is on PATH so cmd.exe and other system tools are resolvable.
  const system32 = path.join(process.env.SystemRoot || "C:\\WINDOWS", "system32");
  const pathSep = process.platform === "win32" ? ";" : ":";
  const envPath = process.env.PATH || "";
  const fullPath = envPath.includes(system32) ? envPath : system32 + pathSep + envPath;

  return {
    ...process.env,
    PATH: fullPath,
    DATABASE_URL: `file:${dbPath}`,
    AUTH_SECRET: authSecret,
    PORT: SERVER_PORT,
    HOSTNAME: "127.0.0.1",
    FORGE_DESKTOP: "1",
  };
}

function runProcess(command, args, options = {}) {
  // execFile uses CreateProcessW directly on Windows — no cmd.exe needed,
  // and it handles spaces in the exe path correctly.
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, {
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
      ...options,
    });

    child.stdout?.on("data", (chunk) => console.log(`[${path.basename(command)}]`, chunk.toString()));
    child.stderr?.on("data", (chunk) => console.error(`[${path.basename(command)}]`, chunk.toString()));
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
  if (isDev) {
    await runProcess(npxCommand(), ["prisma", "migrate", "deploy"], {
      cwd: path.join(__dirname, ".."),
      env,
    });
    return;
  }
  // In packaged mode, run prisma CLI directly with Electron's bundled Node.
  // ELECTRON_RUN_AS_NODE makes the Electron exe behave as plain Node.js.
  const cli = prismaCliPath();
  const schemaPath = path.join(standaloneDir(), "prisma", "schema.prisma");
  await runProcess(process.execPath, [cli, "migrate", "deploy", "--schema", schemaPath], {
    cwd: standaloneDir(),
    env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
  });
}

function attachServerLogs(child, label = "server") {
  child.stdout?.on("data", (chunk) => console.log(`[${label}]`, chunk.toString()));
  child.stderr?.on("data", (chunk) => console.error(`[${label}]`, chunk.toString()));
  child.on("error", (error) => console.error(`[${label}] failed to start`, error));
}

function startServer(env) {
  if (isDev) {
    serverProcess = spawn(
      npmCommand(),
      ["run", "dev", "--", "-p", SERVER_PORT, "-H", "127.0.0.1"],
      { cwd: path.join(__dirname, ".."), env }
    );
    attachServerLogs(serverProcess);
    return;
  }

  const serverDir = standaloneDir();
  const serverPath = path.join(serverDir, "server.js");
  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: serverDir,
    env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  attachServerLogs(serverProcess);
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
    startServer(env);
    await waitForServer(`http://127.0.0.1:${SERVER_PORT}`);
    createWindow();
  } catch (error) {
    console.error("Desktop startup failed", error);
    dialog.showErrorBox(
      "Hermes Forge",
      `Failed to start the desktop app.\n\n${error instanceof Error ? error.message : String(error)}`
    );
    app.quit();
  }
});

ipcMain.handle("theme:open-vscode-file", async () => {
  const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
  const result = await dialog.showOpenDialog(win ?? undefined, {
    title: "Open VS Code color theme",
    filters: [{ name: "VS Code themes", extensions: ["json"] }],
    properties: ["openFile"],
  });

  if (result.canceled || !result.filePaths[0]) return null;
  return fs.readFileSync(result.filePaths[0], "utf8");
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