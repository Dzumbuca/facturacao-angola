-- Alinhamento de índices não-stock (drift migrations ↔ schema.prisma).
-- As migrations criavam índices com nomes diferentes dos declarados no schema
-- (BusinessDocument, EmailActionToken, EmailCampaign, EmailCampaignRecipient,
-- EmailDelivery, PlatformTeamInvite, BusinessDocumentCounter).
-- Esta migration aplica a nomenclatura declarada no schema.
--
-- BD nova (criada por migrations): executar normalmente.
-- BD já alinhada via `prisma db push` (objetos atuais): registar como aplicada
-- com `npx prisma migrate resolve --applied 20261107191000_align_nonstock_indexes`.

-- DropIndex
DROP INDEX "BusinessDocument_tenantId_type_number_key";

-- DropIndex
DROP INDEX "BusinessDocument_tenantId_type_status_issueDate_idx";

-- DropIndex
DROP INDEX "EmailActionToken_userId_purpose_expiresAt_idx";

-- DropIndex
DROP INDEX "EmailCampaign_status_scheduledAt_idx";

-- DropIndex
DROP INDEX "EmailCampaignRecipient_campaignId_status_createdAt_idx";

-- DropIndex
DROP INDEX "EmailDelivery_status_createdAt_idx";

-- DropIndex
DROP INDEX "PlatformTeamInvite_email_status_idx";

-- DropIndex
DROP INDEX "PlatformTeamInvite_status_expiresAt_idx";

-- CreateIndex
CREATE UNIQUE INDEX "BusinessDocument_tenantId_id_key" ON "BusinessDocument"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessDocument_tenantId_number_key" ON "BusinessDocument"("tenantId", "number");

-- CreateIndex
CREATE INDEX "BusinessDocumentCounter_tenantId_idx" ON "BusinessDocumentCounter"("tenantId");

-- CreateIndex
CREATE INDEX "EmailActionToken_userId_expiresAt_idx" ON "EmailActionToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "EmailCampaign_scheduledAt_idx" ON "EmailCampaign"("scheduledAt");

-- CreateIndex
CREATE INDEX "EmailCampaignRecipient_campaignId_createdAt_idx" ON "EmailCampaignRecipient"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDelivery_createdAt_idx" ON "EmailDelivery"("createdAt");

-- CreateIndex
CREATE INDEX "PlatformTeamInvite_email_idx" ON "PlatformTeamInvite"("email");

-- CreateIndex
CREATE INDEX "PlatformTeamInvite_expiresAt_idx" ON "PlatformTeamInvite"("expiresAt");
