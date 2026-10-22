CREATE TYPE "EmailActionPurpose" AS ENUM ('VERIFY_EMAIL', 'PASSWORD_RESET');
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('ACCEPTED', 'FAILED');
CREATE TYPE "TeamInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');
CREATE TYPE "EmailCampaignStatus" AS ENUM ('DRAFT', 'SENDING', 'PAUSED', 'COMPLETED');

ALTER TABLE "User" ADD COLUMN "emailVerified" TIMESTAMP(3), ADD COLUMN "emailVerificationRequired" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "EmailActionToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "purpose" "EmailActionPurpose" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailActionToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailActionToken_tokenHash_key" ON "EmailActionToken"("tokenHash");
CREATE INDEX "EmailActionToken_userId_purpose_expiresAt_idx" ON "EmailActionToken"("userId", "purpose", "expiresAt");
ALTER TABLE "EmailActionToken" ADD CONSTRAINT "EmailActionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EmailRequestLimit" (
  "keyHash" TEXT NOT NULL,
  "windowStartedAt" TIMESTAMP(3) NOT NULL,
  "requestCount" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailRequestLimit_pkey" PRIMARY KEY ("keyHash")
);

CREATE TABLE "EmailDelivery" (
  "id" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" "EmailDeliveryStatus" NOT NULL,
  "errorCode" TEXT,
  "userId" TEXT,
  "tenantId" TEXT,
  "invoiceId" TEXT,
  "sentByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmailDelivery_tenantId_createdAt_idx" ON "EmailDelivery"("tenantId", "createdAt");
CREATE INDEX "EmailDelivery_invoiceId_createdAt_idx" ON "EmailDelivery"("invoiceId", "createdAt");
CREATE INDEX "EmailDelivery_status_createdAt_idx" ON "EmailDelivery"("status", "createdAt");
CREATE INDEX "EmailDelivery_purpose_createdAt_idx" ON "EmailDelivery"("purpose", "createdAt");
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PlatformTeamInvite" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "platformRole" "PlatformRole" NOT NULL,
  "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "tokenHash" TEXT NOT NULL,
  "status" "TeamInviteStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  CONSTRAINT "PlatformTeamInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformTeamInvite_tokenHash_key" ON "PlatformTeamInvite"("tokenHash");
CREATE INDEX "PlatformTeamInvite_email_status_idx" ON "PlatformTeamInvite"("email", "status");
CREATE INDEX "PlatformTeamInvite_status_expiresAt_idx" ON "PlatformTeamInvite"("status", "expiresAt");
ALTER TABLE "PlatformTeamInvite" ADD CONSTRAINT "PlatformTeamInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "MarketingPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "subscribed" BOOLEAN NOT NULL DEFAULT false,
  "consentAt" TIMESTAMP(3),
  "consentSource" TEXT,
  "consentVersion" TEXT,
  "unsubscribedAt" TIMESTAMP(3),
  "unsubscribeTokenHash" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketingPreference_userId_key" ON "MarketingPreference"("userId");
CREATE UNIQUE INDEX "MarketingPreference_unsubscribeTokenHash_key" ON "MarketingPreference"("unsubscribeTokenHash");
CREATE INDEX "MarketingPreference_subscribed_updatedAt_idx" ON "MarketingPreference"("subscribed", "updatedAt");
ALTER TABLE "MarketingPreference" ADD CONSTRAINT "MarketingPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EmailCampaign" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "htmlContent" TEXT NOT NULL,
  "textContent" TEXT NOT NULL,
  "status" "EmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT NOT NULL,
  CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmailCampaign_status_scheduledAt_idx" ON "EmailCampaign"("status", "scheduledAt");
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
