import { app, BrowserWindow, shell } from "electron";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const SERVER_PORT = process.env.FORGE_PORT || "3847";

// When packaged, the standalone server is unpacked from the asar.
// Electron rewrites asar paths to .asar.unpacked automatically for
// file system operations, but spawn() needs the real path.
function standaloneDir() {
  if (isDev) return path.join(__dirname, "..", ".next", "standalone");
  // app.getAppPath() -> .../resources/app.asar
  // unpacked files live in .../resources/app.asar.unpacked
  const appPath = app.getAppPath();
  return path.join(appPath.replace("app.asar", "app.asar.unpacked"), ".next", "standalone");
}

// Resolve the Prisma CLI entry point for runtime migrations.
// In packaged mode, prisma is in extraResources (resources/node_modules/prisma).
function prismaCliPath() {
  if (isDev) return null; // use npx in dev
  const resourcesPath = process.resourcesPath;
  return path.join(resourcesPath, "node_modules", "prisma", "build", "index.js");
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
  const isCmd = command.endsWith(".cmd");
  const isExeWithSpaces = process.platform === "win32" && command.endsWith(".exe") && command.includes(" ");
  const needsShell = isCmd || isExeWithSpaces;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: needsShell,
      windowsVerbatimArguments: !needsShell,
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

function startServer(env) {
  if (isDev) {
    serverProcess = spawn(
      npmCommand(),
      ["run", "dev", "--", "-p", SERVER_PORT, "-H", "127.0.0.1"],
      { cwd: path.join(__dirname, ".."), env }
    );
    return;
  }

  const serverDir = standaloneDir();
  const serverPath = path.join(serverDir, "server.js");
  const exeHasSpaces = process.execPath.includes(" ");
  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: serverDir,
    env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
    shell: exeHasSpaces,
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