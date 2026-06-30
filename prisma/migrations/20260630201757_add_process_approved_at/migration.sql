-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Process" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "trigger" TEXT,
    "inputs" TEXT,
    "outputs" TEXT,
    "manualSteps" TEXT,
    "automationScore" INTEGER NOT NULL DEFAULT 0,
    "estimatedTimeSaved" INTEGER,
    "repetition" INTEGER,
    "businessValue" INTEGER,
    "complexity" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'mapping',
    "approvedAt" DATETIME,
    "nameStatus" TEXT NOT NULL DEFAULT 'pending',
    "diagramMermaid" TEXT,
    "diagramUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Process_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Process" ("automationScore", "businessId", "businessValue", "complexity", "createdAt", "department", "description", "diagramMermaid", "diagramUpdatedAt", "estimatedTimeSaved", "id", "inputs", "manualSteps", "name", "nameStatus", "outputs", "repetition", "status", "trigger", "updatedAt") SELECT "automationScore", "businessId", "businessValue", "complexity", "createdAt", "department", "description", "diagramMermaid", "diagramUpdatedAt", "estimatedTimeSaved", "id", "inputs", "manualSteps", "name", "nameStatus", "outputs", "repetition", "status", "trigger", "updatedAt" FROM "Process";
DROP TABLE "Process";
ALTER TABLE "new_Process" RENAME TO "Process";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
