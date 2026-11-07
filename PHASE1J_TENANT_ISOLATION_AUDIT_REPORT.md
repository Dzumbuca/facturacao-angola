# PHASE 1J — TENANT ISOLATION & DATA ACCESS AUDIT (FINAL RECONCILIATION)

**Projecto:** `C:\Users\Administrador\Desktop\facturacao-angola`  
**Branch:** `wms-v2-e2e-staging` | **Commit:** `95e00366`  
**Relatório:** `PHASE1J_TENANT_ISOLATION_AUDIT_REPORT.md` (única alteração permitida)  
**Método:** Análise exclusivamente estática. Sem alterações de código, SQL, ligações BD, testes HTTP/exploração, acesso produção, credenciais/.env, alterações RLS/policies/roles/GRANTs, deploy, mudança de branch, commits.  
**Decisão final:** **NO-GO** — ausência de vulnerabilidade demonstrada ≠ prova de segurança.

## 1) Executive Summary
- **60/60 rotas** reconciliadas na Matriz A com **uma classificação principal por rota** (total = 60). Ressalvas registadas separadamente.
- **Inventário global de helpers/GUCs/isAdmin** concluído por pesquisa estática em `src/`.
- **Inventário Prisma** efectuado por pesquisa de padrões (`find*/create*/update*/upsert/delete*/$transaction/raw`) em `src/**/*.ts,tsx`; classificação por categorias fornecida com limitações explícitas (não equivale a prova de exaustividade semântica por chamada).
- **Mutações stock id-only** analisadas individualmente (lookup→ownership→tx/helper→modelo→garantia final).
- **team-invites** analisado (preview/accept + `team-invite-actions`): fluxo plataforma, token/expiração/single-use, lógica aplicacional; fronteira RLS **não confirmada**.
- **ad-unlock** revisto: claim/link/GUCs/nested tx/caminhos falha/pós-commit documentados; semântica runtime **não comprovada** estaticamente.

## 2) Reconciliação das 60 Rotas (Matriz A)
**Fonte:** `tmp/phase1i-route-list.txt` (60 entradas). Cada rota tem **uma única classificação principal** na Matriz A; ressalvas técnicas registadas na coluna "Ressalvas" sem alterar a classificação principal nem as conclusões de segurança.

**Contagem final reconciliada (total 60):** TRACED **51** | PARTIAL **6** | NOT CONFIRMED **3**. (**51 + 6 + 3 = 60**)

**TRACED (51):** ads/unlock/begin, ads/unlock/complete, auth/change-unverified-email, auth/forgot-password, auth/register, auth/resend-verification, auth/reset-password, auth/verify-email, business-documents/[id]/convert-to-invoice, business-documents/[id]/pdf, business-documents/[id]/status, business-documents/[id], business-documents, company-profile/bank-accounts/[id], company-profile/bank-accounts, company-profile, cron/reminders, customers/[id], customers, desktop/offline-bootstrap, email/unsubscribe, ferramentas/documento-pdf, invoices/[id]/email, invoices/[id]/payments, invoices/[id]/pdf, invoices/drafts/[id]/issue, invoices/drafts/[id], invoices/drafts, invoices/generate-pdf, invoices/generate-saft, onboarding/company, payments/[id]/status, plan/payment/proof/[id], plan/payment, produtos/[id], produtos, reports/export, session/refresh, stock/alerts, stock/balances, stock/lots, stock/movements, stock/purchase, stock/purchase/orders, stock/report, stock/reports, stock/reservations, stock/returns, stock, stock/transfers, stock/warehouses.

**PARTIAL (6):** stock/adjustments, stock/movements/[id], stock/purchase/receptions, stock/reservations/[id], stock/transfers/[id], stock/warehouses/[id].

**NOT CONFIRMED (3):** auth/[...nextauth], team-invites/accept, team-invites/preview.

**Nota de reconciliação:** a lista PARTIAL anterior mencionada na missão (6 identificadores) corresponde exactamente aos 6 registos PARTIAL da Matriz A. A contagem no cabeçalho anterior (4) estava inconsistente com a Matriz A; corrigida sem alterar evidências nem conclusões.

