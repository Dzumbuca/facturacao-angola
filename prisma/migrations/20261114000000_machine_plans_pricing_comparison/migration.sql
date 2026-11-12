-- Preços comparativos + limite de fornecedores nos planos comerciais (aditivo).
ALTER TABLE "SubscriptionPlan"
  ADD COLUMN IF NOT EXISTS "priceQuarterly" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "priceSemiannual" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "previousPriceKz" DECIMAL(12,2);

-- Limite de fornecedores: reutiliza PlanLimit existente; apenas regista a métrica esperada.
-- Nenhum dado existente é alterado; NULL = ilimitado.
