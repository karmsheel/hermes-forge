-- 4.12 HITL: lifecycle + decision requests + notifications

-- Process lifecycle rename (legacy → draft/refined/forged)
UPDATE "Process" SET "status" = 'draft' WHERE "status" IN ('mapping', 'discovered');
UPDATE "Process" SET "status" = 'refined' WHERE "status" = 'reviewed';
UPDATE "Process" SET "status" = 'forged' WHERE "status" = 'approved';

-- Documents lifecycle
ALTER TABLE "BusinessDocument" ADD COLUMN "lifecycleStatus" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "BusinessDocument" ADD COLUMN "forgedAt" DATETIME;
CREATE INDEX "BusinessDocument_businessId_lifecycleStatus_idx" ON "BusinessDocument"("businessId", "lifecycleStatus");

-- BusinessDecision enrichment
ALTER TABLE "BusinessDecision" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'policy';
ALTER TABLE "BusinessDecision" ADD COLUMN "sourceRequestId" TEXT;
CREATE INDEX "BusinessDecision_businessId_kind_recordedAt_idx" ON "BusinessDecision"("businessId", "kind", "recordedAt" DESC);
CREATE INDEX "BusinessDecision_sourceRequestId_idx" ON "BusinessDecision"("sourceRequestId");

-- DecisionRequest
CREATE TABLE "DecisionRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "contextMarkdown" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "urgency" TEXT NOT NULL DEFAULT 'normal',
    "proposerKind" TEXT NOT NULL,
    "hermesAgentProfileId" TEXT,
    "conversationId" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "relatedEntityName" TEXT,
    "optionsJson" TEXT NOT NULL,
    "proposedActionsJson" TEXT NOT NULL DEFAULT '{}',
    "selectedOptionId" TEXT,
    "redirectMessage" TEXT,
    "resolvedAt" DATETIME,
    "resolvedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DecisionRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DecisionRequest_hermesAgentProfileId_fkey" FOREIGN KEY ("hermesAgentProfileId") REFERENCES "HermesAgentProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "DecisionRequest_businessId_status_createdAt_idx" ON "DecisionRequest"("businessId", "status", "createdAt" DESC);
CREATE INDEX "DecisionRequest_businessId_createdAt_idx" ON "DecisionRequest"("businessId", "createdAt" DESC);
CREATE INDEX "DecisionRequest_hermesAgentProfileId_idx" ON "DecisionRequest"("hermesAgentProfileId");

-- Notification
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "decisionRequestId" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_decisionRequestId_fkey" FOREIGN KEY ("decisionRequestId") REFERENCES "DecisionRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Notification_businessId_userId_createdAt_idx" ON "Notification"("businessId", "userId", "createdAt" DESC);
CREATE INDEX "Notification_businessId_userId_readAt_idx" ON "Notification"("businessId", "userId", "readAt");
CREATE INDEX "Notification_decisionRequestId_idx" ON "Notification"("decisionRequestId");