| # | Route | Method(s) | Primary | Auth | Tenant/user origin | Helper/Service | Evidência-chave (ficheiro:linha) | Ressalvas |
|---|---|---:|---|---|---|---|---|---|
| 1 | `ads/unlock/begin` | POST | TRACED | `getTenantWriteAccess` | `access.access.tenantId` | `ad-unlock-service.beginAdWatch` | `api/ads/unlock/begin/route.ts`; `lib/ad-unlock-service.ts:49-86` | Nested tx/GUC semântica runtime não confirmada |
| 2 | `ads/unlock/complete` | POST | TRACED | `getTenantWriteAccess` | guard session | `completeAdWatch` | `api/ads/unlock/complete/route.ts`; `ad-unlock-service.ts:88-109` | idem |
| 3 | `auth/[...nextauth]` | GET,POST | NOT CONFIRMED | rate-limit POST; NextAuth | framework/JWT | `handlers`, `auth.ts`, `auth-prisma-adapter.ts` | `api/auth/[...nextauth]/route.ts`; `lib/auth.ts`; `lib/auth-prisma-adapter.ts:19-69` | Config estática traçada; produção OAuth/pooling/DB-session/linking **não confirmada** |
| 4 | `auth/change-unverified-email` | POST | TRACED | public+password+allowEmailRequest | email (unverified) | `runAsSystem` tx | `api/auth/change-unverified-email/route.ts:16-26` | bootstrap server-controlled |
| 5 | `auth/forgot-password` | POST | TRACED | public+rate-limit | email lookup | `runAsSystem` | `api/auth/forgot-password/route.ts:16` | cross-tenant lookup intencional, resposta genérica |
| 6 | `auth/register` | POST | TRACED | public+rate-limit | cria tenant | `runAsSystem` | `api/auth/register/route.ts:20-42` | bootstrap |
| 7 | `auth/resend-verification` | POST | TRACED | public+rate-limit | email lookup | `runAsSystem` | `api/auth/resend-verification/route.ts:15` | intencional |
| 8 | `auth/reset-password` | POST | TRACED | public+rate-limit | token | `runAsSystem` via `email-actions.resetPasswordWithToken` | `api/auth/reset-password/route.ts`; `lib/email-actions.ts:107-131` | token-gated, `FOR UPDATE` |
| 9 | `auth/verify-email` | POST | TRACED | public | token | `runAsSystem` via `verifyEmailToken` | `api/auth/verify-email/route.ts`; `email-actions.ts:78-106` | token-gated, single-use consume |
| 10 | `business-documents/[id]/convert-to-invoice` | POST | TRACED | `getTenantWriteAccess` | guard session | service+repo `runWithTenant` | `api/business-documents/[id]/convert-to-invoice/route.ts`; `lib/business-document-repository.ts:88-116` | lock/filters `id,tenantId` |
| 11 | `business-documents/[id]/pdf` | GET | TRACED | `getTenantReadAccess` | guard | service + `runWithTenant` logo | `api/business-documents/[id]/pdf/route.ts` | logo `findFirst` por `id,tenantId` |
| 12 | `business-documents/[id]/status` | POST | TRACED | `getTenantWriteAccess` | guard | repo `runWithTenant` | `api/business-documents/[id]/status/route.ts`; `business-document-repository.ts:77-86` | `updateMany` por `id,tenantId,status` |
| 13 | `business-documents/[id]` | GET,PUT | TRACED | guard read/write | guard | repo `runWithTenant` | `api/business-documents/[id]/route.ts`; `business-document-repository.ts:62-76` | `id,tenantId` |
| 14 | `business-documents` | GET,POST | TRACED | guard read/write | guard | repo `runWithTenant` | `api/business-documents/route.ts`; `business-document-repository.ts:40-61,117-138` | tenant scoped |
| 15 | `company-profile/bank-accounts/[id]` | PUT | TRACED | guard write `company_settings` | guard | `runWithTenant` | `api/company-profile/bank-accounts/[id]/route.ts` | ownership check + scoped updates |
| 16 | `company-profile/bank-accounts` | GET,POST | TRACED | guard read/write `company_settings` | guard | `runWithTenant` | `api/company-profile/bank-accounts/route.ts` | scoped |
| 17 | `company-profile` | GET,PUT | TRACED | guard read/write `company_settings` | guard | `runWithTenant` | `api/company-profile/route.ts:66-138` | mutações finais maioritariamente scoped; contexto RLS presente |
| 18 | `cron/reminders` | GET | TRACED | `CRON_SECRET` Bearer | cross-tenant | `runAsSystem` | `api/cron/reminders/route.ts:5,27,47` | intencional, secret-gated |
| 19 | `customers/[id]` | PATCH,DELETE | TRACED | guard write | guard | `runWithTenant` | `api/customers/[id]/route.ts` | `find/update/deleteMany` por `id,tenantId` |
| 20 | `customers` | GET,POST | TRACED | guard read/write | guard | `runWithTenant` | `api/customers/route.ts:10,27` | explícito |
| 21 | `desktop/offline-bootstrap` | POST | TRACED | guard write | guard | `runWithTenant` | `api/desktop/offline-bootstrap/route.ts` | leituras scoped; grant assinado |
| 22 | `email/unsubscribe` | POST | TRACED | token public | token hash | `runAsSystem` in `email-actions` | `api/email/unsubscribe/route.ts`; `email-actions.ts:135-146` | token-gated |
| 23 | `ferramentas/documento-pdf` | POST | TRACED | public+rate-limit+size | N/A | no DB | `api/ferramentas/documento-pdf/route.ts` | sem acesso tenant |
| 24 | `invoices/[id]/email` | POST | TRACED | guard write | guard | `runWithTenant` | `api/invoices/[id]/email/route.ts` | `invoice.findFirst` por `id,tenantId`; destinatário validado |
| 25 | `invoices/[id]/payments` | GET,POST | TRACED | guard read/write | guard | `runWithTenant` + `payment-service` | `api/invoices/[id]/payments/route.ts`; `payment-service.ts:14-74` | scoped |
| 26 | `invoices/[id]/pdf` | GET | TRACED | guard read | guard | `runWithTenant` | `api/invoices/[id]/pdf/route.ts` | `findFirst` por `id,tenantId` |
| 27 | `invoices/drafts/[id]/issue` | POST | TRACED | guard write | guard | draft+invoice services `runWithTenant` | `api/invoices/drafts/[id]/issue/route.ts`; `invoice-draft-service.ts:75-110`; `invoice-service.ts:21-265` | ad-unlock caveat runtime |
| 28 | `invoices/drafts/[id]` | GET,PUT | TRACED | guard read/write | guard | draft service `runWithTenant` | `api/invoices/drafts/[id]/route.ts`; `invoice-draft-service.ts:41-69` | `id,tenantId` |
| 29 | `invoices/drafts` | GET,POST | TRACED | guard read/write | guard | `runWithTenant`/service | `api/invoices/drafts/route.ts`; `invoice-draft-service.ts:10-39,71-73` | offline grant validado |
| 30 | `invoices/generate-pdf` | POST | TRACED | guard write | guard | `issueInvoice`→`runWithTenant` | `api/invoices/generate-pdf/route.ts`; `invoice-service.ts:21+` | scoped |
| 31 | `invoices/generate-saft` | GET | TRACED | guard read | guard | `runWithTenant` in `saft-ao` | `api/invoices/generate-saft/route.ts`; `saft-ao.ts:6+` | scoped |
| 32 | `onboarding/company` | POST | TRACED | `auth()` session | `session.user.id` | `runWithRlsContext` + `runAsSystem` | `api/onboarding/company/route.ts:26-44` | ligação `updateMany` condicional `tenantId:null`; criação tenant em `runAsSystem` | risco de desenho (contextos mistos) |
| 33 | `payments/[id]/status` | POST | TRACED | guard write | guard | `payment-service.transitionPayment` `runWithTenant` | `api/payments/[id]/status/route.ts`; `payment-service.ts:52-68` | `findFirst/updateMany` por `id,tenantId,status` |
| 34 | `plan/payment/proof/[id]` | GET | TRACED | `auth()` + `platformRole` ADMIN/SUPERADMIN | admin session | `runAsAdmin` | `api/plan/payment/proof/[id]/route.ts:14-24` | leitura cross-tenant intencional (plataforma) |
| 35 | `plan/payment` | GET,POST | TRACED | `auth()` | `session.user.tenantId`/`id` | `runWithTenant` | `api/plan/payment/route.ts` | usa sessão directa (não guard helper) |
| 36 | `produtos/[id]` | PATCH,DELETE | TRACED | guard write | guard | `runWithTenant` | `api/produtos/[id]/route.ts` | `id,tenantId` |
| 37 | `produtos` | GET,POST | TRACED | guard read/write | guard | `runWithTenant` | `api/produtos/route.ts:10,27` | explícito |
| 38 | `reports/export` | GET | TRACED | guard read | guard | report-service `runWithTenant` | `api/reports/export/route.ts`; `report-service.ts:6+` | scoped |
| 39 | `session/refresh` | POST | TRACED | cookie JWT + secret + `token.sub` | `token.sub` → DB self | `runWithRlsContext(..., {userId:token.sub, tenantId:null, isAdmin:false})` | `api/session/refresh/route.ts:20-28`; `lib/session-refresh-security.ts` | valida status/sessionVersion/email |
| 40 | `stock/adjustments` | GET,POST | PARTIAL | `auth()` | `getSessionTenantId` | `runWithTenant` | `api/stock/adjustments/route.ts` | `product.update({where:{id}})` e mutações por id após validações tenant — **RLS-dependente** |
| 41 | `stock/alerts` | GET | TRACED | guard read | guard | `stock-service.getLowStockAlerts` `runWithTenant` | `api/stock/alerts/route.ts`; `stock-service.ts:205-212` | scoped |
| 42 | `stock/balances` | GET,POST | TRACED | `auth()` | `getSessionTenantId` | `runWithTenant` | `api/stock/balances/route.ts` | valida product/warehouse por tenantId |
| 43 | `stock/lots` | GET,POST | TRACED | `auth()` | `getSessionTenantId` | `runWithTenant` | `api/stock/lots/route.ts` | valida product por tenantId |
| 44 | `stock/movements/[id]` | DELETE | PARTIAL | guard write | guard | **direct `prisma`** lookup | `api/stock/movements/[id]/route.ts` (DELETE) | filtro `{id,tenantId}` mas **fora helper RLS**; operação desactivada (403) |
| 45 | `stock/movements` | GET,POST | TRACED | `auth()` | `getSessionTenantId` | `runWithTenant` | `api/stock/movements/route.ts` | valida product/warehouse; OUT usa `updateMany` guard |
| 46 | `stock/purchase/orders` | GET,POST | TRACED | `auth()` | `getSessionTenantId` | `runWithTenant` | `api/stock/purchase/orders/route.ts` | valida supplier por tenantId |
| 47 | `stock/purchase/receptions` | GET,POST | PARTIAL | `auth()` | `getSessionTenantId` | `runWithTenant` | `api/stock/purchase/receptions/route.ts` | PO scoped; `product.update({where:{id}})` após lookup — RLS-dependente |
| 48 | `stock/purchase` | POST | TRACED | guard write | guard | `registerStockEntry`→`runWithTenant` | `api/stock/purchase/route.ts`; `stock-service.ts:131+` | scoped |
| 49 | `stock/report` | GET | TRACED | guard read | guard | stock-service `runWithTenant` | `api/stock/report/route.ts`; `stock-service.ts:215,232` | scoped |
| 50 | `stock/reports` | GET | TRACED | `auth()` | `getSessionTenantId` | `runWithTenant` | `api/stock/reports/route.ts` | queries scoped |
| 51 | `stock/reservations/[id]` | PATCH | PARTIAL | `auth()` | `getSessionTenantId` | `runWithTenant` | `api/stock/reservations/[id]/route.ts` | reserva por `id,tenantId`; `product.update({id})` — RLS-dependente |
| 52 | `stock/reservations` | GET,POST | TRACED | `auth()` | `getSessionTenantId` | `runWithTenant` | `api/stock/reservations/route.ts` | valida refs; `updateMany` stock guard |
| 53 | `stock/returns` | POST | TRACED | `auth()` | `getSessionTenantId` | service→`runWithTenant` | `api/stock/returns/route.ts`; `stock-service.ts` | scoped |
| 54 | `stock` | GET,HEAD | TRACED | `auth()` | `getSessionTenantId` | `runWithTenant` | `api/stock/route.ts:25` | `where.tenantId` |
| 55 | `stock/transfers/[id]` | GET,PATCH | PARTIAL | `auth()` | `getSessionTenantId` | `runWithTenant` | `api/stock/transfers/[id]/route.ts` | transfer por `id,tenantId`; mutações `product.update({id})` — RLS-dependente |
| 56 | `stock/transfers` | GET,POST | TRACED | `auth()` | `getSessionTenantId` | `runWithTenant` | `api/stock/transfers/route.ts` | warehouses/items scoped |
| 57 | `stock/warehouses/[id]` | PATCH,DELETE | PARTIAL | guard write | guard | `runWithTenant` | `api/stock/warehouses/[id]/route.ts` | `findFirst` por `id,tenantId` depois `update/delete` por `id` — RLS-dependente |
| 58 | `stock/warehouses` | GET,POST | TRACED | `auth()` | `getSessionTenantId` | `runWithTenant` | `api/stock/warehouses/route.ts` | scoped |
| 59 | `team-invites/accept` | POST | NOT CONFIRMED | token public | token hash → invite/platform user | `team-invite-actions.acceptTeamInvite` (global `db`) | `api/team-invites/accept/route.ts`; `lib/team-invite-actions.ts:79-105` | fluxo traçado; usa Prisma global sem helper RLS; fronteira RLS/política **não confirmada** |
| 60 | `team-invites/preview` | POST | NOT CONFIRMED | token public | token hash | `team-invite-actions.previewTeamInvite` (global `db`) | `api/team-invites/preview/route.ts`; `team-invite-actions.ts:71-77` | idem |

