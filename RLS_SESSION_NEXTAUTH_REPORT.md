# RLS_SESSION_NEXTAUTH_REPORT

**Date:** 2026-11-05  
**Branch:** `wms-v2-e2e-staging` (ref `95e0036` + local working tree; **no commit/push/merge/deploy**)  
**Authorized DB/runtime:** `127.0.0.1:5437/mf_rls_staging` only, `mf_app_login` NOBYPASSRLS (`rolsuper=false`, `rolbypassrls=false`). No 5436/Supabase/production. No RLS disablement/BYPASSRLS/reset/destructive ops. `.env`/`.env.local` unchanged.

## 1. Arquitectura real de sessões e NextAuth

| Aspeto | Estado real (código + runtime observado) |
|---|---|
| Biblioteca/config | NextAuth/Auth.js v5 beta (`next-auth ^5.0.0-beta.32`), config em `src/lib/auth.ts`. `trustHost: true`. `pages.signIn='/login'`. |
| Estratégia de sessão | **JWT** (`session.strategy='jwt'`). Tabela `Session` do adapter **não é usada** para sessões da aplicação neste modo (contagem 5437 observada: `Session=0, Account=0, VerificationToken=0`). |
| Adapter | `createRlsPrismaAdapter(prisma)` (`src/lib/auth-prisma-adapter.ts`) envolve `@auth/prisma-adapter ^2.11.3`. Métodos de User usam contextos RLS estreitos/system/user conforme caso; Account/Session/VerificationToken usam `runAsSystem` (server-controlled). |
| Providers | **Credentials** sempre activo (email normalizado lowercase+trim; lookup user por email em `runWithRlsContext(... isAdmin:true, tenantId:null)`; verifica password bcrypt, `status ACTIVE`, e bloqueia `emailVerificationRequired && !emailVerified`). **Google** só se `GOOGLE_CLIENT_ID/SECRET` presentes; `allowDangerousEmailAccountLinking: true`. |
| Emissão JWT | Callback `jwt`: no sign-in copia `tenantId` e `sessionVersion` para o token. |
| Validação de sessão | Callback `session`: relê `User` por `token.sub` em `runWithRlsContext({userId:token.sub, tenantId:null, isAdmin:false})` (self policy). Considera inválida se status != ACTIVE, `sessionVersion` diferente, ou `emailVerificationRequired && !emailVerified`. Se inválida, devolve `session.user.id=''`, `tenantId=null`; senão preenche id e `tenantId` (DB tem prioridade sobre JWT). |
| Refresh | `POST /api/session/refresh` decodifica JWT com `AUTH_SECRET/NEXTAUTH_SECRET` e `salt` igual ao nome do cookie (`authjs.session-token`/`__Secure-...`), lê user em contexto self RLS, valida com `canRefreshAuthSession` (`session-refresh-security.ts`: versão segura, ACTIVE, versão igual, verificação email ok), reemite JWT com `tenantId/sessionVersion` actuais e reescreve cookie. |
| Guards/páginas | `authorized` callback: login/register autenticado → `/`; admin paths exigem auth; páginas protegidas exigem auth; `/` sem auth → `/inicio`; autenticado sem `tenantId` → `/onboarding`. Rotas API usam `auth()`/helpers e `runWithTenant`/RLS conforme rota. |
| Tabelas adapter 5437 (prototype) | `Account/Session/VerificationToken/EmailActionToken`: **RLS OFF**. `User`: **RLS ON**, 1 policy `rls_user_self_tenant_admin` (ALL). |

## 2. Mecanismo de invalidação de sessões

- **Chave:** `User.sessionVersion` (inteiro). Incrementado em `verifyEmailToken`, `resetPasswordWithToken` (`email-actions.ts`), `change-unverified-email`, e noutros fluxos conforme código existente.
- **Efeito em JWT strategy:** não há revogação server-side do JWT emitido; a invalidação efectiva ocorre quando o runtime **valida** o token contra a BD: `session` callback, rotas que chamam `auth()`, e `/api/session/refresh` verificam `sessionVersion`/estado actual. Resultado observado: `GET /api/auth/session` devolve utilizador sem id válido (`id:""`, `tenantId:null`) para JWT antigo após reset; APIs protegidas retornam `401` “Não autenticado”; refresh retorna `401`.
- **Limite (AT RISK):** bytes do cookie JWT podem permanecer no cliente; sem blacklist central, qualquer rota que **não** valide via `auth()`/callback/DB seria vulnerável. O logout (`signout`) substitui/limpa cookie conforme NextAuth, mas o comportamento observado com reutilização do cookie antigo não foi prova forte de revogação server-side (ver testes).

## 3. Resultados após reset de password

