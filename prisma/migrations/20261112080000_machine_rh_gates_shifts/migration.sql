-- Gates jurídicos configuráveis + turnos nocturnos (aditivo; defaults seguros).
-- Nenhum registo existente fica automaticamente VALIDADO; todos nascem PENDENTE.

ALTER TABLE "RhPayrollRuleSet"
  ADD COLUMN "legalStatus" TEXT NOT NULL DEFAULT 'PENDENTE',
  ADD COLUMN "legalDocumentUrl" TEXT,
  ADD COLUMN "legalValidatedBy" TEXT,
  ADD COLUMN "legalValidatedAt" TIMESTAMP(3);

ALTER TABLE "RhDocumentTemplate"
  ADD COLUMN "legalStatus" TEXT NOT NULL DEFAULT 'PENDENTE',
  ADD COLUMN "legalDocumentUrl" TEXT,
  ADD COLUMN "legalValidatedBy" TEXT,
  ADD COLUMN "legalValidatedAt" TIMESTAMP(3);

ALTER TABLE "RhShift"
  ADD COLUMN "isNight" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "nightPremiumPercent" INTEGER NOT NULL DEFAULT 0;
