-- Add optional proof-of-payment columns for customer-reported payments.
-- Idempotent: safe to apply when columns already exist (staging pre-synced via prisma db push).
ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "proofName" TEXT,
  ADD COLUMN IF NOT EXISTS "proofData" TEXT;