## 3) Inventário Prisma (pesquisa estática em `src/`)
**Pesquisa:** `\.(findUnique|findFirst|findMany|create|createMany|update|updateMany|upsert|delete|deleteMany|executeRaw|queryRaw|executeRawUnsafe|queryRawUnsafe|\$transaction)\s*\(` em `src/**/*.ts,tsx`.  
**Limitação:** a pesquisa identifica ocorrências por padrão; **não prova exaustividade semântica** (chamadas dinâmicas, helpers gerados, código não capturado por padrão, ou contexto de autorização completo por chamada). Inclui testes, módulos admin, serviços e rotas.

### 3.1 Classes de isolamento (resumo)
| Classe | Descrição | Exemplos representativos (ficheiro:linha) |
|---|---|---|
| 1. Tenant explícito | `where`/dados incluem `tenantId` e/ou `id,tenantId` | `customers/route.ts:10,27`; `produtos/[id]/route.ts`; `invoice-draft-service.ts:43,55,64,76,78,87,104-106,117`; `business-document-repository.ts:28,34,37,62,65,73,77,80,84,117`; `stock/movements/route.ts`; `payment-service.ts:18,54,57,71`; `saft-ao.ts:7,10` |
| 2. Tenant por relação/filtro composto | ownership inferida por pai/condição composta | `team-invite accept` usa token+status+expiry; `onboarding` `user.updateMany({id:userId,tenantId:null})`; `business-document` locks `id,tenantId` |
| 3. Dependente de RLS/contexto | helper RLS presente; mutação final pode ser por `id` | `stock/warehouses/[id]/route.ts` (`findFirst` scoped + `update/delete` por `id` em `runWithTenant`); `stock/adjustments|purchase/receptions|reservations/[id]|transfers/[id]` (`product.update({id})` em tx tenant) |
| 4. Operação global privilegiada | plataforma/bootstrap/infra/cron/token | `runAsSystem` em `email-actions.ts`, auth routes; `admin-actions.ts`, `admin-data.ts`, `team-invite-actions.ts` (global `db`, permissões plataforma); `cron/reminders`; `plan/payment/proof` via `runAsAdmin` |
| 5. Potencial cross-tenant / fragilidade | acesso global ou mutação RLS-dependente sem prova final | `team-invite-actions.ts`/`admin-*` (plataforma, não tenant data); mutações stock id-only (secção 4); `stock/movements/[id]` direct prisma |
| 6. Não confirmado | falta prova estática suficiente | OAuth runtime; nested tx ad-unlock; cobertura RLS para mutações id-only; exaustividade semântica total |

