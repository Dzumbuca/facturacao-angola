# MACHINE FACTURAS — A18 — Final Integration and Go-Live

**Branch A18:** `feat/machine-facturas-a18-operational-evolution`
**HEAD local:** `9e94f0897e8c49828ee64092aae9de63bf612158`
**HEAD remoto A18:** `28b1c5b78adc1694bece3aaaa3bfb56d0c025799`
**main (local = remoto):** `15bb189d316f23b630cc4cf23703077a0da07a1d`
**Produção:** `https://machinefaturas.shop`
**Data:** 2026-11-19

---

## 1. Estado real do Git

| Métrica | Valor |
|---|---|
| Branch actual | `feat/machine-facturas-a18-operational-evolution` |
| HEAD local | `9e94f08` |
| HEAD remoto A18 | `28b1c5b` |
| `main` local | `15bb189` |
| `origin/main` | `15bb189` (idêntico — sem divergência) |
| merge-base (main ↔ A18) | `a0a836ea8b4e8604de4c26c258f00295c820882e` |
| Commits exclusivos de `main` | **2** (`fb41550`, `15bb189`) |
| Commits exclusivos de A18 (remoto) | 143 |
| Commits exclusivos de A18 (local) | 147 |
| Commits locais por publicar | **4** (todos `docs(A18):`) |
| Ficheiros não commitados | 101 (98 do utilizador + 3 artefactos `.qa-*`) |

**Não existe divergência de histórico.** `main` está sincronizada local/remoto. A18 está 4 commits à frente do remoto, todos documentais.

## 2. Análise dos commits exclusivos de `main`

### `fb41550` — fix(shell): sidebar nav visível em viewports baixos

| Campo | Valor |
|---|---|
| Autor | Black Machine (mesmo autor do projecto) |
| Data | 2026-11-16 09:39 |
| Ficheiros | `src/app/globals.css` (+9), `src/components/app-shell.tsx` (3/3) |
| Conteúdo | Media queries `max-height: 880px/700px` + classes `sidebar-optional-tall/medium` |

### `15bb189` — fix(shell): anúncio visível mas comprimido abaixo de 720px

| Campo | Valor |
|---|---|
| Autor | Black Machine |
| Data | 2026-11-16 09:49 |
| Ficheiros | `src/app/globals.css` (+10/-4), `src/components/app-shell.tsx` (1/1) |
| Conteúdo | `max-height: 720px` → `.sidebar-ad-cap`, `max-height: 560px`, classe `sidebar-ad-cap` no anúncio |

### Veredicto da análise

| Pergunta | Resposta |
|---|---|
| São correcções legítimas? | **Sim** — UI shell, responsividade de sidebar |
| Tocam RH/Admin? | **Não** |
| Tocam configuração/dependências? | **Não** — apenas CSS e JSX |
| Estão incorporadas na A18? | **Não** — `grep sidebar-ad-cap` = 0 na A18 |
| Conflitam com A18? | **Não** — A18 não tocou `globals.css` e alterou `app-shell.tsx` em linhas 19–46 (nav), main alterou linhas 61–75 (sidebar footer) |
| Preservam histórico A1–A17? | **Sim** — merge preserva todos os ancestrais |

## 3. Merge-base e divergência

```
merge-base: a0a836e (Merge PR #31 — rh-payroll-etapa-a-protecao)
main:       a0a836e → fb41550 → 15bb189          (2 commits)
A18:        a0a836e → ...143 commits... → 28b1c5b (remoto)
            a0a836e → ...147 commits... → 9e94f08  (local)
```

Divergência **exclusivamente aditiva**: main acrescenta 2 commits de UI; A18 acrescenta 147 commits de funcionalidade + documentação. Nenhum lado reescreve o outro.

## 4. Resultado da simulação de merge

**Ambiente:** worktree descartável `.qa-a18/golive` (removido após verificação). Branch real **não tocada**.

| Métrica | Resultado |
|---|---|
| Comando | `git merge --no-ff --no-commit feat/machine-facturas-a18-operational-evolution` |
| Origem | `15bb189` (main) |
| Destino | `9e94f08` (A18 local) |
| merge-base | `a0a836e` |
| Conflitos | **0** (`git diff --diff-filter=U` vazio) |
| Auto-merge | `src/components/app-shell.tsx` |
| Ficheiros integrados | 147 commits |

### Preservação de ambos os lados

