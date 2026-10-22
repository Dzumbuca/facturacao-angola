CREATE TYPE "PlatformRole" AS ENUM ('NONE', 'ADMIN');
CREATE TYPE "TenantRole" AS ENUM ('USER', 'COMPANY_ADMIN', 'BILLING', 'VIEWER');
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

ALTER TABLE "User" ALTER COLUMN "tenantId" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "platformRole" "PlatformRole" NOT NULL DEFAULT 'NONE';
ALTER TABLE "User" ADD COLUMN "tenantRole" "TenantRole" NOT NULL DEFAULT 'USER';
ALTER TABLE "User" ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "suspensionReason" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Tenant" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "suspensionReason" TEXT;

ALTER TABLE "User" DROP CONSTRAINT "User_tenantId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PlatformConfig" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "platformName" TEXT NOT NULL DEFAULT 'Machine Facturas',
    "supportEmail" TEXT,
    "supportPhone" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedByUserId" TEXT,
    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlatformConfig" ("id", "platformName") VALUES ('global', 'Machine Facturas');

CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'ADMIN',
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "reason" TEXT,
    "result" TEXT NOT NULL DEFAULT 'SUCCESS',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
CREATE INDEX "AdminAuditLog_actorUserId_createdAt_idx" ON "AdminAuditLog"("actorUserId", "createdAt");
CREATE INDEX "AdminAuditLog_resourceType_resourceId_createdAt_idx"
  ON "AdminAuditLog"("resourceType", "resourceId", "createdAt");

ALTER TABLE "PlatformConfig" ADD CONSTRAINT "PlatformConfig_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
