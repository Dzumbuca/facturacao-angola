-- AlterTable
ALTER TABLE "PlatformConfig" ADD COLUMN     "adHtml" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'FREE';