| Verificação | Resultado |
|---|---|
| `15bb189` preservado (`sidebar-ad-cap` em globals.css) | ✓ 1 ocorrência |
| `15bb189` preservado (`max-height: 560px`) | ✓ 1 |
| `15bb189` preservado (`sidebar-ad-cap` em app-shell.tsx) | ✓ 1 |
| `fb41550` preservado (`sidebar-optional-tall`) | ✓ 1 |
| `fb41550` preservado (`sidebar-optional-medium`) | ✓ 1 |
| A18 preservado (`/recebiveis`) | ✓ 2 |
| A18 preservado (`/pagar`) | ✓ 2 |
| A18 preservado (`contabilidade/balancete`) | ✓ 2 |

### Validação técnica do merged tree

| Verificação | Resultado |
|---|---|
| `tsc --noEmit` | **exit 0** |
| `npm run lint` | **exit 0** (0 erros) |
| `next build --webpack` (NODE_ENV=production) | **exit 0** — BUILD_ID `m0OsPLjthS7wKcDSzYv-k` |

> Nota: `tools/scripts/build.mjs` (Turbopack) falha **apenas** no worktree porque o `node_modules` é uma junction fora da raiz hermética do Turbopack — artefacto de ambiente do worktree, não defeito de merge. O build webpack, que não impõe raiz hermética, completa com sucesso.

## 5. Integridade funcional A18

| Commit | Descrição | Presente |
|---|---|---|
| `1f8a9b0` | feat(A18): outstanding balances | ✓ |
| `184ceac` | feat(A18): Contas a pagar report | ✓ |
| `2dbab99` | fix(A18): in-process capacity gate | ✓ |
| `4eedd1d` | test(A18): cross-tenant edge cases | ✓ |
| `ec03478` | docs(A18): A18 final report | ✓ |
| `28b1c5b` | docs(A18): A18 final report — COMPLETE | ✓ (remoto) |

| Funcionalidade | Ficheiro | Estado |
|---|---|---|
| Dívidas por cliente | `src/lib/outstanding.ts` | PRESENTE |
| Dívidas por fornecedor | `src/app/api/stock/suppliers/route.ts` | PRESENTE |
| Recebíveis vencidos vs pendentes | `src/app/(dashboard)/recebiveis/page.tsx` | PRESENTE |
| Relatório Contas a Pagar | `src/lib/report-data.ts`, `reports/page.tsx` | PRESENTE |
| Export PDF/XLSX/CSV | `src/lib/report-export.ts` | PRESENTE |
| Correcção de concorrência | `src/lib/emission-lease.ts` | PRESENTE |
| Isolamento multi-tenant | `src/lib/tenant-db.ts` + testes | PRESENTE |

## 6. Testes e build comprovados

| Verificação | Resultado |
|---|---|
| `prisma validate` | ✓ schema válido |
| `prisma generate` | ✓ Client 5.22.0 |
| `tsc --noEmit` | ✓ exit 0 |
| `npm run lint` | ✓ 0 erros (23 warnings pré-existentes) |
| Build A18 HEAD (Turbopack) | ✓ `[build] done` |
| Build merged tree (webpack) | ✓ exit 0 |
| Regressão completa | ✓ 582 passed / 8 skipped |
| WMS E2E (fresh) | ✓ 80/80 |
| A11 concorrência 20/50/100/200 × 3 | ✓ todos |
| invoice-concurrency 100 FT / mix / multi-tenant | ✓ 3/3 |
| A17 SIGKILL crash recovery | ✓ 4/4 |
| Audit chain | ✓ VALID |
| Ledger | ✓ diff 0.00 |
| Multi-tenant isolation | ✓ verificado |

## 7. Estado das migrations

| Métrica | Valor |
|---|---|
| Migrations no repositório | **67** |
| Última migration | `20261129000000_a14_emission_lease_sync` |
| Migrations adicionadas por A18 | **0** |
| Migrations alteradas/removidas por A18 | **0** |
| Alterações a `schema.prisma` em A18 | **0** |
| Estado local (fixture) | 67 total / 67 concluídas / 0 revertidas |
| Estado em produção | **NOT VERIFIED** |

Produção não pôde ser consultada: `psql` devolve `FATAL: password authentication failed for user "postgres"` (credenciais locais expiradas).

**Consulta para o proprietário executar no Supabase SQL Editor:**

```sql
SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE finished_at IS NOT NULL)      AS concluidas,
    COUNT(*) FILTER (WHERE finished_at IS NULL)          AS nao_concluidas,
    COUNT(*) FILTER (WHERE rolled_back_at IS NOT NULL)   AS revertidas
FROM public._prisma_migrations;
```

Resultado esperado: `67 | 67 | 0 | 0`.

## 8. Estado do pooling

### Configuração por fonte

