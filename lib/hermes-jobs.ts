export interface HermesJobCreateInput {
  schedule: string;
  prompt: string;
  name: string;
  deliver?: string;
}

export interface HermesJobSummary {
  id: string;
  name?: string;
  schedule?: string;
  status?: string;
  prompt?: string;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}

export async function listHermesJobs(
  baseUrl: string,
  apiKey: string
): Promise<HermesJobSummary[]> {
  const res = await fetch(`${normalizeBaseUrl(baseUrl)}/api/jobs`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hermes jobs list failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (Array.isArray(data)) return data as HermesJobSummary[];
  if (Array.isArray(data.jobs)) return data.jobs as HermesJobSummary[];
  return [];
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
      Authorization: `Bearer ${apiKey}`,
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
  const jobId =
    (data as { id?: string }).id ??
    (data as { job_id?: string }).job_id ??
    (data as { job?: { id?: string } }).job?.id;

  if (!jobId) {
    throw new Error('Hermes returned a job but no id was found in the response');
  }

  return { jobId: String(jobId), raw: data };
}