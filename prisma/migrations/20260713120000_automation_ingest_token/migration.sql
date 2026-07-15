-- AlterTable
ALTER TABLE "Automation" ADD COLUMN "ingestToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Automation_ingestToken_key" ON "Automation"("ingestToken");
