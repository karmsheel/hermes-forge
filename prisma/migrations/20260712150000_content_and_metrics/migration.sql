-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'idea',
    "channel" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "processId" TEXT,
    "automationId" TEXT,
    "scheduledFor" DATETIME,
    "shippedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'count',
    "collectionMethod" TEXT NOT NULL DEFAULT 'manual',
    "cadenceGoal" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessMetric_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MetricSample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "metricId" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    CONSTRAINT "MetricSample_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "BusinessMetric" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ContentItem_businessId_status_updatedAt_idx" ON "ContentItem"("businessId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "ContentItem_businessId_createdAt_idx" ON "ContentItem"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessMetric_businessId_name_idx" ON "BusinessMetric"("businessId", "name");

-- CreateIndex
CREATE INDEX "MetricSample_metricId_recordedAt_idx" ON "MetricSample"("metricId", "recordedAt");
