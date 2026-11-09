-- Pagamento passa a registar o pacote e o ciclo contratado.

ALTER TABLE "PlanPayment" ADD COLUMN "planSlug" TEXT;
ALTER TABLE "PlanPayment" ADD COLUMN "billingCycle" TEXT;
