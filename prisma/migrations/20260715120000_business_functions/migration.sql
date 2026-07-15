-- CreateTable
CREATE TABLE "BusinessFunction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessFunction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessFunction_businessId_name_key" ON "BusinessFunction"("businessId", "name");

-- CreateIndex
CREATE INDEX "BusinessFunction_businessId_idx" ON "BusinessFunction"("businessId");
