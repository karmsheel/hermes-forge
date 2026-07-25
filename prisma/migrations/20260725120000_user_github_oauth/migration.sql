-- GitHub OAuth identity fields + optional passwordHash for OAuth-only users.
-- SQLite cannot ALTER COLUMN nullability; rebuild User table.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "githubId" TEXT,
    "githubLogin" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "forgeOverlordProfileKey" TEXT,
    "forgeOverlordDisplayName" TEXT,
    "forgeOverlordHermesHome" TEXT,
    "forgeOverlordSetAt" DATETIME
);

INSERT INTO "new_User" (
    "id",
    "email",
    "name",
    "passwordHash",
    "createdAt",
    "updatedAt",
    "forgeOverlordProfileKey",
    "forgeOverlordDisplayName",
    "forgeOverlordHermesHome",
    "forgeOverlordSetAt"
)
SELECT
    "id",
    "email",
    "name",
    "passwordHash",
    "createdAt",
    "updatedAt",
    "forgeOverlordProfileKey",
    "forgeOverlordDisplayName",
    "forgeOverlordHermesHome",
    "forgeOverlordSetAt"
FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
