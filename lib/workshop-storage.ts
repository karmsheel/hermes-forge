const LEGACY_ACTIVE_PROCESS_KEY = "activeProcessId";

function scopedKey(businessId: string) {
  return `activeProcessId:${businessId}`;
}

export function getActiveProcessId(businessId: string): string | null {
  if (typeof window === "undefined") return null;

  const scoped = localStorage.getItem(scopedKey(businessId));
  if (scoped) return scoped;

  const legacy = localStorage.getItem(LEGACY_ACTIVE_PROCESS_KEY);
  if (legacy) {
    localStorage.setItem(scopedKey(businessId), legacy);
    localStorage.removeItem(LEGACY_ACTIVE_PROCESS_KEY);
    return legacy;
  }

  return null;
}

export function setActiveProcessId(businessId: string, processId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(scopedKey(businessId), processId);
  localStorage.removeItem(LEGACY_ACTIVE_PROCESS_KEY);
}

export function clearActiveProcessId(businessId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(scopedKey(businessId));
  localStorage.removeItem(LEGACY_ACTIVE_PROCESS_KEY);
}

export function clearLegacyActiveProcessId() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEGACY_ACTIVE_PROCESS_KEY);
}