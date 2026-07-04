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

function packageDir(nodeModulesRoot, packageName) {
  if (packageName.startsWith("@")) {
    const [scope, name] = packageName.split("/");
    return path.join(nodeModulesRoot, scope, name);
  }
  return path.join(nodeModulesRoot, packageName);
}

function collectPackageDeps(packageName, nodeModulesRoot, collected = new Set()) {
  if (collected.has(packageName)) return collected;
  const pkgRoot = packageDir(nodeModulesRoot, packageName);
  const pkgJsonPath = path.join(pkgRoot, "package.json");
  if (!fs.existsSync(pkgJsonPath)) return collected;

  collected.add(packageName);
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    collectPackageDeps(dep, nodeModulesRoot, collected);
  }
  return collected;
}

function copyPackageTree(packageNames, srcRoot, destRoot) {
  const srcModules = path.join(srcRoot, "node_modules");
  const destModules = path.join(destRoot, "node_modules");
  const packages = new Set();

  for (const packageName of packageNames) {
    collectPackageDeps(packageName, srcModules, packages);
  }

  for (const packageName of packages) {
    const from = packageDir(srcModules, packageName);
    const to = packageDir(destModules, packageName);
    copyDir(from, to);
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

// Runtime Prisma client + query engine for the Next.js server.
copyPackageTree(["@prisma/client"], root, standaloneDir);
copyDir(path.join(root, "node_modules", ".prisma", "client"), path.join(nodeModulesDest, ".prisma", "client"));

// Prisma CLI for migrate deploy — copy the full dependency tree (effect, etc.).
copyPackageTree(["prisma"], root, standaloneDir);

console.log("Standalone bundle prepared for desktop packaging.");