### 3.2 Prisma fora helpers centrais / imports directos
| Ficheiro:linha | Contexto | Classificação |
|---|---|---|
| `api/stock/movements/[id]/route.ts` (DELETE) | `prisma.stockMovement.findFirst({id,tenantId})`; retorna 403 | filtro explícito, **sem helper RLS** — fragilidade |
| `lib/admin-actions.ts:4,24+`, `lib/admin-data.ts:2,20+` | `db = prisma`; server actions/data com `requirePlatformPermission` | global plataforma privilegiada (4) |
| `lib/team-invite-actions.ts:5,31+` | `db = prisma`; permissões plataforma em create/resend/cancel; preview/accept token-based | global plataforma/token (4/6) |
| `lib/email-actions.ts:4` + `runAsSystem` | infra/token/audit | privilegiada controlada (4) |
| `lib/invoice-share.ts`, `lib/platform-apps.ts`, `lib/platform-backfill.ts`, `lib/register-machine-stock.ts` | import prisma / operações utilitárias/admin | rever caso-a-caso; não mapeadas como rotas tenant nesta fase (6 parcial) |
| `app/(dashboard)/layout.tsx:3`, `page.tsx:5`, `academia/page.tsx:3`, `admin/layout.tsx:4`, `ferramentas/page.tsx:3`, `inicio/page.tsx:7`, componentes `platform-ad.tsx`, `tool-page.tsx`, `email-action-pages.tsx` | Server/Client UI contexts | fora do escopo HTTP API tenant; classificação **não concluída** aqui (6) |

