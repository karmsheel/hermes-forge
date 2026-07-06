const EXPORT_ACK_TTL_MS = 30 * 60 * 1000;

interface ExportAckEntry {
  businessId: string;
  userId: string;
  checksum: string;
  expiresAt: number;
}

const ackByKey = new Map<string, ExportAckEntry>();

function cacheKey(businessId: string, userId: string): string {
  return `${userId}:${businessId}`;
}

export function storeExportAck(
  businessId: string,
  userId: string,
  checksum: string
): void {
  const key = cacheKey(businessId, userId);
  ackByKey.set(key, {
    businessId,
    userId,
    checksum,
    expiresAt: Date.now() + EXPORT_ACK_TTL_MS,
  });
}

export function consumeExportAck(
  businessId: string,
  userId: string,
  checksum: string
): boolean {
  const key = cacheKey(businessId, userId);
  const entry = ackByKey.get(key);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    ackByKey.delete(key);
    return false;
  }
  if (entry.checksum !== checksum) return false;
  ackByKey.delete(key);
  return true;
}