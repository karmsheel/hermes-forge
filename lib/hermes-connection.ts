import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export const DEFAULT_HERMES_HOST = '127.0.0.1';
export const DEFAULT_HERMES_PORT = 8642;

export type HermesConnectionKind =
  | 'reachable'
  | 'auth_failed'
  | 'not_running'
  | 'timeout'
  | 'misconfigured';

export interface HermesEnvConfig {
  apiServerEnabled?: boolean;
  apiServerKey?: string;
  apiServerHost?: string;
  apiServerPort?: number;
}

export interface HermesProbeResult {
  ok: boolean;
  baseUrl: string;
  latencyMs: number;
  model?: string;
  features?: string[];
  error?: string;
  kind?: HermesConnectionKind;
}

export function getHermesHomeDir(): string {
  return process.env.HERMES_HOME || path.join(os.homedir(), '.hermes');
}

export function parseHermesEnv(content: string): HermesEnvConfig {
  const result: HermesEnvConfig = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    switch (key) {
      case 'API_SERVER_ENABLED':
        result.apiServerEnabled = value.toLowerCase() === 'true';
        break;
      case 'API_SERVER_KEY':
        result.apiServerKey = value;
        break;
      case 'API_SERVER_HOST':
        result.apiServerHost = value;
        break;
      case 'API_SERVER_PORT': {
        const port = Number.parseInt(value, 10);
        if (Number.isFinite(port)) result.apiServerPort = port;
        break;
      }
    }
  }

  return result;
}

export async function readHermesEnvFile(): Promise<HermesEnvConfig | null> {
  try {
    const envPath = path.join(getHermesHomeDir(), '.env');
    const content = await fs.readFile(envPath, 'utf-8');
    return parseHermesEnv(content);
  } catch {
    return null;
  }
}

export function buildCandidateUrls(env?: HermesEnvConfig | null): string[] {
  const host = env?.apiServerHost || DEFAULT_HERMES_HOST;
  const port = env?.apiServerPort || DEFAULT_HERMES_PORT;
  const urls = new Set<string>();

  urls.add(`http://${host}:${port}`);
  urls.add(`http://127.0.0.1:${port}`);
  urls.add(`http://localhost:${port}`);

  return [...urls];
}

export async function probeHermesConnection(
  baseUrl: string,
  apiKey: string,
  timeoutMs = 6000
): Promise<HermesProbeResult> {
  const start = Date.now();
  const normalized = baseUrl.replace(/\/$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const healthRes = await fetch(`${normalized}/health`, {
      signal: controller.signal,
    });

    if (!healthRes.ok) {
      clearTimeout(timer);
      return {
        ok: false,
        baseUrl: normalized,
        latencyMs: Date.now() - start,
        kind: 'not_running',
        error: `Hermes returned ${healthRes.status}. Is the gateway running?`,
      };
    }
  } catch (err) {
    clearTimeout(timer);
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      baseUrl: normalized,
      latencyMs: Date.now() - start,
      kind: aborted ? 'timeout' : 'not_running',
      error: aborted
        ? 'Connection timed out. Is Hermes gateway running?'
        : 'Could not reach Hermes. Run `hermes gateway` in your terminal.',
    };
  }

  try {
    const capRes = await fetch(`${normalized}/v1/capabilities`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const latencyMs = Date.now() - start;

    if (capRes.status === 401 || capRes.status === 403) {
      return {
        ok: false,
        baseUrl: normalized,
        latencyMs,
        kind: 'auth_failed',
        error: 'Invalid API key. Check API_SERVER_KEY in ~/.hermes/.env',
      };
    }

    if (!capRes.ok) {
      return {
        ok: false,
        baseUrl: normalized,
        latencyMs,
        kind: 'misconfigured',
        error: `Capabilities check failed (${capRes.status})`,
      };
    }

    const data = (await capRes.json()) as {
      model?: string;
      features?: Record<string, boolean>;
    };

    const features = data.features
      ? Object.entries(data.features)
          .filter(([, enabled]) => enabled === true)
          .map(([name]) => name)
      : [];

    return {
      ok: true,
      baseUrl: normalized,
      latencyMs,
      model: data.model,
      features,
      kind: 'reachable',
    };
  } catch (err) {
    clearTimeout(timer);
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      baseUrl: normalized,
      latencyMs: Date.now() - start,
      kind: aborted ? 'timeout' : 'not_running',
      error: aborted
        ? 'Connection timed out while verifying credentials.'
        : err instanceof Error
          ? err.message
          : 'Probe failed',
    };
  }
}

export async function discoverHermes(): Promise<{
  env: HermesEnvConfig | null;
  envPath: string;
  candidates: string[];
  result: HermesProbeResult;
}> {
  const env = await readHermesEnvFile();
  const envPath = path.join(getHermesHomeDir(), '.env');
  const candidates = buildCandidateUrls(env);

  if (env?.apiServerEnabled === false) {
    return {
      env,
      envPath,
      candidates,
      result: {
        ok: false,
        baseUrl: candidates[0],
        latencyMs: 0,
        kind: 'misconfigured',
        error: 'API server is disabled. Set API_SERVER_ENABLED=true in ~/.hermes/.env',
      },
    };
  }

  const apiKey = env?.apiServerKey;
  if (!apiKey) {
    return {
      env,
      envPath,
      candidates,
      result: {
        ok: false,
        baseUrl: candidates[0],
        latencyMs: 0,
        kind: 'misconfigured',
        error: 'No API_SERVER_KEY found in ~/.hermes/.env',
      },
    };
  }

  let lastResult: HermesProbeResult = {
    ok: false,
    baseUrl: candidates[0],
    latencyMs: 0,
    kind: 'not_running',
    error: 'Could not connect to Hermes on any known address.',
  };

  for (const baseUrl of candidates) {
    const result = await probeHermesConnection(baseUrl, apiKey);
    lastResult = result;
    if (result.ok) {
      return { env, envPath, candidates, result };
    }
  }

  return { env, envPath, candidates, result: lastResult };
}