| Fonte | Host | Porta | pgbouncer | connection_limit | pool_timeout |
|---|---|---|---|---|---|
| `.env` local | pooler.supabase.com | **6543** | **true** | **1** | não definido |
| `.env.production.local` | pooler.supabase.com | 5432 | não | não | não |
| `.env.vercel.production` | *mascarado* | *não verificado* | *não verificado* | *não verificado* | *não verificado* |

### Compatibilidade técnica com Prisma 5.22 — verificada no código

| Primitiva | Onde | Âmbito | Compatível com Transaction Pooler (6543)? |
|---|---|---|---|---|
| `set_config('app.tenant_id', …, true)` | `tenant-db.ts:27-29`, `ad-unlock-service.ts:52-54` | **transacção** (3.º arg `true` = `is_local`) | **SIM** |
| `pg_advisory_xact_lock` | `customers`, `produtos`, `stock/*`, `gl-sequence`, `gl-service`, `rh-service` | transacção (liberta no COMMIT) | **SIM** |
| `SELECT … FOR UPDATE` (InvoiceChainState) | `invoice-integrity.ts:80` | transac

**Conclusão técnica:** o código **é compatível com Supabase Transaction Pooler (6543)**. Todas as primitivas de serialização são transaccionais (advisory xact locks ou row-level `FOR UPDATE`) e o contexto RLS é definido com `set_config(..., true)`, local à transacção. Não existe estado de sessão que quebre sob pooling de transacções.

| Modo | Vantagem | Risco |
|---|---|---|
| Transaction (6543) | Sem limite de clientes; recomendado para serverless | N/A — código compatível |
| Session (5432) | Compatível | Limite de conexões; sob carga pode gerar `EMAXCONNSESSION` |

**Não foi alterada nenhuma configuração.**

## 9. Configuração Vercel

**CLI inoperante neste ambiente:** `EPERM` ao criar `~\AppData\Roaming\com.vercel.cli\Data\auth.json`.

**Sondagem HTTPS read-only de produção:**

| Endpoint | HTTP | Interpretação |
|---|---|---|
| `GET /` | 307 → `/inicio` | Next.js operacional |
| `GET /inicio` | 200 | OK |
| `GET /login` | 200 | OK |
| `GET /api/auth/csrf` | 200 | NextAuth activo |
| `GET /api/cron/reminders` | 401 | CRON_SECRET protegido |
| `GET /api/cron/reminders` (Bearer inválido) | 401 | Rejeição correcta |

**NOT VERIFIED:** Production Branch, SHA publicado, deployment anterior READY, variáveis Production, domínios.

## 10. Rollback

**NOT VERIFIED.** Sem acesso ao dashboard Vercel não foi possível identificar o deployment READY anterior.

**Confirmação técnica:** A18 não introduz migrations nem altera `schema.prisma`. O rollback da aplicação **não exige reversão de schema** — basta promover o deployment anterior.

**Procedimento (proprietário):**

```
Vercel → Project → Deployments
  1. Registar o deployment Production actual: ID, SHA, data
  2. Localizar o deployment READY imediatamente anterior
  3. "Promote to Production" nesse deployment
  4. Confirmar GET /inicio → 200 em ~30 s
```

Nenhum rollback foi executado e nenhum deployment foi apagado.

## 11. Riscos residuais

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| 1 | Migrations de produção não verificadas | Média | SQL Editor (67/67 esperado) |
| 2 | Production Branch não confirmada | Alta | Confirmar no dashboard |
| 3 | Variáveis RH não confirmadas | Média | Confirmar ou desactivar RH |
| 4 | Rollback não identificado | Média | Registar deployment anterior READY |
| 5 | Cron envia emails reais às 08:00 UTC | Baixa | Comportamento esperado; 20/dia, 7 dias de espaçamento |
| 6 | `pool_timeout` não definido | Baixa | Recomendável `pool_timeout=20` |
| 7 | Preview seguro inexistente | Baixa | Validar em produção com monitorização |

### Funcionalidades degradadas sem variáveis RH

| Ausência | Efeito |
|---|---|
| `PIN_PEPPER` | RH Payroll bloqueia; resto da app funcional |
| `SUPABASE_SERVICE_ROLE_KEY` | Uploads RH → HTTP 503 `STORAGE_NOT_CONFIGURED` |
| `SUPABASE_STORAGE_BUCKET_RH` | idem |

## 12. Estratégia definitiva de integração

### **Cenário A — Merge limpo (aplicável)**

Simulação provou 0 conflitos.

```bash
git checkout main
git pull origin main
git merge --no-ff feat/machine-facturas-a18-operational-evolution \
  -m "merge: feat/machine-facturas-a18-operational-evolution into main"
```

