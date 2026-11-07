# JWT_REVOCATION_PHASE_1_REPORT

**Date:** 2026-11-05
**Project:** `C:\Users\Administrador\Desktop\facturacao-angola`
**Branch:** `wms-v2-e2e-staging`
**Phase status:** **BLOCKED** (persistence artifacts prepared; staging application NOT performed due to migration-history divergence safety gate).

## 1. Estado inicial do Git
- Branch: `wms-v2-e2e-staging`
- Log (3): `95e0036`, `a23b2aa`, `4feef64`
- `git status --short`: worktree preexistente pesado preservado integralmente (inclui modificações WMS/stock/auth/RLS/`prisma/schema.prisma`/`src/lib/auth.ts`/`src/lib/auth-prisma-adapter.ts` e muitos untracked). Sem reset/checkout/clean/discard.
- `.env` / `.env.local`: presentes, não modificados.

## 2. Arquitectura implementada (parcial, segura)
Fase 1 limitada a persistência **preparada**, sem integração:
- Modelo Prisma aditivo `AuthJwtRevocation` adicionado ao `prisma/schema.prisma` (worktree, preservando conteúdo existente).
- Relações inversas aditivas no `User`: `jwtRevocations` / `jwtRevocationsActed`.
- Migration aditiva criada: `prisma/migrations/20261105233000_auth_jwt_revocation_phase1/migration.sql`.
- SQL inclui CREATE TABLE, UNIQUE/índices/FKs, `ENABLE/FORCE ROW LEVEL SECURITY`, policies explícitas, `REVOKE ALL FROM PUBLIC`, grants mínimos.
- **Não aplicada** em 5437 por bloqueio de segurança do histórico de migrations.

**Não alterado nesta fase (confirmado):** `src/lib/session-refresh-security.ts`, `src/app/api/session/refresh/route.ts`, logout/JWT/session callbacks/middleware/API routes/Server Actions, `runAsSystem`/`runAsAdmin`/`runWithTenant`/`runAsAuth`, `sessionVersion`, `.env*`. `src/lib/auth.ts` e `src/lib/auth-prisma-adapter.ts` já estavam modificados/untracked no worktree preexistente e **não foram tocados** nesta fase. Sem integração JTI/NextAuth, sem cache, sem Redis, sem OAuth.

## 3. Modelo de dados
`AuthJwtRevocation` (aditivo):

| Campo | Obrig. | Justificação |
|---|---:|---|
| `id` UUID PK | sim | Identidade da linha. |
| `jtiHash` TEXT UNIQUE | sim | Lookup rápido; evita armazenar `jti` bruto/JWT completo. |
| `userId` FK→User CASCADE | sim | Owner binding, isolamento, revogação global futura, cleanup. |
| `tenantIdAtIssue` TEXT? | não | **Metadado contextual apenas, nunca autorização.** |
| `reason` TEXT | sim | Auditoria (logout/logout_all/password_change/suspended/security/admin). |
| `revokedAt` TIMESTAMP default now | sim | Momento de revogação. |
| `expiresAt` TIMESTAMP | sim | Alinhado à expiração do JWT; cleanup eficiente. |
| `issuedAt` TIMESTAMP? | não | Opcional debug/análise. |
| `actorUserId` FK→User SET NULL? | não | Actor admin/sistema quando aplicável. |
| `metadata` JSONB? | não | Extensão controlada, sem segredos/tokens. |
| `createdAt` TIMESTAMP default now | sim | Auditoria de inserção. |

Índices: `@@index([userId,revokedAt])`, `@@index([expiresAt])`, `@@index([userId,expiresAt])`.

## 4. Migration criada
- Path: `prisma/migrations/20261105233000_auth_jwt_revocation_phase1/migration.sql`
- **Aditiva apenas**. Verificação: sem `DROP`, `TRUNCATE`, `ALTER...DROP`, `DELETE FROM`, `RESET`.
- **Não aplicada**; nenhuma escrita em `_prisma_migrations` (tabela ausente em 5437).

## 5. SQL preparado (resumo)
- Tabela `AuthJwtRevocation` + PK/FKs/UNIQUE/índices.
- RLS: `ENABLE` + `FORCE ROW LEVEL SECURITY`.
- Policies: `ajr_admin_all` (ALL, `app.is_admin='true'`), `ajr_self_select` (SELECT, `userId=NULLIF(app.user_id,'')`), `ajr_self_insert` (INSERT, mesmo binding). Sem self UPDATE/DELETE (append-only; cleanup futuro via admin executor autorizado).
- `REVOKE ALL ON TABLE ... FROM PUBLIC`.
- `GRANT SELECT,INSERT` a `mf_app_nobypass`, `mf_admin_executor`; `GRANT SELECT,INSERT,DELETE` a `mf_migration` (manutenção staging autorizada).

