/**
 * Node custom loader for unit tests: resolves @/* and extensionless .ts relatives.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = process.cwd();

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function resolveWithExt(basePath) {
  const candidates = [
    basePath,
    basePath + ".ts",
    basePath + ".tsx",
    basePath + ".js",
    basePath + ".mjs",
    basePath + ".json",
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.js"),
  ];
  for (const c of candidates) {
    if (exists(c) && fs.statSync(c).isFile()) {
      return pathToFileURL(c).href;
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // @/ → project root
  if (specifier.startsWith("@/")) {
    const abs = path.join(root, specifier.slice(2));
    const resolved = resolveWithExt(abs);
    if (resolved) {
      return { shortCircuit: true, url: resolved };
    }
  }

  // Relative imports from TS files (extensionless)
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL
  ) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const abs = path.resolve(parentDir, specifier);
    const resolved = resolveWithExt(abs);
    if (resolved) {
      return { shortCircuit: true, url: resolved };
    }
  }

  return nextResolve(specifier, context);
}