## 4) Mutações Stock RLS-dependentes (análise individual)
| Mutação | Lookup inicial | Ownership/validação | Contexto tx/helper | Modelo | Garantia na operação final | Classificação |
|---|---|---|---|---|---|---|
| `warehouse.update({where:{id}})` em `api/stock/warehouses/[id]/route.ts` | `tx.warehouse.findFirst({where:{id,tenantId},select:{id}})` | falha se não encontrado para tenant | `runWithTenant(tenantId, async tx=>...)` | `Warehouse` | **`update` filtra só por `id`**; depende de RLS/contexto e impossibilidade prática de ID obtido fora do tenant | **Dependente de RLS / NÃO CONFIRMADO** como isolamento DB-final explícito |
| `warehouse.delete({where:{id}})` em `api/stock/warehouses/[id]/route.ts` | `findFirst({id,tenantId})` | idem | `runWithTenant` tx | `Warehouse` | **`delete` por `id`**; depende de RLS/contexto | idem |
| `product.update({where:{id}})` em `api/stock/adjustments/route.ts` (POST) | valida `warehouse.findFirst({id,tenantId})`; stock/reservas por `tenantId,productId,warehouseId,lotId` | produto/warehouse inferidos por fluxo tenant-scoped; item `productId` vem do body | `runWithTenant` tx (`isAdmin:false`) | `Product` | **`update` por `id`** sem `tenantId`; depende de RLS/contexto e validações anteriores | **Dependente de RLS / NÃO CONFIRMADO** |
| `product.update({where:{id}})` em `api/stock/purchase/receptions/route.ts` | PO `findFirst({id:purchaseOrderId,tenantId})`; itens processados no contexto da PO | PO pertence ao tenant; `productId` em itens do body | `runWithTenant` tx | `Product` | `update` por `id`; depende de contexto/RLS | **Dependente de RLS / NÃO CONFIRMADO** |
| `product.update({where:{id}})` em `api/stock/reservations/[id]/route.ts` (PATCH) | `stockReservation.findFirst({id,tenantId})` | reserva pertence ao tenant | `runWithTenant` tx | `Product` | `update` por `id: resv.productId`; produto não revalidado por tenant no patch | **Dependente de RLS / NÃO CONFIRMADO** |
| `product.update({where:{id}})` em `api/stock/transfers/[id]/route.ts` (PATCH dispatch/receive) | `stockTransfer.findFirst({id,tenantId}, include items)` | transfer pertence ao tenant; itens associados | `runWithTenant` tx | `Product` | `update` por `id: it.productId` | **Dependente de RLS / NÃO CONFIRMADO** |

