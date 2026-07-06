import os from 'os';
import path from 'path';

/** Root directory for all per-business Git repos. */
export function resolveBusinessesDataRoot(): string {
  const configured = process.env.HERMES_FORGE_DATA_DIR?.trim();
  if (configured) return configured;
  return path.join(os.homedir(), '.hermes-forge', 'businesses');
}

export function resolveBusinessRepoPath(businessId: string): string {
  return path.join(resolveBusinessesDataRoot(), businessId);
}