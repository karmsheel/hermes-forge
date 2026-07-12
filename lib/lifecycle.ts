/**
 * Shared lifecycle for processes + business documents (4.12 HITL).
 */

export const LIFECYCLE_STATUSES = ['draft', 'refined', 'forged'] as const;
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export const LIFECYCLE_LABELS: Record<LifecycleStatus, string> = {
  draft: 'Draft',
  refined: 'Refined',
  forged: 'Forged',
};

export function isLifecycleStatus(value: string): value is LifecycleStatus {
  return (LIFECYCLE_STATUSES as readonly string[]).includes(value);
}

export function isForgedLifecycle(status: string): boolean {
  return status === 'forged' || status === 'approved';
}

export function canAdvanceLifecycle(
  from: string,
  to: LifecycleStatus
): boolean {
  const order: LifecycleStatus[] = ['draft', 'refined', 'forged'];
  const fromN = from === 'approved' ? 'forged' : from === 'mapping' ? 'draft' : from === 'reviewed' ? 'refined' : from;
  const fi = order.indexOf(fromN as LifecycleStatus);
  const ti = order.indexOf(to);
  if (ti < 0) return false;
  if (fi < 0) return ti === 0;
  return ti >= fi;
}
