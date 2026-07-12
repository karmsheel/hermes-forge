import {
  normalizeProcessStatus,
  type ProcessStatus,
} from './process-status';

export function buildApprovalUpdate(
  status: string
): { status: ProcessStatus; approvedAt: Date | null } {
  const normalized = normalizeProcessStatus(status);
  if (normalized === 'forged') {
    return { status: 'forged', approvedAt: new Date() };
  }
  return { status: normalized, approvedAt: null };
}
