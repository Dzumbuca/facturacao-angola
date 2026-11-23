# MACHINE FACTURAS — A18 — Merge Ready For Publish

**Branch de origem:** `feat/machine-facturas-a18-operational-evolution`
**Branch de destino:** `main`
**Data:** 2026-11-19
**Autorização:** merge local autorizado; **push e deploy não autorizados**

---

## 1. HEAD inicial de `main`

```
Antes:  15bb189d316f23b630cc4cf23703077a0da07a1d
        fix(shell): keep ad visible but compressed below 720px; menu always usable
```

## 2. HEAD A18 integrado

```
Origem: 016af6687727ce30843721e7b7a0a0f04b0cbc00
        docs(A18): final integration and go-live plan
```

## 3. SHA do merge commit

```
9d7ae6540772be60036061db152f7a29398db50f
"merge: integrate Machine Facturas A18 operational evolution"
```

Após o merge:

```
main    = 9d7ae65   (merge commit, --no-ff)
A18     = 016af66   (inalterada)
merge-base(main, A18) = 016af66
origin/main = 15bb189 (NÃO alterado — nenhum push foi executado)
```

## 4. Commits preservados

### Correcções de `main` (integradas)

| Commit | Descrição | Preservado |
|---|---|---|
| `fb41550` | sidebar visível em viewports baixos; upsell escondido <880/700px | ✓ |
| `15bb189` | anúncio visível mas comprimido <720px; menu nunca cortado | ✓ |

Evidência no ficheiro final: `sidebar-ad-cap` = 1, `max-height: 560px` = 1, `sidebar-optional-tall` = 1 em `src/app/globals.css`.

### Commits funcionais A18

| Commit | Descrição | Presente em main |
|---|---|---|
| `1f8a9b0` | dívidas por cliente e fornecedor | ✓ |
| `184ceac` | relatório Contas a pagar | ✓ |
| `2dbab99` | capacidade concorrente (in-process capacity gate) | ✓ |
| `4eedd1d` | testes multi-tenant | ✓ |
| `ec03478` | relatório A18 | ✓ |
| `28b1c5b` | fecho A18 | ✓ |
| `6afa4c0` | fecho A17 (histórico) | ✓ |

Todos verificados com `git merge-base --is-ancestor`.

### Funcionalidades no código final

| Funcionalidade | Evidência |
|---|---|
| Dívidas por cliente | `src/lib/outstanding.ts` presente |
| Dívidas por fornecedor | `src/app/api/stock/suppliers/route.ts` |
| Recebíveis vencidos vs pendentes | `/recebiveis` = 2 ocorrências em `app-shell.tsx` |
| Contas a pagar (nav + título) | `/pagar` = 2 ocorrências |
| Contabilidade (nav) | `contabilidade/` = 9 ocorrências |
| Correcção de concorrência | `localAcquire` = 2 ocorrências em `emission-lease.ts` |
| Isolamento multi-tenant | `tenant-db.ts` + testes |

## 5. Resultado dos testes

| Verificação | Comando | Resultado |
|---|---|---|
| Prisma validate | `npx prisma validate` | ✓ `schema válido` — exit 0 |
| Prisma generate | `npx prisma generate` | ✓ Client 5.22.0 |
| TypeScript | `npx tsc --noEmit` | ✓ exit 0 |
| ESLint | `npm run lint` | ✓ 0 erros (23 warnings pré-existentes) |

> Nota técnica: `prisma validate` falhou inicialmente no worktree com `P1012 — Environment variable not found: DATABASE_URL`, porque o `.env` é gitignored e não existe no worktree. Reexecutado com `DATABASE_URL` definido: **schema válido, exit 0**. Não é defeito de schema.

A suite completa de regressão **não foi repetida** — não existem alterações funcionais face à A18 já validada (582 passed / 8 skipped; WMS E2E 80/80; A11 concorrência 3/3).

## 6. Resultado do build

```
Comando:   npx next build --webpack   (NODE_ENV=production)
Resultado: exit 0
BUILD_ID:  thVtKAblWhc097LwlAToC
Páginas pré-renderizadas: 10
```

> Nota técnica: `tools/scripts/build.mjs` (Turbopack) não é utilizável num worktree porque o `node_modules` é uma junction fora da raiz hermética do Turbopack — limitação do ambiente de worktree, não do código. O build webpack, que não impõe essa restrição, completa com sucesso. O build Turbopack da A18 na working tree principal já tinha sido validado (`[build] done`).