**Conclusão stock:** a validação anterior reduz risco, mas **não prova** que a mutação final seja inalcançável cross-tenant se IDs/relacionamentos forem manipulados em cenários não cobertos por constraints/RLS. **Sem testes/SQL/políticas cruzadas, manter NO-GO para prova completa.**

## 5) team-invites (análise integral)
| Aspecto | Evidência |
|---|---|
| Rotas | `api/team-invites/preview/route.ts` chama `previewTeamInvite(token)`; `accept/route.ts` chama `acceptTeamInvite(body)` |
| Serviço | `lib/team-invite-actions.ts` (`db = prisma as any`) |
| Operações globais/plataforma | `platformTeamInvite` create/find/update/updateMany; `user` find/create/update por email/id; `adminAuditLog` create. Controladas por `requirePlatformPermission('team.invite')` em create/resend/cancel; preview/accept são token-based |
| Tenant? | Convites atribuem `platformRole/platformPermissions` (equipa plataforma), **não tenantId**. Não é fluxo de convite tenant multi-tenant no sentido de `tenantId` no registo visto |
| Validação token | formato regex; `tokenHash(rawToken)` SHA-256; lookup por `tokenHash`; preview exige `status=PENDING` e `expiresAt>now`; accept revalida em tx Serializable |
| Reutilização/expiração/associação | create/resend: expira em 72h; accept: `updateMany({id, status:PENDING, expiresAt:{gt:now}}, ACCEPTED)` com `count===1` (single-use); cancel: `updateMany PENDING→REVOKED`; utilizador suspenso bloqueado |
| Garantias RLS | **Nenhum helper RLS** (`runWithTenant/runAsSystem` não usado). Depende de lógica aplicacional, constraints, `Serializable` tx e modelo plataforma |
| Classificação | **NOT CONFIRMED** quanto à fronteira RLS/políticas; **sem vulnerabilidade demonstrada** estaticamente |

