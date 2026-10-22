CREATE TYPE "EmailCampaignRecipientStatus" AS ENUM ('QUEUED', 'SENDING', 'ACCEPTED', 'FAILED', 'SUPPRESSED');

CREATE TABLE "EmailCampaignRecipient" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "preferenceId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "status" "EmailCampaignRecipientStatus" NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "lastAttemptAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailCampaignRecipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailCampaignRecipient_campaignId_preferenceId_key" ON "EmailCampaignRecipient"("campaignId", "preferenceId");
CREATE INDEX "EmailCampaignRecipient_campaignId_status_createdAt_idx" ON "EmailCampaignRecipient"("campaignId", "status", "createdAt");
ALTER TABLE "EmailCampaignRecipient" ADD CONSTRAINT "EmailCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailCampaignRecipient" ADD CONSTRAINT "EmailCampaignRecipient_preferenceId_fkey" FOREIGN KEY ("preferenceId") REFERENCES "MarketingPreference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