Preserva integralmente `fb41550`, `15bb189`, todos os commits funcionais A18 e todo o histórico A1–A17.

### Cenários B e C

Não se aplicam — sem conflitos, sem incompatibilidade de histórico.

### Distinção obrigatória entre operações

| # | Operação | Efeito | Autorização |
|---|---|---|---|
| 1 | Merge Git (local) | Merge commit em `main` local | Sim |
| 2 | Push `origin/main` | **Pode desencadear deployment de produção** | Sim |
| 3 | Preview Deployment | Requer isolamento inexistente | Sim + infra |
| 4 | Promoção Production | Deploy efectivo | Sim |

## 13. Procedimento de publicação

### Pré-condições (proprietário)

```
□ Vercel → Settings → Git → Production Branch = "main"
□ Supabase → SQL Editor → migrations = 67 | 67 | 0 | 0
□ Supabase → Settings → Database → Connection Pooling (modo + porta)
□ Vercel → Environment Variables → Production:
    DATABASE_URL, NEXTAUTH_SECRET, AUTH_TRUST_HOST, APP_URL, CRON_SECRET,
    SMTP_*, EMAIL_FROM, EMAIL_FROM_NAME,
    NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    PIN_PEPPER + SUPABASE_SERVICE_ROLE_KEY + SUPABASE_STORAGE_BUCKET_RH (se RH)
□ Vercel → Deployments → deployment anterior READY identificado
```

### Sequência

```bash
git checkout main
git pull origin main
git merge --no-ff feat/machine-facturas-a18-operational-evolution \
  -m "merge: feat/machine-facturas-a18-operational-evolution into main"
git push origin main
```

### Verificação pós-publicação

```
GET /inicio                 → 200
GET /login                  → 200
GET /api/auth/csrf          → 200
GET /api/cron/reminders     → 401 (sem token)
Login admin                 → dashboard renderiza
Vercel Runtime Logs         → sem 500 nos primeiros 15 min
```

## 14. Autorizações ainda necessárias

| # | Operação | Estado |
|---|---|---|
| 1 | Merge A18 → main | Pendente |
| 2 | Push de main para origin/main | Pendente |
| 3 | Promoção para Production | Pendente |
| 4 | Confirmação Production Branch | Pendente (proprietário) |
| 5 | Confirmação migrations produção | Pendente (proprietário) |
| 6 | Confirmação pooling produção | Pendente (proprietário) |
| 7 | Confirmação variáveis RH | Pendente (proprietário) |
| 8 | Identificação rollback | Pendente (proprietário) |

## 15. Classificação por item

| Item | Classificação |
|---|---|
| Estado real do Git | **READY** |
| Commits exclusivos de main | **READY** (legítimos, sem conflito) |
| Merge-base e divergência | **READY** |
| Simulação de merge | **READY** (0 conflitos) |
| Integridade funcional A18 | **READY** |
| Testes e build | **READY** |
| Migrations (código) | **READY** (0 novas) |
| Migrations (produção) | **NOT VERIFIED** |
| Pooling (código) | **READY** (compatível com 6543) |
| Pooling (produção) | **NOT VERIFIED** |
| Configuração Vercel | **NOT VERIFIED** |
| Rollback | **NOT VERIFIED** |
| Preview isolado | **NOT READY** |

## 16. Decisão final

### **READY WITH CONDITIONS**

**Justificação:** não existe bloqueio técnico. O merge é limpo e foi validado com build, typecheck e lint sobre a árvore integrada. As pendências são exclusivamente confirmações de configuração acessíveis só pelo proprietário no dashboard — **não são defeitos de código**.

**Condições para promoção:**

1. Production Branch = `main` confirmada
2. Migrations de produção = `67 | 67 | 0 | 0`
3. Pooling de produção registado (6543 recomendado, 5432 aceitável)
4. `PIN_PEPPER` presente ou RH explicitamente desactivado
5. Deployment anterior READY identificado

Cumpridas as cinco, a A18 pode ser integrada e publicada **sem nova fase de desenvolvimento e sem qualquer migration**.

## 17. Âmbito desta execução

**Executado:** evidência Git, análise dos 2 commits exclusivos de main, simulação de merge em worktree descartável, validação técnica da árvore integrada (tsc, lint, build), verificação de migrations A17→A18, análise de compatibilidade de pooling no código, sondagem HTTPS read-only de produção.

**Não executado:** push, merge, deploy, promote, migration, seed, cron, emails, alteração de variáveis Vercel/Supabase, rollback, eliminação de ficheiros do utilizador.

O worktree descartável foi removido. A branch A18 e `main` permanecem intactas.