## 6) ad-unlock (lacunas remanescentes)
| Item | Evidência | Estado |
|---|---|---|
| Cadeia | `issue route` → `invoice-draft-service.issueInvoiceDraft` → `invoice-service.issueInvoice` → `claimUnlockForEmission` → pós-commit `linkUnlockToInvoice` | traçada |
| Transacções | `issueInvoice` corre em `runWithTenant` (outer tx). `claim/link` usam `withTenantContext`: se executor tem `$transaction`, abrem **tx aninhada** | **semântica runtime não comprovada** (savepoints/GUC local vs outer) |
| GUCs | ad-unlock define `app.tenant_id`, `app.user_id=''`, `app.is_admin='false'` na tx aninhada | filtros SQL por `tenant_id` presentes |
| Claim | `UPDATE AdUnlock ... WHERE tenant_id=...` com subselect `FOR UPDATE SKIP LOCKED` e `RETURNING` | tenant explícito |
| Link | `UPDATE` por `id AND tenant_id AND status='CONSUMED' AND consumed_by_invoice_id IS NULL` | tenant explícito; pós-commit best-effort |
| Falhas/reconciliação | draft reconcilia `ISSUING` em erro; link falha não reverte factura; unlock permanece consumido | risco de auditoria parcial, não reuso comprovado |

## 7) Matriz C — Helpers/GUCs/Privilégios (global)
| Item | Ocorrências-chave (ficheiro:linha) | Classificação |
|---|---|---|
| `runWithRlsContext` | `tenant-db.ts:21,36,41,46,51`; `admin-auth.ts:22,38`; `auth-prisma-adapter.ts:26`; `auth.ts:48,92`; `session/refresh:20`; `onboarding/company:26` | server-controlled/self/bootstrap |
| `runWithTenant` | defs `tenant-db.ts:28-37`; callers em rotas tenant + serviços (`business-document-repository`, `invoice-*`, `payment`, `report`, `saft`, `stock`) | padrão tenant; `isAdmin` caller-controlled |
| `runAsAdmin` | `tenant-db.ts:40`; `plan/payment/proof/[id]` (após gate plataforma) | privilegiado justificado por gate |
| `runAsAuth` | `tenant-db.ts:44` | sem callers |
| `runAsSystem` | `tenant-db.ts:49`; `auth-prisma-adapter.ts:20,27`; `email-actions.ts` múltiplas; `auth/*` bootstrap; `onboarding/company`; `cron/reminders` | privilegiado sensível, controlos variam |
| `isAdmin:true` | `auth.ts:51`; `tenant-db.ts:41,51` | pré-auth server-controlled + defs |
| `set_config/current_setting` | `tenant-db.ts:16-18`; `ad-unlock-service.ts:52-54` | apenas helpers internos |

