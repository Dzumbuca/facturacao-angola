# RLS — Inventário de privilégios administrativos e operações globais (ETAPA 4)

**Regra:** autorização administrativa **somente** de fonte confiável do servidor (sessão/DB). Nunca confiar em `is_admin`, `tenantId` ou permissões vindas do cliente.

## Endpoints/operações identificados
| Endpoint/Ação | Permissão | Origem autorização | Tabelas | Acesso cruzado? | Auditoria | Compat. RLS |
|---|---|---|---|---:|---:|---|
| `api/plan/payment/proof/[id]` GET | ADMIN/SUPERADMIN plataforma | `auth()` + `prisma.user.findUnique(session.user.id).platformRole` (servidor) | User, PlanPayment | Não (apenas prova global de planos) | **Parcial**: sem log explícito de leitura de comprovativo | **RISCO**: Prisma global; sob RLS requer política/executor admin |
| `api/cron/reminders` GET | Segredo infra | Header `Authorization: Bearer $CRON_SECRET` | Invoice, Customer, Tenant (+ email) | **Sim (intencional, global)** | Parcial (resultado JSON; `sendAndRecordEmail`) | **RISCO ALTO**: varre tenants; atualiza `Invoice.shareToken/lastReminderAt`; requer executor privilegiado/admin controlado, não tenant payload |
| `lib/admin-actions.ts` (server actions: setTenantStatus/Plan/UserStatus/TenantRole/PlatformRole, config, etc.) | Permissões plataforma (`requirePlatformPermission`) | `lib/admin-auth` + DB user/role (servidor) | Tenant, User, AdminAuditLog, PlatformConfig, etc. | **Sim (controlado)** | **Sim** em várias ações (`AdminAuditLog`, reason, Serializable) | **RISCO**: Prisma/tx global sem `runWithTenant`; RLS exige `app.is_admin`/políticas admin ou role separada |
| `lib/admin-auth*` / guards | N/A | sessão + DB | User/Tenant | Controla escopo | N/A | Base de confiança; validar sob RLS |
| Admin UI `src/app/admin/*` | conforme guards/actions | servidor | várias | conforme ação | conforme ação | depende de actions/data layer |
| `api/auth/*`, `session/refresh`, `onboarding/company` | identidade/bootstrap | sessão/cookies/tokens | User/Account/Session/VerificationToken/tokens | N/A | parcial | **Não alterar** (ETAPA 2/5) |

## Riscos de escalada
- Qualquer endpoint que aceite `tenantId`/`role`/`is_admin` do body/query para decisão de acesso: **proibido**. Rotas corrigidas usam tenant de sessão.
- `cron/reminders` opera cross-tenant por segredo: se segredo vazar, impacto global; sob RLS precisará de caminho admin explícito (ex.: `runWithTenant` não aplicável; usar executor/role admin + auditoria).
- `plan/payment/proof/[id]` expõe binário sensível; adicionar auditoria de acesso recomendada.

## Recomendação (sem aplicar em produção)
1. Introduzir executor admin explícito (`runAsAdmin`/role de serviço) com `app.is_admin='true'` e políticas que só permitam escopo necessário.
2. Auditar todas leituras sensíveis admin (comprovativos, dados PII cross-tenant).
3. Revisar `admin-actions` para usar executor admin consistente sob RLS + manter `AdminAuditLog`.
4. Testes de privilégio: utilizador tenant não-admin => 403 em admin/cron paths; admin => apenas ações permitidas.
