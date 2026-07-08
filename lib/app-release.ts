export type AppReleaseInfo = {
  version: string;
  name: string;
  body: string | null;
  publishedAt: string | null;
  url: string;
};

export async function fetchLatestAppRelease(): Promise<AppReleaseInfo> {
  const res = await fetch("/api/app-release/latest");
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Could not load release information.");
  }
  return res.json() as Promise<AppReleaseInfo>;
}