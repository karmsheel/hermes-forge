import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const metaPath = path.join(root, "lib", "app-meta.ts");
const content = fs.readFileSync(metaPath, "utf8");
if (!/export const APP_VERSION = "[^"]+";/.test(content)) {
  console.error("Could not find APP_VERSION in lib/app-meta.ts");
  process.exit(1);
}

const next = content.replace(
  /export const APP_VERSION = "[^"]+";/,
  `export const APP_VERSION = "${pkg.version}";`
);

if (next !== content) {
  fs.writeFileSync(metaPath, next);
  console.log(`Synced APP_VERSION to ${pkg.version}`);
}