Evidência: `tmp/rls-e2e-artifacts/session-invalidation-nextauth.json` (5437, Next 3035). Utilizador sintético B, duas sessões prévias (S1/S2) com acesso `GET /api/produtos` 200.

| Cenário | Resultado |
|---|---|
| Consumo token `PASSWORD_RESET` válido (HTTP) | **PASS** — 200; `sessionVersion` 4→5. |
| `GET /api/auth/session` com S1/S2 antigas | **PASS** — `hasUser=false` (`id:""`, `tenantId:null`). |
| APIs protegidas com S1/S2 (`/api/produtos`) | **PASS** — `401` “Não autenticado”. |
| `POST /api/session/refresh` com S1/S2 | **PASS** — `401`. |
| Login com password antiga | **PASS** — rejeitado (sem utilizador autenticado). |
| Login com password nova | **PASS** — aceite. |
| Concorrência do token reset | **PASS** (fase anterior) — consumo único.

**Conclusão:** para o mecanismo actual (JWT + validação `sessionVersion` em callback/refresh/rotas `auth()`), **sessões antigas deixam de autorizar as operações protegidas testadas após reset**. Password antiga rejeitada; nova aceite.

## 4. Resultados após verificação de email

| Cenário | Resultado |
|---|---|
| Login utilizador não verificado (`emailVerificationRequired && !emailVerified`) | **PASS** — bloqueado por `authorize` (Credentials). |
| Sessão pré-verificação autenticada via login normal | **NOT APPLICABLE** — arquitectura actual impede estabelecer essa sessão; callback `session` também invalida se verificação requerida e ausente. |
| Consumo token `VERIFY_EMAIL` válido (utilizador sintético temporário, HTTP público) | **PASS** — 200; `sessionVersion` 0→1; `emailVerified` definido; `emailVerificationRequired=false`. |
| Login pós-verificação | **PASS**. |
| Concorrência token verify | **PASS** (fase anterior). |

**Conclusão:** verificação de email e `sessionVersion` actuam correctamente nos fluxos executados. Não se provou invalidação de uma sessão autenticada pré-existente *criada antes da verificação* porque o fluxo Credentials actual não a permite; permanece uma distinção arquitectural a considerar se outros meios de sessão existirem.

## 5. Resultados de logout e refresh

| Cenário | Resultado | Nota |
|---|---|---|
| Login A + acesso protegido + refresh autenticado | **PASS** | `/api/produtos` 200; `/api/stock/warehouses` 200; refresh 200. |
| `POST /api/auth/signout` (com CSRF) | **AT RISK** | Resposta 302; `GET /api/auth/session` após signout, usando cookie antigo no teste, ainda apresentou utilizador (`hasUser=true`). Requer interpretação cautelosa (substituição de cookie vs jar do teste). |
| Reutilização cookie antigo após logout em `/api/produtos` | **AT RISK** | Observado 200 no teste; consistente com JWT stateless sem revogação server-side se o cookie antigo permanecer válido e assinado. **Risco de segurança dependente de remoção efectiva do cookie no cliente e ausência de revogação server-side.** |
| Refresh após logout com cookie antigo | **AT RISK** | Observado 200 no teste. |
| Cookie inválido/adulterado | **PASS** | sessão sem utilizador válido; `/api/produtos` 401. |
| Acesso não autenticado a rota protegida | **PASS** — 401. |
| Refresh com sessão `sessionVersion` desfasada (após reset) | **PASS** — 401. |
| Cookie expirado | **NOT PROVEN** | Não simulado por manipulação de expiração assinada neste run. |
| Sessão de utilizador desactivado | **NOT EXECUTED** | Não mutada fixture/status neste run. |

## 6. Auditoria PrismaAdapter

| Método/área | Tabelas | Contexto wrapper | Risco/estado |
|---|---|---|---|
| `createUser/getUserByEmail/getUserByAccount` | `User` | `runAsSystem` (bootstrap/server-controlled) | Necessário para fluxos sem contexto de utilizador; estreitar quando possível. **AT RISK** se chamado fora de fronteira controlada. |
| `getUser/updateUser/deleteUser` | `User` | `withUser` quando id conhecido | Compatível com self policy; depende de `app.user_id`. |
| `linkAccount/unlinkAccount/getAccount` | `Account` | system/user conforme método | **AT RISK** — `Account` RLS OFF (5437). |
| `getSessionAndUser/createSession/updateSession/deleteSession` | `Session` | system/user | **NOT APPLICABLE** à app actual (JWT), mas métodos existem. **AT RISK** se database sessions activadas sem RLS/policies. |
| `createVerificationToken/useVerificationToken` | `VerificationToken` | system | **AT RISK** — RLS OFF; consumo single-use é responsabilidade do adapter/NextAuth. **NOT PROVEN** HTTP real. |
| WebAuthn authenticators | tabelas relacionadas (se usadas) | system/user | **NOT APPLICABLE** (não usado actualmente). |

