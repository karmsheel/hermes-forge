export interface N8nCredentialSummary {
  id: string;
  name: string;
  type: string;
}

export interface N8nWorkflowCreateInput {
  name: string;
  nodes: unknown[];
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
  active?: boolean;
}

function apiRoot(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, '');
  if (normalized.endsWith('/api/v1')) return normalized;
  return `${normalized}/api/v1`;
}

export async function probeN8nConnection(
  baseUrl: string,
  apiKey: string
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch(`${apiRoot(baseUrl)}/workflows?limit=1`, {
      headers: { 'X-N8N-API-KEY': apiKey },
    });
    const latencyMs = Date.now() - start;
    if (res.status === 401 || res.status === 403) {
      return { ok: false, latencyMs, error: 'Invalid n8n API key' };
    }
    if (!res.ok) {
      return { ok: false, latencyMs, error: `n8n returned ${res.status}` };
    }
    return { ok: true, latencyMs };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Could not reach n8n',
    };
  }
}

export async function listN8nCredentials(
  baseUrl: string,
  apiKey: string
): Promise<N8nCredentialSummary[]> {
  const res = await fetch(`${apiRoot(baseUrl)}/credentials`, {
    headers: { 'X-N8N-API-KEY': apiKey },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`n8n credentials list failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const items = (data as { data?: unknown[] }).data ?? data;
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const cred = item as { id?: string; name?: string; type?: string };
    return {
      id: String(cred.id ?? ''),
      name: String(cred.name ?? 'Unnamed'),
      type: String(cred.type ?? 'unknown'),
    };
  });
}

export async function createN8nWorkflow(
  baseUrl: string,
  apiKey: string,
  workflow: N8nWorkflowCreateInput
): Promise<{ workflowId: string; editorUrl: string }> {
  const res = await fetch(`${apiRoot(baseUrl)}/workflows`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': apiKey,
    },
    body: JSON.stringify({
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings ?? {},
      active: workflow.active ?? false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`n8n workflow create failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { id?: string };
  const workflowId = String(data.id ?? '');
  if (!workflowId) {
    throw new Error('n8n returned a workflow but no id was found');
  }

  const host = baseUrl.replace(/\/$/, '').replace(/\/api\/v1$/, '');
  return {
    workflowId,
    editorUrl: `${host}/workflow/${workflowId}`,
  };
}