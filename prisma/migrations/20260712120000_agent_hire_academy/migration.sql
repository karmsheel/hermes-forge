-- Agent hire + chatbar agent threads + Agent Academy training items

-- Studio conversations can be scoped to a hired Hermes agent profile
ALTER TABLE "Conversation" ADD COLUMN "hermesAgentProfileId" TEXT;

CREATE INDEX "Conversation_hermesAgentProfileId_idx" ON "Conversation"("hermesAgentProfileId");
CREATE INDEX "Conversation_businessId_kind_hermesAgentProfileId_updatedAt_idx" ON "Conversation"("businessId", "kind", "hermesAgentProfileId", "updatedAt" DESC);

-- Uploaded skills / soul profiles for Agent Academy
CREATE TABLE "AgentTrainingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "hermesAgentProfileId" TEXT,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "fileName" TEXT,
    "source" TEXT NOT NULL DEFAULT 'upload',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentTrainingItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentTrainingItem_hermesAgentProfileId_fkey" FOREIGN KEY ("hermesAgentProfileId") REFERENCES "HermesAgentProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AgentTrainingItem_businessId_kind_createdAt_idx" ON "AgentTrainingItem"("businessId", "kind", "createdAt" DESC);
CREATE INDEX "AgentTrainingItem_hermesAgentProfileId_idx" ON "AgentTrainingItem"("hermesAgentProfileId");
