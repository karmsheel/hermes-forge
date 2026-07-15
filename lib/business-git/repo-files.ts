/**
 * Pure helpers for reading a materialized Hermes Forge business Git repo.
 * Safe for unit tests (no Prisma / no git binary).
 */

import fs from 'fs/promises';
import path from 'path';
import type {
  BusinessRepoManifestV1,
  ConversationExportMetaV1,
} from '@/lib/business-git/types';

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function readTextFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

export async function readNdjsonFile<T>(filePath: string): Promise<T[]> {
  const raw = await readTextFile(filePath);
  if (!raw?.trim()) return [];
  const out: T[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as T);
    } catch {
      // skip corrupt lines
    }
  }
  return out;
}

export function isBusinessRepoManifest(value: unknown): value is BusinessRepoManifestV1 {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  return (
    m.version === 1 &&
    typeof m.businessId === 'string' &&
    typeof m.businessName === 'string' &&
    typeof m.logHeadSequence === 'number'
  );
}

export interface ParsedBusinessSnapshot {
  id?: string;
  name: string;
  industry?: string | null;
  description?: string | null;
  teamSize?: number | null;
  website?: string | null;
  goals?: string | null;
  constraints?: string | null;
}

export interface ParsedPersonnelHuman {
  id?: string;
  name: string;
  role: string;
  roleDescription?: string | null;
  isOwner?: boolean;
  userId?: string | null;
  iconKey?: string | null;
}

export interface ParsedPersonnelAgent {
  id?: string;
  profileKey: string;
  displayName: string;
  description?: string | null;
  model?: string | null;
  hermesHome?: string;
  isDefault?: boolean;
  iconKey?: string | null;
  isHired?: boolean;
  hiredAt?: string | null;
}

export interface ParsedPersonnelFile {
  humans: ParsedPersonnelHuman[];
  agents: ParsedPersonnelAgent[];
}

export function parsePersonnelFile(data: unknown): ParsedPersonnelFile {
  if (!data || typeof data !== 'object') {
    return { humans: [], agents: [] };
  }
  const root = data as Record<string, unknown>;
  const humansRaw = Array.isArray(root.humans) ? root.humans : [];
  const agentsRaw = Array.isArray(root.agents) ? root.agents : [];

  const humans: ParsedPersonnelHuman[] = [];
  for (const h of humansRaw) {
    if (!h || typeof h !== 'object') continue;
    const row = h as Record<string, unknown>;
    if (typeof row.name !== 'string' || !row.name.trim()) continue;
    humans.push({
      id: typeof row.id === 'string' ? row.id : undefined,
      name: row.name.trim(),
      role: typeof row.role === 'string' && row.role.trim() ? row.role.trim() : 'Team member',
      roleDescription: typeof row.roleDescription === 'string' ? row.roleDescription : null,
      isOwner: Boolean(row.isOwner),
      userId: typeof row.userId === 'string' ? row.userId : null,
      iconKey: typeof row.iconKey === 'string' ? row.iconKey : null,
    });
  }

  const agents: ParsedPersonnelAgent[] = [];
  for (const a of agentsRaw) {
    if (!a || typeof a !== 'object') continue;
    const row = a as Record<string, unknown>;
    const profileKey =
      typeof row.profileKey === 'string' && row.profileKey.trim()
        ? row.profileKey.trim()
        : typeof row.id === 'string'
          ? row.id
          : null;
    const displayName =
      typeof row.displayName === 'string' && row.displayName.trim()
        ? row.displayName.trim()
        : profileKey;
    if (!profileKey || !displayName) continue;
    agents.push({
      id: typeof row.id === 'string' ? row.id : undefined,
      profileKey,
      displayName,
      description: typeof row.description === 'string' ? row.description : null,
      model: typeof row.model === 'string' ? row.model : null,
      hermesHome: typeof row.hermesHome === 'string' ? row.hermesHome : '',
      isDefault: Boolean(row.isDefault),
      iconKey: typeof row.iconKey === 'string' ? row.iconKey : null,
      isHired: Boolean(row.isHired),
      hiredAt: typeof row.hiredAt === 'string' ? row.hiredAt : null,
    });
  }

  return { humans, agents };
}

export interface ParsedDocumentIndexEntry {
  id?: string;
  title: string;
  kind: string;
  slug: string;
  pinnedForContext?: boolean;
  sortOrder?: number;
  source?: string;
}

