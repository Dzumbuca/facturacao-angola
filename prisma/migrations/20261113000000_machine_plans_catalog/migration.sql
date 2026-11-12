-- Catalogo comercial dos planos Machine (aditivo; apenas regista apps/pacotes).
-- Nao altera Tenants, nao altera TenantApplication imediatamente (activacao manual em /admin).

-- 1) App machine-facturas (core)
INSERT INTO "PlatformApplication" ("id", "slug", "name", "description", "icon", "version", "status", "isCore", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'machine-facturas', 'Machine Facturas', 'Facturacao, proformas, recibos e clientes.', '/logo.png', '1.0.0', 'ACTIVE', true, now(), now())
ON CONFLICT (slug) DO NOTHING;

-- 2) App Machine RH
INSERT INTO "PlatformApplication" ("id", "slug", "name", "description", "icon", "version", "status", "isCore", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'rh', 'Machine RH', 'Gestao de funcionarios, assiduidade, ferias, contratos, processamento salarial e documentos.', '/icons/rh-logo.png', '1.0.0', 'ACTIVE', false, now(), now())
ON CONFLICT (slug) DO NOTHING;

-- 3) Planos: Free / Stock / RH / Business
INSERT INTO "SubscriptionPlan" ("id", "slug", "name", "description", "priceKz", "priceYearly", "billingCycle", "isBundle", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), s, n, d, p, p * 12, 'MONTHLY', b, true, now(), now()
FROM (VALUES
  ('free',     'Free',     'Facturação, clientes, produtos, recibos, proformas e ferramentas gratuitas.', 0::numeric, false),
  ('stock',    'Stock',    'Tudo o Free + armazéns, inventário, compras, fornecedores, transferências e controlo de stock.', 2500::numeric, false),
  ('rh',       'RH',       'Gestão de funcionários, contratos, departamentos, assiduidade, férias, processamento salarial e documentos.', 3500::numeric, false),
  ('business', 'Business', 'Free + Stock + RH integrados com gestão empresarial.', 5000::numeric, true)
) AS v(s, n, d, p, b)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, "priceKz" = EXCLUDED."priceKz", "billingCycle" = 'MONTHLY', "isActive" = true, "updatedAt" = now();

-- 4) Ligação plano -> app
INSERT INTO "PlanApplication" ("planId", "applicationId")
SELECT p.id, a.id FROM "SubscriptionPlan" p JOIN "PlatformApplication" a ON a.slug = 'machine-facturas'
WHERE p.slug IN ('free', 'stock', 'rh', 'business')
ON CONFLICT DO NOTHING;
INSERT INTO "PlanApplication" ("planId", "applicationId")
SELECT p.id, a.id FROM "SubscriptionPlan" p JOIN "PlatformApplication" a ON a.slug = 'wms'
WHERE p.slug IN ('stock', 'business')
ON CONFLICT DO NOTHING;
INSERT INTO "PlanApplication" ("planId", "applicationId")
SELECT p.id, a.id FROM "SubscriptionPlan" p JOIN "PlatformApplication" a ON a.slug = 'rh'
WHERE p.slug IN ('rh', 'business')
ON CONFLICT DO NOTHING;
