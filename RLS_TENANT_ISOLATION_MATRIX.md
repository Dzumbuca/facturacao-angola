# RLS Tenant Isolation Matrix — Machine Facturas (atualização preparação)

Legenda: **OK** compatível/ctx presente; **PARCIAL** ctx parcial ou gaps; **RISCO** sem ctx adequado; **GLOBAL** intencional (admin/infra); **CRÍTICO** auth/adapter. *Base: auditoria de código 2026-11-05; confirmar em alvo com RLS+role sem BYPASSRLS.*

| Área / Ficheiro | Tabelas | Op. | Tenant/User | runWithTenant/GUC | Estado | Ação |
|---|---|---|---|---:|---|---|
| `lib/tenant-db.ts` | GUC | set_config LOCAL | app | sim | OK | Base ctx |
| `api/stock/reports/route.ts` | StockMovement, PWS, StockLot, StockTransfer, Product, Warehouse | read | tenant | sim | OK | **Corrigido** |
| `api/desktop/offline-bootstrap/route.ts` | User, Tenant, Customer, Product, InvoiceDraft, CompanyBankAccount, CompanyLogo | read | tenant+user | sim | OK | **Corrigido** (cauda duplicada removida) |
| `api/company-profile/route.ts`, `bank-accounts*` | Tenant, CompanyLogo, CompanyBankAccount | read/write | tenant | sim | OK | **Corrigido** |
| `api/customers*`, `api/produtos*` | Customer, Product, Invoice/InvoiceItem(count) | CRUD | tenant | sim | OK | **Corrigido**; mutação por `id` verificada no tenant |
| `api/invoices/drafts*` + `lib/invoice-draft-service.ts` | InvoiceDraft, CompanyBankAccount, Invoice, Customer, Tenant | CRUD/issue | tenant | sim | OK | **Corrigido** (`userId` propagado); emissão via `issueInvoice` |
| `lib/invoice-quota.ts` | Tenant, Invoice, AdUnlock(via tx) | read | tenant | sim | OK | **Corrigido** |
| `lib/ad-unlock-service.ts` + `api/ads/unlock/*` | AdUnlock (`tenant_id`) | read/write/claim | tenant | parcial/sim | PARCIAL | **Prep ctx global**; validar políticas RLS AdUnlock (tabela sem RLS em staging) e claim na tx de emissão |
| `lib/invoice-service.ts` | Invoice, Tenant, Customer, Product/stock, InvoiceDraft, AdUnlock claim | emissão | tenant | sim | OK/PARCIAL | ctx OK; manter `link/claim` auditáveis |
| `lib/stock-service.ts`, `api/stock/*` (maioria) | Product, Warehouse, StockMovement, PWS, WMS | CRUD | tenant | sim | OK/PARCIAL | confirmar cobertura total de sub-rotas WMS |
| `lib/business-document-repository.ts` | BusinessDocument*, counters, Customer, Product, Tenant, InvoiceDraft | CRUD | tenant | não direto | RISCO | `$transaction` com filtros `tenantId` mas sem GUC; exigir caller em `runWithTenant` ou refatorar repo |
| `lib/auth.ts` + NextAuth adapter | User, Account, Session, VerificationToken | auth | sistema/user | não | **CRÍTICO** | **Sem alteração**. Ver `RLS_NEXTAUTH_COMPATIBILITY.md` |
| `api/auth/*`, onboarding, session/refresh | User/tokens | auth lifecycle | público/user | não | RISCO | desenho especial sob RLS |
| `api/plan/payment/proof/[id]` e áreas admin | PlanPayment, User, admin data | admin | platform | não | GLOBAL/RISCO | requer `app.is_admin`/políticas explícitas, auditoria; sem acesso empresarial indiscriminado |
| `components/tool-page.tsx` | PlatformConfig | read | público | não | GLOBAL | expor só campos não sensíveis; política adequada |

## Tabelas especiais
Sem `tenantId`: `InvoiceItem`, `VerificationToken`, `Account`, `Session`, entidades Platform/Email globais — políticas específicas. `User.tenantId` nullable. `AdUnlock.tenant_id` sem RLS em staging.

## Critério
**Não preparado para produção com RLS ativo** enquanto existirem operações empresariais/auth/admin sem isolamento comprovado e testes cross-tenant + testes com role sem BYPASSRLS em ambiente preparado.