## 8) Critérios de Fecho (Phase 1J)
| Critério | Estado | Bloqueio |
|---|---|---|
| 60 rotas com classificação fundamentada | **Sim** (Matriz A, 60/60) | — |
| Fluxos prioritários integralmente rastreados | **Maioritariamente**; mutações stock RLS-dependentes e ressalvas auth/team-invites | prova final de mutações id-only e fronteiras RLS |
| Origem/validação tenantId documentadas | **Sim** (por rota/fluxo) | — |
| Chamadores helpers privilegiados inventariados | **Sim** (pesquisa global) | — |
| `isAdmin:true` ocorrências justificadas | **Sim** (3 ocorrências) | — |
| Acessos Prisma relevantes classificados | **Parcial** (pesquisa + classes; exaustividade semântica não provada) | inventário por chamada completo + justificação |
| Fluxo ad-unlock concluído ou limitado | **Limitado/traçado** | nested tx/GUC runtime |
| Dependências RLS identificadas | **Sim** (mutações id-only, tabelas/políticas não cruzadas — Phase 1K) | crosswalk políticas necessário |

## 9) Achados
- **Vulnerabilidades demonstradas:** 0.
- **Fragilidades arquitecturais:** helpers caller-trusted; `runWithTenant` aceita `isAdmin`; GUC dividido; padrões auth mistos; mutações id-only após lookup; Prisma directo em `stock/movements/[id]`; team-invites/admin com Prisma global sem padrão tenant-helper.
- **Riscos potenciais:** onboarding mixed contexts; nested tx ad-unlock; cron/secret/bootstrap/token; OAuth produção; mutações RLS-dependentes.
- **Não confirmados:** OAuth produção; fronteira RLS team-invites; semântica nested tx ad-unlock; isolamento DB-final de mutações id-only; exaustividade semântica total de Prisma.

## 10) Decisão e Impedimentos ao Fecho
**NO-GO.** Impede GO: (1) mutações stock e mutações por `id` após lookup sem prova de isolamento DB-final via política RLS/crosswalk; (2) `team-invites` e partes de auth com fronteiras/políticas ou comportamento runtime não confirmados; (3) ad-unlock nested tx/GUC runtime não comprovado; (4) inventário Prisma semanticamente exaustivo não demonstrado. **Não avançar para Phase 1K. Não corrigir código.**

## Addendum — 2026-11-06 targeted security follow-up (code hardening, not Phase 1K)
- Scope: reviewed Phase 1J PARTIAL/NOT CONFIRMED WMS/auth-adjacent surfaces and applied **minimal defense-in-depth fixes in untracked WMS routes only**. No DB/RLS/policy/GRANT/migration/production actions.
- **Hardened (untracked):** `src/app/api/stock/adjustments/route.ts` (tenant-scoped product increment), `src/app/api/stock/purchase/receptions/route.ts` (PO/item/product/lot ownership + status/idempotency guards, tenant-scoped increment), `src/app/api/stock/reservations/[id]/route.ts` (ACTIVE-only actions, tenant-scoped reservation/product updates), `src/app/api/stock/transfers/[id]/route.ts` (state guards, tenant-scoped product/item updates, idempotency context). Tests: adjustments **3/3 PASS**, transfers/[id] **2/2 PASS**.
- **Still not proven:** RLS policy coverage for id-only mutations, nested-tx/GUC semantics in `ad-unlock-service.ts`, team-invite DB/RLS boundary, OAuth/adapter production behavior, 5437 read-only validation.
- **Status remains NO-GO** for end-to-end isolation proof. Do not advance to Phase 1K or production without authorized runtime/policy evidence.
