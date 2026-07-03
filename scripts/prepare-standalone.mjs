import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneDir = path.join(root, ".next", "standalone");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

if (!fs.existsSync(standaloneDir)) {
  console.error("Missing .next/standalone — run `npm run build` first.");
  process.exit(1);
}

copyDir(path.join(root, "public"), path.join(standaloneDir, "public"));
copyDir(path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static"));
copyDir(path.join(root, "prisma"), path.join(standaloneDir, "prisma"));

// Copy Prisma Client and query engine into standalone for runtime access
// The standalone server runs with ELECTRON_RUN_AS_NODE=1 and needs to find
// @prisma/client and the query engine binary at runtime.
const nodeModulesDest = path.join(standaloneDir, "node_modules");
fs.mkdirSync(nodeModulesDest, { recursive: true });

// Copy @prisma/client (generated client + runtime)
copyDir(path.join(root, "node_modules", "@prisma", "client"), path.join(nodeModulesDest, "@prisma", "client"));

// Copy .prisma/client (query engine binary + runtime files)
copyDir(path.join(root, "node_modules", ".prisma", "client"), path.join(nodeModulesDest, ".prisma", "client"));

// Copy prisma package (CLI for migrations)
copyDir(path.join(root, "node_modules", "prisma"), path.join(nodeModulesDest, "prisma"));

// Copy @prisma/engines (query engine binaries)
copyDir(path.join(root, "node_modules", "@prisma", "engines"), path.join(nodeModulesDest, "@prisma", "engines"));

console.log("Standalone bundle prepared for desktop packaging.");