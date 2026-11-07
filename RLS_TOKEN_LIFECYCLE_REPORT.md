# RLS_TOKEN_LIFECYCLE_REPORT

**Date:** 2026-11-05  
**Branch:** `wms-v2-e2e-staging` (reference `95e0036` + local working-tree changes)  
**Authorized DB/runtime:** `127.0.0.1:5437/mf_rls_staging` only, NOBYPASSRLS contexts. No 5436/Supabase/production. No commits/push/merge/deploy. `.env`/`.env.local` unchanged.

## 1. Auditoria do ciclo de tokens

### Modelos / armazenamento
- `EmailActionToken` (`prisma/schema.prisma`): `id`, `userId`, `purpose` (`EmailActionPurpose`: `VERIFY_EMAIL`, `PASSWORD_RESET`), `tokenHash @unique`, `expiresAt`, `consumedAt?`, `createdAt`, relação `User` (`onDelete: Cascade`). **Não existe campo `revoked`**.
- `VerificationToken` existe no schema (modelo adapter NextAuth) mas **não é o mecanismo usado** pelos fluxos auditados de verify/reset (`email-actions.ts` usa `EmailActionToken`).
- Tokens não são armazenados em texto simples: emissão gera `randomBytes(32).toString('base64url')`; BD guarda `hashEmailToken = sha256(token)`. O valor bruto só é usado para construir URL de email.

### Emissão (`src/lib/email-actions.ts` `sendEmailActionToken`)
- Quem emite: caminhos server-controlled (register, resend-verification, forgot-password usam lookup server-controlled; change-unverified-email emite após validação). Execução em `runAsSystem`.
- Associação: `userId`, `purpose`, `tokenHash`, `expiresAt` (`VERIFY_EMAIL` 24h, `PASSWORD_RESET` 1h).
- Invalidação de anteriores: `updateMany` marca `consumedAt=now` para tokens não consumidos do mesmo `userId+purpose` antes de criar novo.
- Exposição: o token bruto vai para URL de email; respostas HTTP das rotas de pedido são genéricas (não revelam existência de conta).

### Consulta/consumo
- `verifyEmailToken` / `resetPasswordWithToken`: validam formato (`^[A-Za-z0-9_-]{40,60}$`), calculam hash, executam em `runAsSystem` (5437 prototype: tabelas adapter/EmailActionToken tratadas por contexto server-controlled; AdminAuditLog admin-only).
- **Não dependem de userId do cliente**: consumo é por hash + finalidade + validade/não consumo.
- Efeitos: `VERIFY_EMAIL` consome token, define `emailVerified`, `emailVerificationRequired=false`, incrementa `sessionVersion`, cria `AdminAuditLog EMAIL_VERIFIED`. `PASSWORD_RESET` consome token, actualiza password hash, incrementa `sessionVersion`, cria `AdminAuditLog PASSWORD_RESET`. Notificações pós-sucesso são best-effort e não revertem a operação.

### Rotas auditadas
- `POST /api/auth/verify-email` → `verifyEmailToken`; retorna 200/400 controlado; catch genérico 500 (não expõe detalhe).
- `POST /api/auth/reset-password` → `resetPasswordWithToken`; valida password length (400), token inválido/expirado/consumido → 400, catch genérico 500.
- `POST /api/auth/resend-verification`, `POST /api/auth/forgot-password`: rate limit + `allowEmailRequest` + lookup server-controlled; respostas genéricas.
- `POST /api/auth/register`: bootstrap server-controlled; resposta genérica para conta existente/P2002.
- `POST /api/auth/change-unverified-email`: valida password e estado não verificado, actualiza email condicionalmente, invalida sessões (`sessionVersion`), subscrição marketing actualizada; resposta genérica.

## 2. Causa de falhas / correcções aplicadas (working tree, sem commit)
1. **500 em verify/reset (HTTP 5437, anterior):** `email-actions.ts` usava `tx.$transaction(async (inner)=>...)` dentro de callbacks `runAsSystem`. O cliente Prisma passado por `runAsSystem` já é transaction client → `tx.$transaction is not a function`. **Corrigido** removendo nested tx; consumo/efeitos em transacção única `runAsSystem`.
2. **Risco estrutural idêntico (não observado como 500 neste run, mas mesmo padrão):** `register/route.ts` e `change-unverified-email/route.ts` tinham nested `tx.$transaction` dentro de `runAsSystem`. **Corrigido** para transacção única.
3. **Atomicidade de consumo (endurecimento):** `verifyEmailToken`/`resetPasswordWithToken` passaram a `SELECT id,"userId" ... FOR UPDATE` + `updateMany` condicional por `id/userId/purpose/consumedAt null/expiresAt>now` dentro da mesma transacção, antes de mutações no utilizador/audit. Isto reduz janela read/check sob concorrência. `Serializable` não foi reintroduzido separadamente (decisão compatível com arquitectura actual; necessidade não demonstrada após endurecimento + testes de concorrência PASS).

