-- Backfill idempotente: garante que cada plano comercial tem os módulos certos.
-- A migração de catálogo original correu antes de o módulo "wms" existir em BDs novas,
-- pelo que "stock" e "business" ficaram sem ligação ao Armazém e Stock.
-- Nenhum dado de cliente é alterado; apenas ligações plano↔módulo.

-- 1) Garantir que os três módulos existem no catálogo.
INSERT INTO "PlatformApplication" ("id", "slug", "name", "description", "icon", "version", "status", "isCore", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'machine-facturas', 'Machine Facturas', 'Facturacao, proformas, recibos e clientes.', '/logo.png', '1.0.0', 'ACTIVE', true, now(), now())
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "PlatformApplication" ("id", "slug", "name", "description", "icon", "version", "status", "isCore", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'wms', 'Machine Stock', 'Gestao de armazens, stock, movimentos e inventario.', '📦', '1.0.0', 'ACTIVE', false, now(), now())
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "PlatformApplication" ("id", "slug", "name", "description", "icon", "version", "status", "isCore", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'rh', 'Machine RH', 'Gestao de funcionarios, assiduidade, ferias, contratos e processamento salarial.', '/icons/rh-logo.png', '1.0.0', 'ACTIVE', false, now(), now())
ON CONFLICT (slug) DO NOTHING;

-- 2) Ligar módulos aos planos (idempotente).
INSERT INTO "PlanApplication" ("planId", "applicationId")
SELECT p.id, a.id
FROM "SubscriptionPlan" p
JOIN "PlatformApplication" a ON a.slug IN ('machine-facturas', 'wms', 'rh')
WHERE p.slug IN ('free', 'stock', 'rh', 'business')
  AND (
    (p.slug = 'free'  AND a.slug = 'machine-facturas')
    OR (p.slug = 'stock'    AND a.slug IN ('machine-facturas', 'wms'))
    OR (p.slug = 'rh'       AND a.slug IN ('machine-facturas', 'rh'))
    OR (p.slug = 'business' AND a.slug IN ('machine-facturas', 'wms', 'rh'))
  )
ON CONFLICT DO NOTHING;