**Achado:** wrapper existe e evita depender de BYPASSRLS, mas usa `runAsSystem` em operações de bootstrap/adapter. Segurança operacional depende de essas chamadas serem exclusivamente server-controlled pelo NextAuth.

## 7. Estado de Account, Session e VerificationToken

| Tabela | RLS 5437 | Policies | Contagem observada | Uso actual | Estado |
|---|---|---|---|---|---|
| `Account` | OFF | 0 | 0 | OAuth linking/account persistence (se Google usado) | **NOT PROVEN / AT RISK** |
| `Session` | OFF | 0 | 0 | Inactivo com `strategy:'jwt'` | **NOT APPLICABLE (actual) / AT RISK (se activado)** |
| `VerificationToken` | OFF | 0 | 0 | Fluxos NextAuth adapter (email/magic/OAuth internos) — distinto de `EmailActionToken` app | **NOT PROVEN / AT RISK** |
| `EmailActionToken` | OFF (prototype) | 0 | variava; temporários limpos | App verify/reset | **PARCIALMENTE PROVADO** em 5437 (fase anterior + endurecimento) |

## 8. Estado OAuth

- **Configuração:** Google provider condicional; `allowDangerousEmailAccountLinking: true` (risco de linking por email — aceitável apenas se política de confiança de email/provedor for explícita). Callbacks padrão NextAuth; sem credenciais reais no ambiente de teste.
- **Execução:** **NOT EXECUTED**. Sem autenticação em serviços externos, sem tokens/callbacks reais.
- **Riscos:** account linking indevido, associação a utilizador errado, persistência `Account` sob RLS OFF/prototype, comportamento com email não verificado, erros de callback, dependência de `getUserByEmail` system context.

## 9. Provas de isolamento entre tenants

| Cenário | Resultado |
|---|---|
| Sessão A lê `/api/customers`/produtos/warehouses próprios; B lê próprios | **PASS** (runs anteriores + regressão A/B warehouses/clientes neste run). |
| Sem IDs cruzados visíveis (amostra) | **PASS** — A não viu B, B não viu A. |
| Payload com `tenantId` manipulado (criar customer como A com `tenantId` de B) | **PASS** — resposta 200 mas registo criado sob **tenant A** (`createdTenantId=A`), limpo depois. Rota ignorou tenant do payload. |
| Sessão A/B concorrente | **PARCIAL** — requisições sequenciais/isoladas em testes; matrix concorrente exaustiva não executada. |
| Sem tenant / utilizador desactivado / admin | **PARCIAL / NOT EXECUTED** — alguns casos em runs anteriores; admin matriz completa não executada. |

## 10. Testes de regressão

| Teste | Resultado |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | **PASS** |
| `scripts/rls-staging-two-tenant-test.cjs` (5437) | **19/19 PASS** |
| `scripts/rls-priority-tables-test.cjs` (5437) | **60/60 PASS** |
| `scripts/rls-executor-integration-test.cjs` (5437) | **5/5 PASS** |
| `vitest run src/lib/admin-auth.test.ts` | **11/11 PASS** |
| HTTP sessão/NextAuth (5437, 3035) | **21 PASS / 0 FAIL / 0 NOT EXECUTED / 2 NOT PROVEN / 3 AT RISK / 1 NOT APPLICABLE** |
| HTTP token lifecycle/concurrency (5437, 3034, fase anterior) | **18 PASS / 0 FAIL / 1 NOT APPLICABLE** |
| HTTP auth flows subset (5437, 3033, anterior) | **18 PASS / 0 FAIL / 9 NOT EXECUTED** (artefacto existente) |

## 11. Correcções efectuadas (nesta fase)

- **Nenhuma correcção de código** aplicada na fase de sessão/NextAuth. O mecanismo `sessionVersion` + validação em `session` callback/refresh/protected APIs **comportou-se conforme esperado** nos cenários de reset executados.
- Correcções prévias preservadas no worktree (não commitadas): endurecimento token verify/reset (`FOR UPDATE` + consume condicional), remoção de nested `tx.$transaction` em `email-actions.ts`, `register`, `change-unverified-email`, onboarding bootstrap.

## 12. Ficheiros modificados

