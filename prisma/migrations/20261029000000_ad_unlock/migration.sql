-- Desbloqueio por anúncio (quota de 20 facturas gratuitas + 1 desbloqueio por emissão)
-- Estados: PENDING (visualização iniciada) → GRANTED (disponível) → CONSUMED (gasto).
-- Migração idempotente: pode ser reaplicada com segurança.

CREATE TABLE IF NOT EXISTS "AdUnlock" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_at" TIMESTAMPTZ(3),
    "consumed_at" TIMESTAMPTZ(3),
    "consumed_by_invoice_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdUnlock_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdUnlock_tenant_id_fkey') THEN
        ALTER TABLE "AdUnlock" ADD CONSTRAINT "AdUnlock_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ad_unlock_tenant_status_idx" ON "AdUnlock"("tenant_id", "status");

-- Protecção anti-farming: apenas UMA visualização pendente por empresa.
CREATE UNIQUE INDEX IF NOT EXISTS "ad_unlock_one_pending_per_tenant" ON "AdUnlock"("tenant_id") WHERE "status" = 'PENDING';

-- Protecção anti-reutilização: um desbloqueio só pode ficar ligado a UMA factura.
CREATE UNIQUE INDEX IF NOT EXISTS "ad_unlock_consumed_by_invoice_key" ON "AdUnlock"("consumed_by_invoice_id") WHERE "consumed_by_invoice_id" IS NOT NULL;
