-- AlterTable
ALTER TABLE "HumanPersonnel" ADD COLUMN "iconKey" TEXT;

-- AlterTable
ALTER TABLE "HermesAgentProfile" ADD COLUMN "iconKey" TEXT;
ALTER TABLE "HermesAgentProfile" ADD COLUMN "isHired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HermesAgentProfile" ADD COLUMN "hiredAt" DATETIME;

-- CreateIndex
CREATE INDEX "HermesAgentProfile_businessId_isHired_idx" ON "HermesAgentProfile"("businessId", "isHired");