## 3. Prova de consumo único / atomicidade
- **VERIFY-CONCURRENCY-SAME-TOKEN (HTTP 3034, 5437):** duas chamadas simultâneas ao mesmo token `VERIFY_EMAIL` → `statuses [200,400]`, `successCount 1`, `failureCount 1`, `dbConsumed true`, `sessionVersion 1`, `emailVerified true`. **PASS**.
- **RESET-CONCURRENCY-SAME-TOKEN:** duas chamadas simultâneas ao mesmo token `PASSWORD_RESET` → `statuses [400,200]`, `successCount 1`, `failureCount 1`, `dbConsumed true`, `sessionVersion 1`. **PASS**.
- Reutilização após consumo: verify e reset retornam 400; estado final inalterado na reutilização de reset (password/sessionVersion iguais ao primeiro reset). **PASS**.

## 4. Isolamento / associação utilizador-tenant
- Token hash lookup não usa IDs do cliente. O endpoint público age sobre o **proprietário do token** (`userId` da row). Testes cross-user provaram que token de B consumido aplica efeitos apenas a B; A permanece inalterado (`VERIFY-HTTP-CROSS-USER-BOUNDARY`, `RESET-HTTP-CROSS-USER-BOUNDARY` — **PASS**, com mutação documentada de fixture sintética B e restauração de password).
- Purpose mismatch rejeitado e token não consumido (`VERIFY-HTTP-WRONG-PURPOSE`, `RESET-HTTP-WRONG-PURPOSE` — **PASS**).
- Isolamento RLS A/B geral e contextos NOBYPASSRLS continuam validados por suites 19/19, 60/60, 5/5 em 5437 (reexecutadas).

## 5. Testes HTTP executados (5437, Next 3034 launcher-enforced)
Artefacto: `tmp/rls-e2e-artifacts/token-lifecycle-concurrency.json` — **18 PASS / 0 FAIL / 0 NOT EXECUTED / 1 NOT APPLICABLE**.

| Caso | Resultado |
|---|---|
| Verify/Reset nonexistent + invalid format | PASS (400 controlado) |
| Verify/Reset expired | PASS (400, `dbConsumed false`) |
| Verify/Reset consumed | PASS (400) |
| Verify/Reset wrong purpose | PASS (400, token não consumido) |
| Cross-user boundary (token owner B) | PASS (efeitos só no owner; A inalterado) |
| Verify valid consume (temp synthetic user) | PASS (200, consumed, verified, sessionVersion+1) |
| Verify reuse after consume | PASS (400) |
| Reset valid consume (temp synthetic user) | PASS (200, consumed, password changed, sessionVersion+1) |
| Reset reuse after consume | PASS (400, sem nova alteração) |
| Verify concurrency same token | PASS |
| Reset concurrency same token | PASS |
| Revoked state | NOT APPLICABLE (schema sem `revoked`; usa `consumedAt`/`expiresAt`) |

## 6. Limpeza / estado final de fixtures
- Criados e removidos pelo teste (5437): 12 `EmailActionToken` rows, 4 utilizadores sintéticos temporários (`rls-e2e-token-*`), audit/delivery relacionados.
- `rls-e2e-notenant@example.test`: restaurada (`tenantId NULL`, `tenantRole USER`).
- **B (`rls-e2e-b@example.test`) mutada pelo teste de fronteira de reset:** password restaurada para hash da password sintética de fixture; `emailVerified`/`emailVerificationRequired`/`sessionVersion` podem diferir do estado anterior ao teste (ficou verificado; `sessionVersion` observado em 3). A/B/admin/unverified continuam funcionais para fins de teste conhecidos.
- Sem tokens de teste activos remanescentes (`tempTokens 0`, `tempUsers 0`). Sem processos Next de teste activos.

## 7. Não executado / não provado
- Expiração/reutilização com cenários de **change-unverified-email** (rota usa outro fluxo; não criada fixture/token específico).
- `VerificationToken` (adapter NextAuth) lifecycle.
- Emissão HTTP end-to-end com intercepção de mailbox/token bruto (SMTP/local env); fluxo de emissão observado por código, não por captura de email real.
- Verificação pós-reset de invalidação de sessões em todos os clientes (regra parcial: `sessionVersion` incrementada — **AT RISK/PARTIAL** sem matriz de sessão completa).
- OAuth/PrismaAdapter completo, PgBouncer/transaction pooling, Supabase/produção, admin/financeiro/WMS HTTP completo, drift de schema/migração produção.

## 8. Estado real
**PARCIAL, staging 5437 apenas.** Os fluxos `VERIFY_EMAIL`/`PASSWORD_RESET` auditados mostram: token hash seguro, finalidade/expiração/consumo verificados, **consumo único comprovado sob concorrência HTTP real** no runtime isolado 5437, e associação correcta ao utilizador proprietário do token nos cenários executados. **Não declara sistema pronto para produção.**
