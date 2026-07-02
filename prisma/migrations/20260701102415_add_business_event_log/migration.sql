-- AlterTable
ALTER TABLE "Business" ADD COLUMN "backfillCompletedAt" DATETIME;

-- CreateTable
CREATE TABLE "BusinessEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "entityName" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" TEXT,
    "source" TEXT NOT NULL DEFAULT 'live',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BusinessEvent_businessId_createdAt_idx" ON "BusinessEvent"("businessId", "createdAt" DESC);
