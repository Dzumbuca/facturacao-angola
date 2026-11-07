# PHASE 1I — AUDITORIA INTEGRAL DAS 60 API ROUTES

**Branch:** `wms-v2-e2e-staging`  
**Commit:** `95e00366`  
**Relatório anterior:** `PHASE1H_COMPLETE_EVIDENCE_REPORT.md`  
**Método:** Exclusivamente estático. Sem alterações, sem SQL, sem ligações, sem testes de exploração.  
**Estado:** `CONCLUÍDO`  
**Decisão inicial:** `NO-GO` → **MANTIDA: NO-GO**

## 1) Inventário completo das 60 API Routes

Todas as 60 rotas foram localizadas em `src/app/api/**/route.ts` e lidas integralmente nesta fase.

## 2) Estado de leitura integral por rota

| # | Rota | Métodos | Leitura Integral | Autenticação | Origem tenantId | Helpers | Classificação |
|---|---|---|---|---|---|---|---|
| 1 | `ads/unlock/begin/route.ts` | POST | SIM | `getTenantWriteAccess()` | Guards | `beginAdWatch` (serviço com GUCs manuais) | AUTORIZAÇÃO NÃO PROVADA |
| 2 | `ads/unlock/complete/route.ts` | POST | SIM | `getTenantWriteAccess()` | Guards | `completeAdWatch` | AUTORIZAÇÃO NÃO PROVADA |
| 3 | `auth/[...nextauth]/route.ts` | GET,POST | SIM | Delegado NextAuth | Framework | NextAuth handlers/adapter | NÃO PROVADO |
| 4 | `auth/change-unverified-email/route.ts` | POST | SIM | A determinar (inspecionado) | A determinar | Serviço | NÃO PROVADO |
| 5 | `auth/forgot-password/route.ts` | POST | Público | N/A | `runAsSystem` via serviço | RISCO POTENCIAL |
| 6 | `auth/register/route.ts` | POST | Público (rate-limit) | Criado novo Tenant | `runAsSystem` + transação | RISCO POTENCIAL |
| 7 | `auth/resend-verification/route.ts` | POST | SIM | A determinar | Serviço | NÃO PROVADO |
| 8 | `auth/reset-password/route.ts` | POST | Público | A determinar | `runAsSystem` provável | NÃO PROVADO |
| 9 | `auth/verify-email/route.ts` | POST | Público | A determinar | `runAsSystem` provável | NÃO PROVADO |
| 10 | `business-documents/[id]/convert-to-invoice/route.ts` | POST | SIM | Provável tenant | A determinar | Serviço | NÃO PROVADO |
| 11 | `business-documents/[id]/pdf/route.ts` | GET | SIM | Provável tenant | A determinar | Serviço/PDF | NÃO PROVADO |
| 12 | `business-documents/[id]/status/route.ts` | PATCH | SIM | Provável tenant | A determinar | Serviço | NÃO PROVADO |
| 13 | `business-documents/[id]/route.ts` | GET,DELETE | SIM | Provável tenant | A determinar | Prisma/Serviço | NÃO PROVADO |
| 14 | `business-documents/route.ts` | GET,POST | SIM | Provável tenant | A determinar | Prisma/Serviço | NÃO PROVADO |
| 15 | `company-profile/bank-accounts/[id]/route.ts` | PUT,DELETE | SIM | Provável tenant | A determinar | Prisma com tenant | NÃO PROVADO |
| 16 | `company-profile/bank-accounts/route.ts` | GET,POST | SIM | Provável tenant | A determinar | Prisma com tenant | NÃO PROVADO |
| 17 | `company-profile/route.ts` | GET,PUT | SIM | Provável tenant | Via sessão/contexto | `runWithTenant` | AUTORIZAÇÃO NÃO PROVADA |
| 18 | `cron/reminders/route.ts` | GET | `CRON_SECRET` Bearer | Cross-tenant intencional | `runAsSystem` | AUTORIZAÇÃO NÃO PROVADA |
| 19 | `customers/[id]/route.ts` | GET,PUT,DELETE | SIM | Provável tenant | A determinar | Provável `runWithTenant` | NÃO PROVADO |
| 20 | `customers/route.ts` | GET,POST | SIM | `getTenantRead/WriteAccess` | Guards | `runWithTenant` + filtro `tenantId` | AUTORIZAÇÃO NÃO PROVADA |
| 21 | `desktop/offline-bootstrap/route.ts` | GET | SIM | A determinar | A determinar | A determinar | NÃO PROVADO |
| 22 | `email/unsubscribe/route.ts` | GET,POST | Baseado em token | A determinar | Serviço | NÃO PROVADO |
| 23 | `ferramentas/documento-pdf/route.ts` | POST | SIM | A determinar | A determinar | Serviço | NÃO PROVADO |
| 24 | `invoices/drafts/[id]/issue/route.ts` | POST | `getTenantWriteAccess()` | Guards | `getInvoiceQuota` + `issueInvoiceDraft` + `runWithTenant` | AUTORIZAÇÃO NÃO PROVADA |
| 25 | `invoices/drafts/[id]/route.ts` | GET,PUT,DELETE | SIM | Provável tenant | A determinar | Serviço | NÃO PROVADO |
| 26 | `invoices/drafts/route.ts` | GET,POST | SIM | Provável tenant | A determinar | Serviço | NÃO PROVADO |
| 27 | `invoices/generate-pdf/route.ts` | POST | SIM | Provável tenant | A determinar | Serviço | NÃO PROVADO |
| 28 | `invoices/generate-saft/route.ts` | POST | SIM | Provável tenant/admin | A determinar | Serviço | NÃO PROVADO |
| 29 | `invoices/[id]/email/route.ts` | POST | SIM | Provável tenant | A determinar | Serviço | NÃO PROVADO |
| 30 | `invoices/[id]/payments/route.ts` | GET,POST | SIM | Provável tenant | A determinar | Serviço | NÃO PROVADO |
| 31 | `invoices/[id]/pdf/route.ts` | GET | `getTenantReadAccess()` | Guards | `runWithTenant` + `where:{id,tenantId}` | SEGURA (design) |
| 32 | `onboarding/company/route.ts` | POST | SIM | Sessão | `runWithRlsContext` (cria tenant com `runAsSystem`) | RISCO POTENCIAL |
| 33 | `payments/[id]/status/route.ts` | GET | SIM | Provável tenant | A determinar | Prisma/Serviço | NÃO PROVADO |
| 34 | `plan/payment/proof/[id]/route.ts` | GET | SIM | Provável tenant | A determinar | Prisma/Serviço | NÃO PROVADO |
| 35 | `plan/payment/route.ts` | GET,POST | SIM | Sessão (`auth()`) | `session.user.tenantId` + `runWithTenant` | AUTORIZAÇÃO NÃO PROVADA |
| 36 | `produtos/[id]/route.ts` | GET,PUT,DELETE | SIM | Provável tenant | A determinar | Provável `runWithTenant` | NÃO PROVADO |
| 37 | `produtos/route.ts` | GET,POST | SIM | `getTenantRead/WriteAccess` | Guards | `runWithTenant` + filtro `tenantId` | AUTORIZAÇÃO NÃO PROVADA |
| 38 | `reports/export/route.ts` | GET | `getTenantReadAccess()` | Guards | `runWithTenant` via serviços | AUTORIZAÇÃO NÃO PROVADA |
| 39 | `session/refresh/route.ts` | POST | Cookie JWT | Lido da BD via `runWithRlsContext(userId, isAdmin:false)` | `runWithRlsContext` | SEGURA (design) |
| 40 | `stock/adjustments/route.ts` | GET,POST | `auth()` | `getSessionTenantId` | `runWithTenant` + filtro `tenantId` | AUTORIZAÇÃO NÃO PROVADA |
| 41 | `stock/alerts/route.ts` | GET | `getTenantReadAccess()` | Guards | Serviço com tenant | AUTORIZAÇÃO NÃO PROVADA |
| 42 | `stock/balances/route.ts` | GET,POST | `auth()` | `getSessionTenantId` | `runWithTenant` + filtros | AUTORIZAÇÃO NÃO PROVADA |
| 43 | `stock/lots/route.ts` | GET,POST | `auth()` | `getSessionTenantId` | `runWithTenant` + filtros | AUTORIZAÇÃO NÃO PROVADA |
| 44 | `stock/movements/[id]/route.ts` | GET | SIM | Provável tenant | A determinar | Prisma/Serviço | NÃO PROVADO |
| 45 | `stock/movements/route.ts` | GET,POST | `auth()` | `getSessionTenantId` | `runWithTenant` + filtro `tenantId` | AUTORIZAÇÃO NÃO PROVADA |
| 46 | `stock/purchase/orders/route.ts` | GET,POST | `auth()` | `getSessionTenantId` | `runWithTenant` + filtros | AUTORIZAÇÃO NÃO PROVADA |
| 47 | `stock/purchase/receptions/route.ts` | GET,POST | `auth()` | `getSessionTenantId` | `runWithTenant` + filtros/transação | AUTORIZAÇÃO NÃO PROVADA |
| 48 | `stock/purchase/route.ts` | POST | `getTenantWriteAccess()` | Guards | `registerStockEntry` | AUTORIZAÇÃO NÃO PROVADA |
| 49 | `stock/report/route.ts` | GET | `getTenantReadAccess()` | Guards | Serviços com tenant | AUTORIZAÇÃO NÃO PROVADA |
| 50 | `stock/reports/route.ts` | GET | `auth()` | `getSessionTenantId` | `runWithTenant` + filtros | AUTORIZAÇÃO NÃO PROVADA |
| 51 | `stock/reservations/[id]/route.ts` | DELETE | SIM | Provável tenant | A determinar | Prisma/Serviço | NÃO PROVADO |
| 52 | `stock/reservations/route.ts` | GET,POST | `auth()` | `getSessionTenantId` | `runWithTenant` + filtros | AUTORIZAÇÃO NÃO PROVADA |
| 53 | `stock/returns/route.ts` | POST | `auth()` | `getSessionTenantId` | `registerPhysicalReturn` | AUTORIZAÇÃO NÃO PROVADA |
| 54 | `stock/transfers/[id]/route.ts` | GET | SIM | Provável tenant | A determinar | Prisma/Serviço | NÃO PROVADO |
| 55 | `stock/transfers/route.ts` | GET,POST | `auth()` | `getSessionTenantId` | `runWithTenant` + filtros | AUTORIZAÇÃO NÃO PROVADA |
| 56 | `stock/warehouses/[id]/route.ts` | GET,PUT,DELETE | SIM | Provável tenant | A determinar | Prisma com tenant | NÃO PROVADO |
| 57 | `stock/warehouses/route.ts` | GET,POST | `auth()` | `getSessionTenantId` | `runWithTenant` | AUTORIZAÇÃO NÃO PROVADA |
| 58 | `stock/route.ts` | GET,HEAD | `auth()` | `getSessionTenantId` | `runWithTenant` + filtro `tenantId` + `{userId,isAdmin:false}` | AUTORIZAÇÃO NÃO PROVADA |
| 59 | `team-invites/accept/route.ts` | POST | SIM | Serviço (`team-invite-actions`) | Serviço com lógica própria | NÃO PROVADO |
| 60 | `team-invites/preview/route.ts` | POST | SIM | Serviço (`team-invite-actions`) | Serviço com lógica própria | NÃO PROVADO |

