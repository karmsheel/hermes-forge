-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HumanPersonnel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "roleDescription" TEXT,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HumanPersonnel_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_HumanPersonnel" ("businessId", "createdAt", "id", "name", "role", "roleDescription", "updatedAt") SELECT "businessId", "createdAt", "id", "name", "role", "roleDescription", "updatedAt" FROM "HumanPersonnel";
DROP TABLE "HumanPersonnel";
ALTER TABLE "new_HumanPersonnel" RENAME TO "HumanPersonnel";
CREATE INDEX "HumanPersonnel_businessId_isOwner_idx" ON "HumanPersonnel"("businessId", "isOwner");
CREATE INDEX "HumanPersonnel_businessId_createdAt_idx" ON "HumanPersonnel"("businessId", "createdAt" DESC);
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
