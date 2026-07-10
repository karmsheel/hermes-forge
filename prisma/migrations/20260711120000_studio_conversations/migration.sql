-- 4.17 PR-2: business-scoped conversations (studio + process)
-- Conversation gains businessId + kind; processId becomes optional.
-- ChatMessage.processId becomes optional for studio threads.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Conversation: add businessId / kind, optional processId
CREATE TABLE "new_Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "processId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'process',
    "title" TEXT NOT NULL DEFAULT 'Main',
    "forkedFromId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Conversation_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Conversation" ("id", "businessId", "processId", "kind", "title", "forkedFromId", "createdAt", "updatedAt")
SELECT
    "c"."id",
    "p"."businessId",
    "c"."processId",
    'process',
    "c"."title",
    "c"."forkedFromId",
    "c"."createdAt",
    "c"."updatedAt"
FROM "Conversation" AS "c"
INNER JOIN "Process" AS "p" ON "p"."id" = "c"."processId";

DROP TABLE "Conversation";
ALTER TABLE "new_Conversation" RENAME TO "Conversation";

CREATE INDEX "Conversation_businessId_kind_updatedAt_idx" ON "Conversation"("businessId", "kind", "updatedAt" DESC);
CREATE INDEX "Conversation_processId_createdAt_idx" ON "Conversation"("processId", "createdAt" DESC);

-- ChatMessage: optional processId; cascade when conversation is deleted
CREATE TABLE "new_ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processId" TEXT,
    "conversationId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_ChatMessage" ("id", "processId", "conversationId", "role", "content", "createdAt")
SELECT "id", "processId", "conversationId", "role", "content", "createdAt" FROM "ChatMessage";

DROP TABLE "ChatMessage";
ALTER TABLE "new_ChatMessage" RENAME TO "ChatMessage";

CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
