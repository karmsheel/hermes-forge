export interface HermesJobCreateInput {
  schedule: string;
  prompt: string;
  name: string;
  deliver?: string;
}

/** Normalized job summary from Hermes list/get responses. */
export interface HermesJobSummary {
  id: string;
  name?: string;
  schedule?: string;
  status?: string;
  prompt?: string;
  /** Last run outcome if Hermes provides it (success/failed/error/…). */
  lastStatus?: string | null;
  lastError?: string | null;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  enabled?: boolean;
  raw?: unknown;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}

function authHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

/** Pull a string field from several common key shapes. */
function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) {
      // Unix seconds or ms timestamps → ISO when looking like epoch
      if (key.toLowerCase().includes('at') || key.toLowerCase().includes('time')) {
        const ms = v > 1e12 ? v : v * 1000;
        if (ms > 1e11) return new Date(ms).toISOString();
      }
      return String(v);
    }
  }
  return undefined;
}

function pickBool(obj: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'boolean') return v;
  }
  return undefined;
}

/**
 * Normalize a raw Hermes job object into HermesJobSummary.
 * Tolerant of snake_case / camelCase and nested `job` / `last_run` wrappers.
 */
export function normalizeHermesJob(raw: unknown): HermesJobSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  const job =
    root.job && typeof root.job === 'object'
      ? (root.job as Record<string, unknown>)
      : root;
  const lastRun =
    (job.last_run && typeof job.last_run === 'object'
      ? (job.last_run as Record<string, unknown>)
      : null) ??
    (job.lastRun && typeof job.lastRun === 'object'
      ? (job.lastRun as Record<string, unknown>)
      : null) ??
    (root.last_run && typeof root.last_run === 'object'
      ? (root.last_run as Record<string, unknown>)
      : null);

  const id =
    pickString(job, ['id', 'job_id', 'jobId']) ??
    pickString(root, ['id', 'job_id', 'jobId']);
  if (!id) return null;

  const status =
    pickString(job, ['status', 'state', 'job_status']) ??
    pickString(root, ['status', 'state']);

  const lastStatus =
    pickString(job, ['last_status', 'lastStatus', 'last_run_status', 'lastRunStatus']) ??
    (lastRun
      ? pickString(lastRun, ['status', 'state', 'outcome', 'result'])
      : undefined) ??
    null;

  const lastError =
    pickString(job, ['last_error', 'lastError', 'error']) ??
    (lastRun ? pickString(lastRun, ['error', 'message', 'end_reason', 'endReason']) : undefined) ??
    null;

  const lastRunAt =
    pickString(job, ['last_run_at', 'lastRunAt', 'last_run_time', 'lastRunTime']) ??
    (lastRun
      ? pickString(lastRun, ['at', 'run_time', 'runTime', 'ended_at', 'endedAt', 'started_at', 'startedAt'])
      : undefined) ??
    null;

  const nextRunAt =
    pickString(job, ['next_run_at', 'nextRunAt', 'next_run', 'nextRun']) ?? null;

  const enabled = pickBool(job, ['enabled', 'active']) ?? pickBool(root, ['enabled', 'active']);

  return {
    id,
    name: pickString(job, ['name', 'title']) ?? pickString(root, ['name', 'title']),
    schedule: pickString(job, ['schedule', 'cron', 'schedule_display', 'scheduleDisplay']),
    status,
    prompt: pickString(job, ['prompt', 'message']),
    lastStatus,
    lastError,
    lastRunAt,
    nextRunAt,
    enabled,
    raw,
  };
}

export async function listHermesJobs(
  baseUrl: string,
  apiKey: string
): Promise<HermesJobSummary[]> {
  const res = await fetch(`${normalizeBaseUrl(baseUrl)}/api/jobs`, {
    headers: authHeaders(apiKey),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hermes jobs list failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const arr: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.jobs)
      ? data.jobs
      : [];
  return arr
    .map((item) => normalizeHermesJob(item))
    .filter((j): j is HermesJobSummary => Boolean(j));
}

export async function getHermesJob(
  baseUrl: string,
  apiKey: string,
  jobId: string
): Promise<HermesJobSummary> {
  const res = await fetch(
    `${normalizeBaseUrl(baseUrl)}/api/jobs/${encodeURIComponent(jobId)}`,
    { headers: authHeaders(apiKey) }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hermes job get failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const job = normalizeHermesJob(data);
  if (!job) {
    throw new Error('Hermes returned a job payload without an id');
  }
  return job;
}

export async function createHermesJob(
  baseUrl: string,
  apiKey: string,
  input: HermesJobCreateInput
): Promise<{ jobId: string; raw: unknown }> {
  const res = await fetch(`${normalizeBaseUrl(baseUrl)}/api/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(apiKey),
    },
    body: JSON.stringify({
      schedule: input.schedule,
      prompt: input.prompt,
      name: input.name,
      deliver: input.deliver ?? 'local',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hermes job create failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const normalized = normalizeHermesJob(data);
  const jobId =
    normalized?.id ??
    (data as { id?: string }).id ??
    (data as { job_id?: string }).job_id ??
    (data as { job?: { id?: string } }).job?.id;

  if (!jobId) {
    throw new Error('Hermes returned a job but no id was found in the response');
  }

  return { jobId: String(jobId), raw: data };
}

async function postJobAction(
  baseUrl: string,
  apiKey: string,
  jobId: string,
  action: 'pause' | 'resume' | 'run'
): Promise<HermesJobSummary | null> {
  const res = await fetch(
    `${normalizeBaseUrl(baseUrl)}/api/jobs/${encodeURIComponent(jobId)}/${action}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(apiKey),
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hermes job ${action} failed (${res.status}): ${text}`);
  }

  // Some Hermes builds return empty 204; others return the job body.
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return normalizeHermesJob(JSON.parse(text));
  } catch {
    return null;
  }
}

export async function pauseHermesJob(
  baseUrl: string,
  apiKey: string,
  jobId: string
): Promise<HermesJobSummary | null> {
  return postJobAction(baseUrl, apiKey, jobId, 'pause');
}

export async function resumeHermesJob(
  baseUrl: string,
  apiKey: string,
  jobId: string
): Promise<HermesJobSummary | null> {
  return postJobAction(baseUrl, apiKey, jobId, 'resume');
}

export async function runHermesJobNow(
  baseUrl: string,
  apiKey: string,
  jobId: string
): Promise<HermesJobSummary | null> {
  return postJobAction(baseUrl, apiKey, jobId, 'run');
}