- **Código:** nenhum novo nesta fase. Worktree mantém alterações pré-existentes e fases anteriores (`src/lib/email-actions.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/auth/change-unverified-email/route.ts`, `src/app/api/onboarding/company/route.ts`, relatórios RLS, e muitas alterações WMS/financeiro/stock/docs não relacionadas — **preservadas**).
- **Evidência/relatórios desta fase:** `RLS_SESSION_NEXTAUTH_REPORT.md` (novo), `tmp/rls-e2e-artifacts/session-invalidation-nextauth.json`, scripts `tmp/*` locais.

## 13. Estado das fixtures

| Fixture | Baseline (início desta fase) | Estado final | Nota |
|---|---|---|---|
| `rls-e2e-a@example.test` | `sessionVersion 1`, ACTIVE, verified, tenant A | inalterada funcionalmente (`sessionVersion 1`) | A usada para testes. |
| `rls-e2e-b@example.test` | `sessionVersion 4`, ACTIVE, verified, tenant B (password já restaurada em fase anterior) | **mutada**: password restaurada para fixture sintética conhecida após teste de reset; **`sessionVersion 5`** (intencionalmente não revertido para preservar semântica de invalidação; JWTs antigos permanecem inválidos). | Login com password de fixture funciona; versão de sessão avançou. |
| `rls-e2e-admin@example.test` | `sessionVersion 1` | inalterada. | — |
| `rls-e2e-unverified@example.test` | `sessionVersion 1`, required true, unverified | inalterada. | — |
| `rls-e2e-notenant@example.test` | `sessionVersion 1`, sem tenant | inalterada. | — |
| Temporários | — | **0** utilizadores/tokens temp `rls-e2e-sess-*`; customer manipulação criado/limpo. | — |

## 14. Riscos restantes

- **AT RISK (JWT/logout):** sem revogação server-side de JWT; logout/signout e reutilização de cookie antigo produziram sinais ambíguos no teste automatizado. Qualquer dependência de “logout invalida imediatamente em todos os contextos” sem rotação de segredo/blacklist/DB sessions é **não provada**.
- **AT RISK:** rotas que ignorem `auth()`/callback e confiem apenas em estado cliente/cookie sem validação DB podem não honrar `sessionVersion`.
- **AT RISK:** `allowDangerousEmailAccountLinking=true` com Google (quando activo) + `getUserByEmail` bootstrap system context.
- **NOT PROVEN:** `Account`/`Session` (DB)/`VerificationToken` adapter sob RLS/policies/pgBouncer; OAuth callbacks reais; cookie expirado assinado; utilizador desactivado/suspenso matrix completa; mudança de tenant/role reflectida em sessões activas em todos os cenários.
- **NOT PROVEN:** schema drift 5437/migrações; Supabase/PgBouncer pooling; produção 5436/Supabase.
- **AT RISK:** tabelas adapter RLS OFF no protótipo 5437 — aceitável apenas como compatibilidade controlada, não postura de produção.

## 15. Avaliação de preparação para produção

**NÃO PRONTO PARA PRODUÇÃO.**

**Comprovado em 5437 (NOBYPASSRLS, runtime isolado):** invalidação efectiva de sessões JWT antigas após reset de password nos pontos validados (`/api/auth/session`, APIs protegidas via `auth()`, `/api/session/refresh`), rejeição de password antiga, aceitação de nova, bloqueio de login não verificado, isolamento tenant A/B em amostras, payload `tenantId` ignorado na criação testada, e regressões RLS/TS/unitárias verdes.

**Não comprovado / bloqueadores remanescentes:** revogação/logout server-side forte para JWT, expiração/cookie adulterado assinado completo, utilizador desactivado, OAuth/PrismaAdapter completo, `Account/Session/VerificationToken` sob RLS/pooling, schema drift/migrações, Supabase/PgBouncer, admin/financeiro/WMS HTTP completo, matriz concorrência/auth exaustiva. Activar/alterar RLS, policies, roles, privilégios ou migrações requer proposta fundamentada e autorização explícita.

---

## 2026-11-05 addendum — stale-JWT route exposure quantification
Under JWT strategy (session.strategy='jwt'), stale pre-logout cookie reuse on 5437/3037 was accepted by protected routes until DB-state rejection logic applies; sessionVersion unchanged at logout leaves copied JWT usable. Quantified: own-tenant reads (/api/produtos, /api/customers, /api/reports/export, /api/invoices/generate-saft, /api/stock/warehouses|movements|balances) returned 200 with stale JWT; POST /api/customers **mutated** tenant A data (cleaned). Admin /api/plan/payment/proof/[id] reached lookup with stale admin JWT (404) vs 401 post-logout. Fiscal/irreversible/admin-full/desktop-POST/onboarding flows remain NOT EXECUTED/NOT PROVEN. Evidence: RLS_STALE_JWT_SENSITIVE_ROUTES_REPORT.md.
