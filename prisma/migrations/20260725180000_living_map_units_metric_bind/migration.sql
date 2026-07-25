-- Living business map: L0 unit streams, process→unit FK, metric process/node bind

-- AlterTable Process
ALTER TABLE "Process" ADD COLUMN "businessFunctionId" TEXT;

-- CreateTable BusinessFunctionLink
CREATE TABLE "BusinessFunctionLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "fromFunctionId" TEXT NOT NULL,
    "toFunctionId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessFunctionLink_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessFunctionLink_fromFunctionId_fkey" FOREIGN KEY ("fromFunctionId") REFERENCES "BusinessFunction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessFunctionLink_toFunctionId_fkey" FOREIGN KEY ("toFunctionId") REFERENCES "BusinessFunction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable BusinessMetric
ALTER TABLE "BusinessMetric" ADD COLUMN "processId" TEXT;
ALTER TABLE "BusinessMetric" ADD COLUMN "mermaidNodeId" TEXT;

-- CreateIndex
CREATE INDEX "Process_businessFunctionId_idx" ON "Process"("businessFunctionId");

-- CreateIndex
CREATE INDEX "BusinessFunctionLink_businessId_idx" ON "BusinessFunctionLink"("businessId");

-- CreateIndex
CREATE INDEX "BusinessFunctionLink_fromFunctionId_idx" ON "BusinessFunctionLink"("fromFunctionId");

-- CreateIndex
CREATE INDEX "BusinessFunctionLink_toFunctionId_idx" ON "BusinessFunctionLink"("toFunctionId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessFunctionLink_businessId_fromFunctionId_toFunctionId_key" ON "BusinessFunctionLink"("businessId", "fromFunctionId", "toFunctionId");

-- CreateIndex
CREATE INDEX "BusinessMetric_processId_idx" ON "BusinessMetric"("processId");
