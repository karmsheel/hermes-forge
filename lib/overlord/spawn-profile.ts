import fs from "fs";
import path from "path";
import { getHermesHome } from "@/lib/cronalytics/paths";
import { scanHermesProfiles } from "@/lib/personnel/scan-hermes-profiles";
import { isValidProfileKey, slugifyProfileKey } from "@/lib/overlord/slug";
import type { ScannedOverlordCandidate } from "@/lib/overlord/types";

export class SpawnProfileError extends Error {
  code: "invalid" | "collision" | "io";

  constructor(message: string, code: "invalid" | "collision" | "io") {
    super(message);
    this.name = "SpawnProfileError";
    this.code = code;
  }
}

function yamlScalar(value: string): string {
  // Quote if needed; keep simple for scanHermesProfiles scalar parser
  if (/[:#\n"']/.test(value) || value.trim() !== value) {
    return JSON.stringify(value);
  }
  return value;
}

export function spawnHermesProfile(opts: {
  displayName: string;
  description?: string | null;
}): ScannedOverlordCandidate {
  const displayName = opts.displayName?.trim() || "";
  if (!displayName) {
    throw new SpawnProfileError("Display name is required", "invalid");
  }

  const profileKey = slugifyProfileKey(displayName);
  if (!isValidProfileKey(profileKey)) {
    throw new SpawnProfileError(
      "Name must produce a valid profile key (not empty or 'default')",
      "invalid",
    );
  }

  const home = getHermesHome();
  const existing = scanHermesProfiles();
  if (existing.some((p) => p.profileKey === profileKey)) {
    throw new SpawnProfileError(`Profile "${profileKey}" already exists`, "collision");
  }

  const profileDir = path.join(home, "profiles", profileKey);
  if (fs.existsSync(profileDir)) {
    throw new SpawnProfileError(`Profile directory already exists: ${profileKey}`, "collision");
  }

  try {
    fs.mkdirSync(profileDir, { recursive: true });
    const lines = [`name: ${yamlScalar(displayName)}`];
    if (opts.description?.trim()) {
      lines.push(`description: ${yamlScalar(opts.description.trim())}`);
    }
    fs.writeFileSync(path.join(profileDir, "profile.yaml"), lines.join("\n") + "\n", "utf8");
    fs.writeFileSync(
      path.join(profileDir, "config.yaml"),
      "# Hermes profile created by Hermes Forge\n",
      "utf8",
    );
  } catch (e) {
    throw new SpawnProfileError(
      e instanceof Error ? e.message : "Failed to write profile",
      "io",
    );
  }

  return {
    profileKey,
    displayName,
    description: opts.description?.trim() || null,
    model: null,
    hermesHome: profileDir,
    isDefault: false,
  };
}
