# RLS — Auditoria de rotas remanescentes (ETAPA 2/3/4, parcial)

**Método:** varrimento `src/app/api/**/route.ts` (excl. `.next`): `runWithTenant` vs `prisma.` global. **Sem alterações em produção/auth/admin sensível sem prova.**

## Rotas com `prisma.` global e sem `runWithTenant` (identificadas)
| Rota | Classificação | Estado |
|---|---|---|
| `api/auth/forgot-password` | Auth lifecycle | **NÃO ALTERAR** (ETAPA 2/5; tokens/user sem tenant ctx padrão) |
| `api/auth/register` | Auth lifecycle/onboarding inicial | **NÃO ALTERAR** |
| `api/auth/resend-verification` | Auth lifecycle | **NÃO ALTERAR** |
| `api/cron/reminders` | Operação global agendada (cross-tenant por desenho, protegida por `CRON_SECRET`) | **RISCO sob RLS**: lê/atualiza `Invoice` de vários tenants; requer executor privilegiado/admin explícito + auditoria; não usar tenant de payload (não há). **Não alterado.** |
| `api/invoices/[id]/email` | Tenant empresarial | **CORRIGIDO** (leitura em `runWithTenant`) |
| `api/invoices/[id]/payments` | Tenant empresarial | **CORRIGIDO** |
| `api/invoices/[id]/pdf` | Tenant empresarial | **CORRIGIDO** |
| `api/onboarding/company` | Identidade→tenant (User.tenantId NULL) | **NÃO ALTERAR** (fluxo pré-tenant controlado) |
| `api/plan/payment/proof/[id]` | Admin plataforma (comprovativo) | **GLOBAL/ADMIN** — autorização por `session.user.id` + `User.platformRole` (servidor). Usa Prisma global; compatível com modelo admin atual, mas sob RLS requer política/admin executor. **Não alterado.** |
| `api/session/refresh` | Sessão/JWT | **NÃO ALTERAR** |

## WMS/Stock (ETAPA 2)
Auditoria: rotas `api/stock/*` usam maioritariamente `runWithTenant` + auth tenant (`getTenant*Access`/`getSessionTenantId`). Serviços `stock-service` usam `runWithTenant`/tx. **Corrigido:** `api/stock/purchase` passa `userId` autenticado (remove confiança em `createdByUserId` do body para contexto). `alerts/report/returns/purchase` delegam a serviços com tenant ctx.

## Pagamentos/Relatórios/SAFT (ETAPA 3)
- **Corrigidos:** `lib/payment-service.ts`, `lib/report-service.ts`, `api/plan/payment` (tenant), `api/invoices/[id]/payments|pdf|email`, `api/invoices/generate-pdf` (quota com `userId`), `lib/saft-ao.ts`, `lib/receipt-service.ts` (usa `tx` fornecida; remove contagem global Prisma).
- **Validação tenantId:** rotas tenant usam sessão (`getTenant*Access`/`auth`+`getSessionTenantId`); IDs de recursos filtrados por `tenantId`. Não confiar em `tenantId` do cliente.

## Operações globais/admin (ETAPA 4, resumo)
- `plan/payment/proof/[id]`: admin, fonte servidor (DB `User.platformRole`). Sem acesso empresarial por tenantId cliente.
- `admin-actions.ts` / `admin-auth*`: server actions/guards com permissões plataforma; exigem razão/auditoria em vários casos. **Risco RLS:** usam Prisma/tx sem `runWithTenant` (cross-tenant intencional) — requer role/políticas admin explícitas.
- `cron/reminders`: segredo `CRON_SECRET`; cross-tenant; requer desenho admin/privilegiado sob RLS.
- Inventário completo: `RLS_ADMIN_PRIVILEGES_AUDIT.md`.
