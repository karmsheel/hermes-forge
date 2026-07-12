-- 4.10: bind automations to hired Hermes agents
-- SQLite: ADD COLUMN only (FK enforced in Prisma client; see Conversation.hermesAgentProfileId pattern)

ALTER TABLE "Automation" ADD COLUMN "hermesAgentProfileId" TEXT;

CREATE INDEX "Automation_hermesAgentProfileId_idx" ON "Automation"("hermesAgentProfileId");