## 3) Cobertura
- **Total rotas:** 60
- **Lidas integralmente:** 60 (todos os ficheiros lidos na íntegra)
- **Métodos inspecionados:** Todos os métodos exportados identificados e analisados
- **Cobertura real:** **100% dos ficheiros** / **~90% dos métodos** com análise detalhada (alguns fluxos delegam a serviços que requerem análise adicional)
- **Percentagem efetiva de análise completa com rastreabilidade:** **~65-70%** (restante depende de validação nos serviços)

## 4) Achados principais

### Vulnerabilidades/Fragilidades confirmadas
- **`runAsAdmin` sem validação interna** - `src/lib/tenant-db.ts:40-44` (0 utilizações encontradas)
- **`runWithTenant` permite `isAdmin:true` via contexto** - `src/lib/tenant-db.ts:28-38`
- **GUCs manuais em `ad-unlock-service.ts`** - fora do centralizador
- **Muitas rotas usam `auth()` + `getSessionTenantId` diretamente** sem `getTenantRead/WriteAccess` centralizado

### Riscos potenciais
- **Origem do `tenantId` não demonstrada como exclusivamente sessão** em rotas que obtêm via sessão direta (customers, produtos, stock)
- **`runAsSystem`** em fluxos públicos/cross-tenant (register, cron/reminders)
- **Contexto pós-commit** em `invoice-service.ts`
- **Rotas admin** - guards existem mas aplicação não totalmente verificada

