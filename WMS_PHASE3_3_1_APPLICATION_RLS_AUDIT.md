# WMS Phase 3.3.1 — Application RLS Audit

**Projeto:** facturacao-angola (Machine Facturas)
**Data:** 2026-11-04
**Tipo:** Auditoria de código (apenas leitura)

## 1. Ficheiros inspecionados

- `src/lib/tenant-db.ts` (runWithTenant)
- `src/lib/prisma.ts` (PrismaClient singleton)
- `src/lib/invoice-service.ts` (referência a RLS context)
- `src/app/api/stock/*` (routes using runWithTenant)
- Grep: `set_config`, `app.tenant_id`, `app.user_id`, `app.is_admin` → apenas `runWithTenant` define `app.tenant_id`.

## 2. Utilizador PostgreSQL efetivo

- `.env` (produção) → Supabase pooler user `postgres.dodoplzkmazdlrwqdmpp` (porta 6543, pgbouncer).
- Staging → `staging_admin` (sem BYPASSRLS).
- A aplicação usa um único PrismaClient global (singleton).

## 3. Cobertura de definição das variáveis RLS

| Variável | Definida por | Onde | Risco |
|----------|--------------|------|-------|
| `app.tenant_id` | `runWithTenant` | Dentro da transação Prisma (`set_config(..., true)` local) | OK — fail-closed se não definida |
| `app.user_id` | **Nunca definida** | — | Políticas dependentes falham (fail-closed) |
| `app.is_admin` | **Nunca definida** | — | Políticas admin bloqueiam tudo |

## 4. Operações que podem contornar o contexto

- Queries fora de `runWithTenant` usando o Prisma global (`prisma.xxx`) não têm `app.tenant_id` definido → RLS nega (fail-closed). Seguro, mas pode quebrar funcionalidade se existirem.
- `runWithTenant` não define `app.user_id` nem `app.is_admin` → tabelas EmailActionToken, EmailCampaign, EmailCampaignRecipient, PlatformTeamInvite ficam inacessíveis pela app.
- Transações aninhadas: `runWithTenant` não é aninhável (Prisma não suporta nested transactions facilmente); risco de perda de contexto se chamado dentro de outro runWithTenant.

## 5. Resultados dos testes

- Nenhum teste executado (auditoria de código).
- Análise estática confirma: apenas `app.tenant_id` é definido; `app.user_id` e `app.is_admin` nunca são definidos.

## 6. Correções necessárias antes de aplicar Script D

1. Estender `runWithTenant` para aceitar `userId` e `isAdmin` e definir `app.user_id` e `app.is_admin` dentro da transação.
2. Ou alterar as políticas de EmailActionToken/EmailCampaign/PlatformTeamInvite para usar `service_role` bypass (e garantir que a app usa service_role para essas operações).
3. Verificar se `postgres` (Supabase) tem BYPASSRLS — se sim, RLS em produção pode ser bypassado pelo app user; confirmar role efetivo.
4. Garantir que todas as queries protegidas passam por `runWithTenant`.

## 7. Veredito

**NÃO APROVADO PARA APLICAÇÃO DO SCRIPT D** — bloqueios:
- `app.user_id` e `app.is_admin` nunca definidos pela aplicação → políticas de email/admin bloqueariam todos os acessos legítimos.
- Necessário corrigir `runWithTenant` ou ajustar políticas antes de aplicar.

Aguardando autorização para corrigir `runWithTenant` e re-validar.