## 6. Políticas RLS / roles e privilégios
Roles 5437 observadas (todas NOBYPASSRLS excepto postgres local admin): `mf_app_login`, `mf_app_nobypass`, `mf_admin_executor`, `mf_auth_executor`, `mf_admin_login`, `mf_auth_login`, `mf_migration`. Sem BYPASSRLS para runtime app. **Eficácia real NOT PROVEN** até aplicação e testes.

## 7. Inspecção 5437 (autorizada)
- Alvo: `127.0.0.1:5437/mf_rls_staging` (postgres local para diagnóstico).
- `public._prisma_migrations`: **ausente (NULL)**.
- `AuthJwtRevocation`: **ausente** (confirmado antes e depois; tabela não aplicada).
- `User` tem `id`, `sessionVersion`, `status`, `tenantId`.

## 8. Testes executados
| Teste | Resultado |
|---|---|
| Git/branch/preservação worktree | PASS |
| Inspecção schema/migrations/roles 5437 | PASS (diagnóstico) |
| `npx prisma validate --schema prisma/schema.prisma` | PASS (warnings SetNull preexistentes noutras relações) |
| `npx tsc --noEmit -p tsconfig.json` | PASS |
| Migration SQL safety scan (sem destrutivos) | PASS |
| Aplicar migration em 5437 | **NOT EXECUTED / BLOCKED** |
| Tabela/colunas/índices/constraints/ENABLE+FORCE RLS | **NOT EXECUTED** |
| Policies efectivas / grants efectivos | **NOT EXECUTED** |
| Isolamento A/B (user/tenant cross-read/write, self-only, sem tenant indevido) | **NOT EXECUTED** |
| Integridade (`jtiHash` duplicado, idempotência futura, expiração, binding utilizador) | **NOT EXECUTED** |
| Regressão testes RLS/isolation existentes | **NOT EXECUTED** |

## 9. Bloqueio (paragem obrigatória)
Com `DATABASE_URL` forçado para `127.0.0.1:5437/mf_rls_staging`, `npx prisma migrate status` reportou **24 migrations found / all not yet applied** (baseline→cadeia completa), mas a DB **não tem `_prisma_migrations`** e já contém estado staging. `prisma/schema.prisma` tem diff grande preexistente no worktree. Aplicar/deploy/resolve sem reconciliação aprovada pode ser destrutivo/inconsistente. **Parado sem contornar.**

## 10. Limitações / riscos residuais
- Tabela não existe em 5437; RLS/policies/grants/isolation/integridade **NOT PROVEN**.
- Gap stale-JWT permanece **sem mitigação**.
- `ajr_self_insert` depende de serviço central futuro garantir owner binding do `jtiHash` e `app.user_id` confiável.
- `mf_migration` com DELETE: apenas manutenção autorizada.
- `tenantIdAtIssue` sem FK intencional (metadado); pode ser endurecido depois.

## 11. Ficheiros modificados/criados
**Modificado (aditivo):** `prisma/schema.prisma` — `AuthJwtRevocation` + relações `User.jwtRevocations/jwtRevocationsActed` (ficheiro já estava modificado no worktree antes da fase).

**Criados:** `prisma/migrations/20261105233000_auth_jwt_revocation_phase1/migration.sql`, `JWT_REVOCATION_PHASE_1_REPORT.md`, helpers locais `tmp/patch-prisma-jwt-phase1.cjs`, `tmp/inspect-jwt-phase1*.cjs`, `tmp/check-no-apply.cjs`, `tmp/inspect-tenant-cols.cjs`.

**Não modificados:** `.env`, `.env.local`, migrations antigas, código auth/logout/refresh/routes/server actions/executores, `sessionVersion`. Sem SQL aplicado, sem grants/roles alterados em DB.

## 12. Confirmação final
- Apenas inspeção/local staging `127.0.0.1:5437/mf_rls_staging`. **Sem 5436/Supabase/produção.**
- Sem DROP/TRUNCATE/RESET/migrate reset. Sem BYPASSRLS.
- Sem commits/push/merge/deploy.

## 13. Próximos passos (nova autorização)
1. Aprovar plano de **reconciliação do histórico Prisma em 5437** (ou caminho controlado equivalente para SQL aditivo com registo).
2. Aplicar migration de forma segura; verificar estrutura + RLS + policies + grants com role `mf_app_login`/contexts.
3. Executar testes RLS/integridade A/B com fixtures sintéticas e `app.user_id`/`app.is_admin`.
4. Reexecutar regressões RLS/isolation.
5. Só depois: **fase 2** serviço central `mint/check/revoke` + integração controlada NextAuth.

**Conclusão:** Fase 1 **BLOCKED**. Artefactos aditivos preparados e validados estaticamente. **Sistema NÃO pronto para produção.**
