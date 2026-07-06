-- Immutable business log: dual timestamps, sequence, Git stubs, BusinessDecision

PRAGMA foreign_keys = OFF;

-- Business: log head + Git pointers; retire backfillCompletedAt
CREATE TABLE "new_Business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "description" TEXT,
    "teamSize" INTEGER,
    "website" TEXT,
    "goals" TEXT,
    "constraints" TEXT,
    "logHeadSequence" INTEGER NOT NULL DEFAULT 0,
    "logInitializedAt" DATETIME,
    "gitRepoPath" TEXT,
    "gitInitializedAt" DATETIME,
    "gitHeadCommit" TEXT,
    "gitHeadSequence" INTEGER,
    "gitDirty" BOOLEAN NOT NULL DEFAULT false,
    "gitRemoteUrl" TEXT,
    "gitRemoteBranch" TEXT DEFAULT 'main',
    "gitLastPushedAt" DATETIME,
    "gitLastPushError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "new_Business_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Business" (
    "id", "userId", "name", "industry", "description", "teamSize", "website", "goals", "constraints",
    "logHeadSequence", "logInitializedAt",
    "gitRepoPath", "gitInitializedAt", "gitHeadCommit", "gitHeadSequence", "gitDirty",
    "gitRemoteUrl", "gitRemoteBranch", "gitLastPushedAt", "gitLastPushError",
    "createdAt", "updatedAt"
)
SELECT
    "id", "userId", "name", "industry", "description", "teamSize", "website", "goals", "constraints",
    0,
    "backfillCompletedAt",
    NULL, NULL, NULL, NULL, false,
    NULL, 'main', NULL, NULL,
    "createdAt", "updatedAt"
FROM "Business";

DROP TABLE "Business";
ALTER TABLE "new_Business" RENAME TO "Business";

-- BusinessEvent: migrate to sequence + dual timestamps
CREATE TABLE "new_BusinessEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "sequence" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "entityName" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" TEXT,
    "recordedAt" DATETIME NOT NULL,
    "occurredAt" DATETIME,
    "occurredAtPrecision" TEXT NOT NULL DEFAULT 'unknown',
    "ingestion" TEXT NOT NULL DEFAULT 'live',
    "payloadHash" TEXT,
    "prevPayloadHash" TEXT,
    "gitCommitSha" TEXT,
    CONSTRAINT "new_BusinessEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Assign sequence and split timestamps per ingestion kind
INSERT INTO "new_BusinessEvent" (
    "id", "businessId", "userId", "sequence", "type", "entityType", "entityId", "entityName",
    "summary", "metadata", "recordedAt", "occurredAt", "occurredAtPrecision", "ingestion",
    "payloadHash", "prevPayloadHash", "gitCommitSha"
)
SELECT
    e."id",
    e."businessId",
    e."userId",
    (SELECT COUNT(*) FROM "BusinessEvent" e2
     WHERE e2."businessId" = e."businessId"
       AND (e2."createdAt" < e."createdAt" OR (e2."createdAt" = e."createdAt" AND e2."id" <= e."id"))),
    e."type",
    e."entityType",
    e."entityId",
    e."entityName",
    e."summary",
    e."metadata",
    CASE
        WHEN e."source" = 'backfill' THEN COALESCE(b."logInitializedAt", CURRENT_TIMESTAMP)
        ELSE e."createdAt"
    END,
    CASE
        WHEN e."source" = 'backfill' THEN e."createdAt"
        ELSE e."createdAt"
    END,
    CASE
        WHEN e."source" = 'backfill' THEN 'approximate'
        ELSE 'exact'
    END,
    CASE
        WHEN e."source" = 'backfill' THEN 'backfill'
        ELSE 'live'
    END,
    NULL,
    NULL,
    NULL
FROM "BusinessEvent" e
JOIN "Business" b ON b."id" = e."businessId";

DROP TABLE "BusinessEvent";
ALTER TABLE "new_BusinessEvent" RENAME TO "BusinessEvent";

CREATE UNIQUE INDEX "BusinessEvent_businessId_sequence_key" ON "BusinessEvent"("businessId", "sequence");
CREATE INDEX "BusinessEvent_businessId_recordedAt_idx" ON "BusinessEvent"("businessId", "recordedAt" DESC);

-- Update logHeadSequence from max sequence per business
UPDATE "Business"
SET "logHeadSequence" = (
    SELECT COALESCE(MAX("sequence"), 0) FROM "BusinessEvent" WHERE "businessId" = "Business"."id"
);

-- BusinessDecision (empty until record UI ships)
CREATE TABLE "BusinessDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "decidedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "rationale" TEXT,
    "context" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "decidedAt" DATETIME,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "supersededByDecisionId" TEXT,
    "logSequence" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessDecision_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BusinessDecision_businessId_recordedAt_idx" ON "BusinessDecision"("businessId", "recordedAt" DESC);
CREATE INDEX "BusinessDecision_businessId_status_idx" ON "BusinessDecision"("businessId", "status");
CREATE INDEX "BusinessDecision_businessId_decidedAt_idx" ON "BusinessDecision"("businessId", "decidedAt" DESC);

PRAGMA foreign_keys = ON;