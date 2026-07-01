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

const PENDING_REPLY_KEY = "pendingHermesReply";
const PENDING_NEW_PROCESS_KEY = "pendingNewProcess";

/** Nav rail + was clicked from outside workshop — create a process on arrival. */
export function setPendingNewProcess() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PENDING_NEW_PROCESS_KEY, "1");
}

export function consumePendingNewProcess(): boolean {
  if (typeof window === "undefined") return false;
  const value = sessionStorage.getItem(PENDING_NEW_PROCESS_KEY);
  if (value) sessionStorage.removeItem(PENDING_NEW_PROCESS_KEY);
  return value === "1";
}

/** Marks a process whose seeded user message still needs an assistant reply. */
export function setPendingHermesReply(processId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PENDING_REPLY_KEY, processId);
}

export function consumePendingHermesReply(): string | null {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem(PENDING_REPLY_KEY);
  if (value) sessionStorage.removeItem(PENDING_REPLY_KEY);
  return value;
}