-- Phase 6.5: directed process-to-process plant edges
CREATE TABLE "ProcessLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "fromProcessId" TEXT NOT NULL,
    "toProcessId" TEXT NOT NULL,
    "label" TEXT,
    "fromPort" TEXT,
    "toPort" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProcessLink_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProcessLink_fromProcessId_fkey" FOREIGN KEY ("fromProcessId") REFERENCES "Process" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProcessLink_toProcessId_fkey" FOREIGN KEY ("toProcessId") REFERENCES "Process" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProcessLink_businessId_fromProcessId_toProcessId_key" ON "ProcessLink"("businessId", "fromProcessId", "toProcessId");
CREATE INDEX "ProcessLink_businessId_idx" ON "ProcessLink"("businessId");
CREATE INDEX "ProcessLink_fromProcessId_idx" ON "ProcessLink"("fromProcessId");
CREATE INDEX "ProcessLink_toProcessId_idx" ON "ProcessLink"("toProcessId");