export function parseDocumentIndex(data: unknown): ParsedDocumentIndexEntry[] {
  if (!Array.isArray(data)) return [];
  const out: ParsedDocumentIndexEntry[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.slug !== 'string' || !row.slug.trim()) continue;
    if (typeof row.title !== 'string' || !row.title.trim()) continue;
    out.push({
      id: typeof row.id === 'string' ? row.id : undefined,
      title: row.title.trim(),
      kind: typeof row.kind === 'string' && row.kind.trim() ? row.kind.trim() : 'freeform',
      slug: row.slug.trim(),
      pinnedForContext: Boolean(row.pinnedForContext),
      sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : 0,
      source: typeof row.source === 'string' ? row.source : 'import',
    });
  }
  return out;
}

export interface ParsedProcessMeta {
  id?: string;
  name: string;
  description?: string;
  department?: string;
  trigger?: string | null;
  inputs?: string | null;
  outputs?: string | null;
  manualSteps?: string | null;
  automationScore?: number;
  estimatedTimeSaved?: number | null;
  repetition?: number | null;
  businessValue?: number | null;
  complexity?: number | null;
  status?: string;
  approvedAt?: string | null;
  nameStatus?: string;
  ioShape?: string;
}

export function parseProcessMeta(data: unknown, fallbackId: string): ParsedProcessMeta | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  const name =
    typeof row.name === 'string' && row.name.trim()
      ? row.name.trim()
      : `Process ${fallbackId.slice(0, 8)}`;
  return {
    id: typeof row.id === 'string' ? row.id : fallbackId,
    name,
    description: typeof row.description === 'string' ? row.description : '',
    department:
      typeof row.department === 'string' && row.department.trim()
        ? row.department.trim()
        : 'Operations',
    trigger: typeof row.trigger === 'string' ? row.trigger : null,
    inputs: typeof row.inputs === 'string' ? row.inputs : null,
    outputs: typeof row.outputs === 'string' ? row.outputs : null,
    manualSteps: typeof row.manualSteps === 'string' ? row.manualSteps : null,
    automationScore: typeof row.automationScore === 'number' ? row.automationScore : 0,
    estimatedTimeSaved:
      typeof row.estimatedTimeSaved === 'number' ? row.estimatedTimeSaved : null,
    repetition: typeof row.repetition === 'number' ? row.repetition : null,
    businessValue: typeof row.businessValue === 'number' ? row.businessValue : null,
    complexity: typeof row.complexity === 'number' ? row.complexity : null,
    status: typeof row.status === 'string' ? row.status : 'mapping',
    approvedAt: typeof row.approvedAt === 'string' ? row.approvedAt : null,
    nameStatus: typeof row.nameStatus === 'string' ? row.nameStatus : 'confirmed',
    ioShape: typeof row.ioShape === 'string' ? row.ioShape : 'siso',
  };
}

export interface ParsedChatMessage {
  id?: string;
  role: string;
  content: string;
  createdAt?: string;
}

export function parseChatMessages(rows: unknown[]): ParsedChatMessage[] {
  const out: ParsedChatMessage[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const m = row as Record<string, unknown>;
    if (typeof m.content !== 'string' || !m.content) continue;
    const role = m.role === 'assistant' || m.role === 'user' ? m.role : null;
    if (!role) continue;
    out.push({
      id: typeof m.id === 'string' ? m.id : undefined,
      role,
      content: m.content,
      createdAt: typeof m.createdAt === 'string' ? m.createdAt : undefined,
    });
  }
  return out;
}

export function parseConversationIndex(data: unknown): ConversationExportMetaV1[] {
  if (!Array.isArray(data)) return [];
  const out: ConversationExportMetaV1[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string') continue;
    out.push({
      id: row.id,
      title: typeof row.title === 'string' && row.title.trim() ? row.title.trim() : 'Main',
      kind: typeof row.kind === 'string' ? row.kind : 'process',
      forkedFromId: typeof row.forkedFromId === 'string' ? row.forkedFromId : null,
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(0).toISOString(),
      updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date(0).toISOString(),
    });
  }
  return out;
}

export async function listProcessDirs(repoPath: string): Promise<string[]> {
  const processesDir = path.join(repoPath, 'processes');
  if (!(await pathExists(processesDir))) return [];
  const entries = await fs.readdir(processesDir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

export async function listConversationNdjson(
  processDir: string
): Promise<{ conversationId: string; filePath: string }[]> {
  const convDir = path.join(processDir, 'conversations');
  if (!(await pathExists(convDir))) return [];
  const entries = await fs.readdir(convDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.ndjson'))
    .map((e) => ({
      conversationId: e.name.replace(/\.ndjson$/, ''),
      filePath: path.join(convDir, e.name),
    }));
}
