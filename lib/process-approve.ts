import type { ProcessStatus } from './process-status';

export function buildApprovalUpdate(
  status: ProcessStatus
): { status: ProcessStatus; approvedAt: Date | null } {
  if (status === 'approved') {
    return { status: 'approved', approvedAt: new Date() };
  }
  return { status, approvedAt: null };
}