## 7. Estado dos ficheiros locais

**101 ficheiros não commitados preservados** — 98 ficheiros do utilizador (RH/Admin/documentação) + 3 artefactos `.qa-*`.

### Método de execução do merge

O checkout directo de `main` **não era seguro**: 5 ficheiros estão simultaneamente modificados na working tree e diferem entre A18 e main, o que faria o git recusar o checkout ou risking perda de trabalho:

```
src/app/api/rh/employees/[id]/route.ts
src/app/api/rh/employees/route.ts
src/lib/invoice-concurrency.integration.test.ts
src/lib/rh-reports.integration.test.ts
src/lib/team-invite-actions.ts
```

Foi usado um **worktree dedicado** (`.qa-a18/mainmerge`, removido após validação). O resultado sobre a ref `main` é idêntico ao `git checkout main && git merge`, mas a working tree do utilizador nunca foi tocada.

Após o merge, os 5 ficheiros continuam modificados localmente e intactos.

## 8. Estado de produção

| Item | Estado |
|---|---|
| Migrations de produção | **NOT VERIFIED** — `psql` devolve `FATAL: password authentication failed for user "postgres"` |
| Production Branch Vercel | **NOT VERIFIED** — CLI bloqueado (`EPERM` em `auth.json`) |
| Variáveis de ambiente | **NOT VERIFIED** — valores mascarados `[SENSITIVE]` |
| Connection Pooler | **NOT VERIFIED** (código compatível com 6543, confirmado por análise) |
| Deployment anterior READY | **NOT VERIFIED** |
| Rollback | **NOT VERIFIED** |

Sondagem HTTPS read-only de `machinefaturas.shop`: `/inicio` 200, `/login` 200, `/api/auth/csrf` 200, `/api/cron/reminders` 401.

## 9. Pendências operacionais

1. Confirmar Production Branch = `main`
2. Confirmar `_prisma_migrations` = `67 | 67 | 0 | 0` no Supabase SQL Editor
3. Registar modo/porta de Connection Pooling
4. Confirmar `PIN_PEPPER` ou desactivar RH explicitamente
5. Identificar o deployment anterior READY para rollback

## 10. Procedimento exacto para push

```bash
git checkout main
git push origin main
```

**Se `main` for a Production Branch, este push desencadeia imediatamente um deployment de produção.**

Verificação posterior:

```bash
git fetch origin
git rev-parse origin/main        # deve ser 9d7ae6540772be60036061db152f7a29398db50f
```

## 11. Procedimento de publicação Vercel

1. Confirmar Production Branch nas Settings do projecto
2. Após o push, abrir Deployments e aguardar o estado READY
3. Confirmar o SHA do deployment = `9d7ae65`
4. Verificar `GET /inicio` → 200, `GET /login` → 200, `GET /api/cron/reminders` → 401
5. Rever Runtime Logs durante 15 min (procurar erros 500)
6. Confirmar login administrativo e render do dashboard

## 12. Plano de rollback

1. Vercel → Project → Deployments
2. Registar o deployment Production actual (ID, SHA, data)
3. Localizar o deployment READY imediatamente anterior (`15bb189`)
4. Clicar "Promote to Production" nesse deployment
5. Confirmar `GET /inicio` → 200 em ~30 s

**Sem reversão de schema necessária** — A18 não introduziu migrations nem alterou `schema.prisma`.

---

## Estado final

```text
A18 MERGED INTO LOCAL MAIN:      YES  (9d7ae65)
GIT HISTORY PRESERVED:           YES  (merge --no-ff, sem squash)
MAIN FIXES PRESERVED:            YES  (fb41550, 15bb189)
A18 FEATURES PRESERVED:          YES  (1f8a9b0 … 28b1c5b)
TYPESCRIPT:                      PASS
LINT:                            PASS
PRODUCTION BUILD:                PASS  (BUILD_ID thVtKAblWhc097LwlAToC)
SUPABASE MODIFIED:               NO
MIGRATIONS EXECUTED:             NO
VERCEL MODIFIED:                 NO
PUSH EXECUTED:                   NO
DEPLOY EXECUTED:                 NO
```

**LOCAL MAIN READY FOR OWNER AUTHORIZATION TO PUSH**
