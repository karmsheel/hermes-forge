import fs from 'fs';
import path from 'path';
import { getHermesHome } from '@/lib/cronalytics/paths';

export interface ScannedHermesProfile {
  profileKey: string;
  displayName: string;
  description: string | null;
  model: string | null;
  hermesHome: string;
  isDefault: boolean;
}

function readTextIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function parseYamlScalar(content: string, key: string): string | null {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(new RegExp(`^${key}\\s*:\\s*(.*)$`));
    if (!match) continue;

    let value = match[1].trim();
    if (!value) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    return value || null;
  }

  return null;
}

function parseModelFromConfig(content: string): string | null {
  const lines = content.split('\n');
  let inModel = false;
  let modelIndent = -1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.search(/\S/);

    if (/^model:\s*$/.test(trimmed)) {
      inModel = true;
      modelIndent = indent;
      continue;
    }

    if (inModel && indent <= modelIndent) {
      inModel = false;
    }

    if (inModel) {
      const defaultMatch = trimmed.match(/^default:\s*(.*)$/);
      if (defaultMatch) {
        let value = defaultMatch[1].trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        return value || null;
      }
    }
  }

  return null;
}

function inspectProfileDir(
  profileKey: string,
  profileHome: string,
  isDefault: boolean
): ScannedHermesProfile | null {
  if (!fs.existsSync(profileHome)) return null;

  const configContent = readTextIfExists(path.join(profileHome, 'config.yaml'));
  const profileYamlContent = readTextIfExists(path.join(profileHome, 'profile.yaml'));

  const description =
    (profileYamlContent && parseYamlScalar(profileYamlContent, 'description')) ||
    (profileYamlContent && parseYamlScalar(profileYamlContent, 'text')) ||
    null;

  const model = configContent ? parseModelFromConfig(configContent) : null;

  return {
    profileKey,
    displayName: isDefault ? 'default' : profileKey,
    description,
    model,
    hermesHome: profileHome,
    isDefault,
  };
}

/**
 * Scan the local Hermes installation for all agent profiles.
 * Includes the default profile (~/.hermes) and any profiles under profiles/.
 */
export function scanHermesProfiles(): ScannedHermesProfile[] {
  const home = getHermesHome();
  const results: ScannedHermesProfile[] = [];

  const defaultProfile = inspectProfileDir('default', home, true);
  if (defaultProfile) {
    results.push(defaultProfile);
  }

  const profilesDir = path.join(home, 'profiles');
  if (!fs.existsSync(profilesDir)) {
    return results;
  }

  const entries = fs.readdirSync(profilesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;

    const profile = inspectProfileDir(
      entry.name,
      path.join(profilesDir, entry.name),
      false
    );
    if (profile) {
      results.push(profile);
    }
  }

  return results.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });
}