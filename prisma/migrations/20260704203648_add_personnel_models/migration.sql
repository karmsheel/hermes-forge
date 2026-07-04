-- CreateTable
CREATE TABLE "HumanPersonnel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "roleDescription" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HumanPersonnel_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HermesAgentProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "profileKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "model" TEXT,
    "hermesHome" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HermesAgentProfile_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "HumanPersonnel_businessId_createdAt_idx" ON "HumanPersonnel"("businessId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "HermesAgentProfile_businessId_discoveredAt_idx" ON "HermesAgentProfile"("businessId", "discoveredAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "HermesAgentProfile_businessId_profileKey_key" ON "HermesAgentProfile"("businessId", "profileKey");