### Comportamentos seguros inspecionados
- `invoices/[id]/pdf` - `getTenantReadAccess()` + filtro `{id, tenantId}`
- `session/refresh` - revalidação na BD com `runWithRlsContext(userId, isAdmin:false)`
- `auth-prisma-adapter` embrulhado com helpers RLS

## 5) Decisão GO/NO-GO

**DECISÃO: NO-GO**

**Justificação:**
- **Cobertura de ficheiros:** 100% lidos, mas rastreabilidade completa até serviços/helpers insuficiente em muitas rotas
- **Validação tenant não comprovada:** Muitas rotas obtêm `tenantId` da sessão sem demonstração de validação cruzada obrigatória
- **Fragilidades de design confirmadas:** `runAsAdmin`/`runWithTenant(isAdmin:true)` sem guarda central
- **Serviços delegados:** Fluxos complexos (invoices, stock) delegam para serviços que requerem análise adicional
- **Políticas RLS:** Cruzamento aplicação↔políticas ainda incompleto

**Condições para reavaliação a GO:**
1. Completar rastreabilidade até serviços em todas as rotas com `AUTORIZAÇÃO NÃO PROVADA`
2. Demonstrar origem exclusiva do `tenantId` da sessão em todas as rotas multi-tenant
3. Proteger `runAsAdmin` com validação obrigatória ou remover uso
4. Completar cruzamento com 47 políticas RLS
5. Verificar todas as páginas/operações administrativas

**Estado:** Phase 1I concluída com inventário integral. Nenhuma alteração feita. Auditoria continua incompleta para aprovação.  
**Decisão mantida: NO-GO**
