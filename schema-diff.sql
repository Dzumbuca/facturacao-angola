-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "applyVat" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discountType" TEXT NOT NULL DEFAULT 'amount',
ADD COLUMN     "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "observations" TEXT;

