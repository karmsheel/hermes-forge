-- CreateTable
CREATE TABLE "BusinessDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL DEFAULT '',
    "pinnedForContext" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessDocument_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessDocument_businessId_slug_key" ON "BusinessDocument"("businessId", "slug");

-- CreateIndex
CREATE INDEX "BusinessDocument_businessId_sortOrder_idx" ON "BusinessDocument"("businessId", "sortOrder");

-- CreateIndex
CREATE INDEX "BusinessDocument_businessId_pinnedForContext_idx" ON "BusinessDocument"("businessId", "pinnedForContext");
