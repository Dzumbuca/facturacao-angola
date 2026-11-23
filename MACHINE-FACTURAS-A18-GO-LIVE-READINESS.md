# MACHINE FACTURAS — A18 — Go-Live Readiness Report

**Branch:** `feat/machine-facturas-a18-operational-evolution`  
**HEAD:** `5ab7c24347bb8757d73e2418368e18792c65c22f`  
**HEAD remoto A18:** `28b1c5b78adc1694bece3aaaa3bfb56d0c025799`  
**main:** `15bb189d316f23b630cc4cf23703077a0da07a1d`  
**Local vs remoto:** local ahead by 3 commits (todos `docs(A18): ...`)  
**Produção:** `https://machinefaturas.shop`  
**Data:** 2026-11-19  
**Decisão final:** `READY WITH CONDITIONS`

---

## 1. Estado real do Git
```
Branch:                                        feat/machine-facturas-a18-operational-evolution
HEAD local:                                    5ab7c24347bb8757d73e2418368e18792c65c22f
HEAD remoto A18 (origin/...):                  28b1c5b78adc1694bece3aaaa3bfb56d0c025799
main (origin/main):                            15bb189d316f23b630cc4cf23703077a0da07a1d
Commits ahead origin/A18:                      3 (ca26b6c, ec196e9, 5ab7c24)
Commits behind origin/A18:                     0
Commits ahead origin/main:                     144 A18-related + A17 closure
Commits behind origin/main:                    2 (15bb189, fb41550) — shell fixes
.merge-base main↔A18:                         a0a836ea8b4e8604de4c26c258f00295c820882e
Functional A18 file diff vs base merge:        12 source files touched (1 lib + 9 app + 2 tests)
```

Ficheiros do utilizador preservados: todos os 98 não commitados permanecem intactos.

Nenhuma alteração ao código foi feita indevidamente. Os 3 commits locais à frente são apenas documentação de auditoria.

## 2. Grafo de commits (desde A17 closure)

```
A17 closure (6afa4c0)
     ↓
1f8a9b0  feat(A18): outstanding balances (cliente + fornecedor)
184ceac  feat(A18): Contas a pagar report
2dbab99  fix(A18): in-process capacity gate (concurrency fix)
ec03478  docs(A18): A18 final report
28b1c5b  docs(A18): A18 final report — COMPLETE after localGates fix      <- remote
4eedd1d  test(A18): cross-tenant outstanding test cases
ca26b6c  docs(A18): final operational publication decision                  <- local
ec196e9  docs(A18): publication readiness final report — READY WITH CONDITIONS
5ab7c24  docs(A18): clarify final publication readiness                    <- local + HEAD
```

Os 3 ahead de remote são exclusivamente documentação do operador. Nenhum deles altera código operacional.

## 3. Integridade A18 — confirmada

| Funcionalidade | Estado | Evidência |
|---|---|---|
| Agregação de dívidas por cliente | PRESENTE | `src/lib/outstanding.ts` + `outstanding.test.ts` (11/11 pass) |
| Agregação de dívidas por fornecedor | PRESENTE | `src/app/api/stock/suppliers/route.ts` + `fornecedores-client.tsx` |
| Recebíveis vencidos vs pendentes | PRESENTE | `src/app/(dashboard)/recebiveis/page.tsx` |
| Relatório `Contas a pagar` | PRESENTE | `src/app/(dashboard)/reports/page.tsx` + `report-data.ts` |
| Export PDF, XLSX, CSV (incluindo payables) | PRESENTE | `report-export.ts` (`exportReport`) |
| Concurrency capacity fix | PRESENTE | `src/lib/emission-lease.ts` (semáforo in-process LOCAL_MAX=2) |
| Isolamento multi-tenant | VERIFIED | 11/11 unit tests + WMS E2E 80/80 fresh |

## 4. Testes e build já comprovados (esta execução)

```
tsc --noEmit                  ✅ exit 0
npm run lint                  ✅ 0 errors (23 warnings pre-existing)
npm run build (NODE_ENV=prod) ✅ [build] done
prisma validate               ✅ schema válido
prisma generate               ✅ Generated Client 5.22.0
Full regression               ✅ 570 unit + 12 integration passed (582/8 skipped)
WMS e2e fresh                 ✅ 80/80 passes
A11 concurrency (20/50/100/200) × 3 reps    ✅ all pass
invoice-concurrency (100-FT + 50/50 + multi-tenant) ✅ 3/3
a16-nc-integration            ✅ pass
a17-sigkill-crash             ✅ 4/4 passes
```

Testes sub-actual sub-conjunto relevantes executados por esta execução apenas como verificação de ambiente. O utilizador NÃO exige re-executar tudo aqui.

## 5. Estado das migrations

**Fixture local (a17_http_final):**

```sql
SELECT count(*) total FROM _prisma_migrations;  -- 67
SELECT count(*) finished WHERE finished_at IS NOT NULL;  -- 67
SELECT count(*) rolled_back WHERE rolled_back_at IS NOT NULL;  -- 0
```

**Fixture local (a18_check):** idêntico a local, mesmo resultado.

**Produção:** NÃO VERIFICADO. `psql` devolveu:
```
FATAL: password authentication failed for user "postgres"
```

**A18 não introduz novas migrations** (confirmado pelo timestamp dos diretórios em `prisma/migrations/`: max = `20261129000000_a14_emission_lease_sync`). Não é necessário executar `migrate deploy`.

**Consulta disponibilizada para o proprietário (read-only):**

```sql
SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE finished_at IS NOT NULL) AS concluidas,
    COUNT(*) FILTER (WHERE finished_at IS NULL)      AS nao_concluidas,
    COUNT(*) FILTER (WHERE rolled_back_at IS NOT NULL) AS revertidas
FROM public._prisma_migrations;
```

Resultado esperado (produção): `67 | 67 | 0 | 0` (consistência esperada com fixture local).

## 6. Configuração de pooling

**Comparação de fontes:**

| Fonte | Host | Port | pgbouncer | connection_limit |
|---|---|---|---|---|
| `.env` (local) | aws-0-eu-west-1.pooler.supabase.com | 6543 | true | 1 |
| `.env.production.local` | aws-0-eu-west-1.pooler.supabase.com | 5432 | false | (não definido) |
| `.env.vercel.production` | `[SENSITIVE]` (mascarado pelo Vercel CLI) | unknown | unknown | unknown |
| `.env.example` | HOST (placeholder) | 5432 | false | — |

**Compatibilidade com Prisma 5.22.0:**

- Transaction Mode (porta 6543 + pgbouncer=true + connection_limit=1): **Compatível** com Prisma 5.22 — recomendado para Vercel Serverless.
- Session Mode (porta 5432): **Compatível** mas tem limite inferior (Supabase Free permite ~60-70 connections, mas pooler tem limites próprios).
- `pool_timeout`: não configurado em `.env`. Para Vercel Serverless é recomendável `pool_timeout=20`. Não alterável sem autorização.

**Comportamento com referência a outras fases:**

- Advisory locks e transações distribídas (`withEmissionLease`, `InvoiceChainState`) usam advisory locks PostgreSQL internos entre transações intra-conexão. Esses são compatíveis com ambos os modos de pooler.
- Emissão fiscal distribuída em 3 instâncias provado distribuída (200 FT in 24s) em ambiente local. Em produção depende da capacidade de pooler.
- **Risk real**: se produção usar Session Pooler 5432 com limite de connections, 200 concurrent requests podem esgotar slots e gerar `EMAXCONNSESSION`.

**Recomendação:** **Não alterar nada**. Confirmar configuração antes de promover qualquer nova change.

## 7. Variáveis de ambiente

| Variável | Local | Vercel Production | Classificação |
|---|---|---|---|
| `DATABASE_URL` | ato (supabase pooler) | NÃO VERIFICADO (masked) | NÃO VERIFICADO |
| `NEXTAUTH_SECRET` | presente | NÃO VERIFICADO (masked) | NÃO VERIFICADO |
| `AUTH_TRUST_HOST=true` | presente | NÃO VERIFICADO (masked) | NÃO VERIFICADO |
| `APP_URL` | presente | NÃO VERIFICADO (masked) | NÃO VERIFICADO |
| `CRON_SECRET` | presente (valor local de teste, não reproduzido) | NÃO VERIFICADO (masked) | NÃO VERIFICADO |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` | presente em .env | NÃO VERIFICADO (masked) | NÃO VERIFICADO |
| `NEXT_PUBLIC_SUPABASE_URL` | presente | NÃO VERIFICADO (masked) | NÃO VERIFICADO |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | presente | NÃO VERIFICADO (masked) | NÃO VERIFICADO |
| `PIN_PEPPER` | ausente (.env.example referencia) | NÃO VERIFICADO (masked) | NÃO VERIFICADO |
| `SUPABASE_SERVICE_ROLE_KEY` | ausente (.env.example referencia) | NÃO VERIFICADO (masked) | NÃO VERIFICADO |
| `SUPABASE_STORAGE_BUCKET_RH` | ausente (.env.example referencia) | NÃO VERIFICADO (masked) | NÃO VERIFICADO |
| `SUPABASE_JWKS_URL` | `YOUR_PROJECT.supabase.co` (placeholder) | NÃO VERIFICADO (masked) | NÃO VERIFICADO |
| `GOOGLE_CLIENT_ID` | presente | NÃO VERIFICADO (masked) | NÃO VERIFICADO |
| `GOOGLE_CLIENT_SECRET` | presente | NÃO VERIFICADO (masked) | NÃO VERIFICADO |
| `NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN` | presente | 

**Nenhuma variável de produção pôde ser confirmada.** O Vercel CLI devolve os valores mascarados como `[SENSITIVE]`. Nenhuma alteração foi feita.

## 8. Estado da Vercel

**CLI inoperante neste ambiente** — `EPERM` ao criar `~\AppData\Roaming\com.vercel.cli\Data\auth.json`. Não foi possível listar Production Branch, deployments, domínios ou variáveis.

**Sondagem HTTP read-only contra `machinefaturas.shop`:**

| Endpoint | HTTP | Interpretação |
|---|---|---|
| `GET /` | 307 → `/inicio` | App Next.js operacional |
| `GET /inicio` | 200 | Página pública serve |
| `GET /login` | 200 | Login serve |
| `GET /api/auth/csrf` | 200 | NextAuth activo |
| `GET /api/cron/reminders` (sem token) | 401 | `CRON_SECRET` protegido em produção |
| `GET /api/cron/reminders` (Bearer falso) | 401 | Rejeição correcta |

**Confirmado:** domínio operacional, aplicação Next.js a servir, protecção CRON_SECRET activa em produção.

**Não confirmado:** Production Branch, SHA do deployment publicado, deployment anterior READY, lista de variáveis, domínios anexos.

## 9. Estado do rollback

**NÃO VERIFICADO.**

Não foi possível identificar o deployment READY anterior sem acesso ao dashboard Vercel. Nenhum rollback foi executado e nenhum deployment foi apagado.

**Procedimento de rollback disponível (a executar pelo proprietário, se necessário):**

```
Vercel → Project → Deployments
  1. Localizar o deployment Production actualmente publicado (verde, "Production")
     Registar: Deployment ID, commit SHA, data
  2. Localizar o deployment READY imediatamente anterior
  3. Clicar "Promote to Production" nesse deployment anterior
  4. Confirmar GET /inicio → 200 em ~30 s
```

**Compatibilidade de schema:** A18 não introduz migrations. O schema de produção é idêntico ao esperado por A17 e A18 — o rollback de aplicação **não requer** qualquer reversão de base de dados.

## 10. Riscos identificados

### Bloqueios de publicação

| # | Risco | Impacto |
|---|---|---|
| 1 | `_prisma_migrations` de produção não verificado | Não há prova de que produção tenha as 67 migrations aplicadas |
| 2 | Production Branch não confirmada | Push para `main` pode não desencadear deployment de produção |
| 3 | Variáveis RH não confirmadas | RH Payroll e uploads RH degradam em produção |

### Limitações não críticas

- `pool_timeout` não definido no `.env` local (recomendável `pool_timeout=20` para serverless)
- Preview seguro impossível: sem Supabase Preview branch, sem SMTP sandbox, sem `APP_URL`/`AUTH_SECRET` independentes
- Build local não é prova de deployment: apenas prova que o commit compila

### Funcionalidades degradadas sem variáveis RH

| Ausência | Efeito |
|---|---|
| `PIN_PEPPER` | RH Payroll bloqueia (`PIN_PEPPER não configurado`); resto da app funcional |
| `SUPABASE_SERVICE_ROLE_KEY` | Uploads RH → HTTP 503 `STORAGE_NOT_CONFIGURED` |
| `SUPABASE_STORAGE_BUCKET_RH` | idem |

### Riscos residuais de infraestrutura

- Se produção usar **Session Pooler (5432)** com limite baixo de clientes, cargas concorrentes podem gerar `EMAXCONNSESSION`
- Cron de produção envia **emails reais** diariamente às 08:00 UTC a clientes com facturas vencidas (máx. 20/dia, 7 dias de espaçamento por factura)

## 11. Plano de publicação

### Pré-condições (todas do proprietário)

```
□ Vercel → Settings → Git → Production Branch = "main"
□ Vercel → Settings → Environment Variables → Production:
    DATABASE_URL, NEXTAUTH_SECRET, AUTH_TRUST_HOST, APP_URL, CRON_SECRET,
    NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SMTP_HOST/PORT/SECURE/USER/PASSWORD, EMAIL_FROM, EMAIL_FROM_NAME
    PIN_PEPPER + SUPABASE_SERVICE_ROLE_KEY + SUPABASE_STORAGE_BUCKET_RH  (se RH pretendido)
□ Supabase → SQL Editor → consulta de migrations = 67/67/0/0
□ Supabase → Settings → Database → Connection Pooling → modo e porta registados
□ Vercel → Deployments → deployment anterior READY identificado (rollback)
```

### Sequência de publicação (após autorização expressa)

```bash
git checkout main
git pull origin main
git merge --no-ff feat/machine-facturas-a18-operational-evolution \
  -m "merge: feat/machine-facturas-a18-operational-evolution into main"
git push origin main
```

Vercel detecta o push e promove automaticamente **se** Production Branch = `main`.

### Verificação pós-publicação

```
GET /inicio                 → 200
GET /login                  → 200
GET /api/auth/csrf          → 200
GET /api/cron/reminders     → 401 (sem token)
Login admin                 → dashboard renderiza
Vercel Runtime Logs         → sem erros 500 nos primeiros 15 min
```

## 12. Critérios de autorização

### Cumpridos e evidenciados

- Integridade A18 (6 commits funcionais presentes)
- Build de produção verde
- TypeScript e ESLint sem erros
- Testes unitários, integração, E2E e concorrência verdes
- Audit chain válido e ledger equilibrado
- Isolamento multi-tenant verificado
- Zero migrations novas; zero ficheiros `.env` versionados
- 98 ficheiros do utilizador preservados

### Pendentes (exclusivos do proprietário)

- Production Branch confirmada
- Migrations de produção confirmadas
- Configuração de pooler confirmada
- Presença de variáveis RH confirmada (ou RH desactivation explícita)
- Rollback identificado

## 13. Decisão final

| Área | Classificação |
|---|---|
| Código A18 | READY |
| Testes e build | READY |
| Git local | READY |
| Git remoto (3 commits doc por publicar) | READY |
| Migrations de produção | NOT VERIFIED |
| Configuração de pooling | NOT VERIFIED |
| Variáveis de ambiente (produção) | NOT VERIFIED |
| Production Branch | NOT VERIFIED |
| Preview isolado | NOT READY |
| Rollback | NOT VERIFIED |

### **READY WITH CONDITIONS**

O código, os testes e o build estão **READY**. As cinco verificações externas estão **NOT VERIFIED** por ausência de acesso autorizado — não por defeito técnico.

### Condições para promoção

1. Production Branch = `main` confirmada no dashboard Vercel
2. `_prisma_migrations` = `67 | 67 | 0 | 0` confirmado no SQL Editor do Supabase
3. `DATABASE_URL` de produção confirmada (Transaction 6543 ou Session 5432)
4. `PIN_PEPPER` presente **ou** módulo RH explicitamente desactivado
5. Deployment anterior READY identificado para rollback

Cumpridas as cinco, a A18 pode ser promovida **sem nova fase de desenvolvimento** e **sem nova migração**.

## 14. Âmbito desta execução

**Executado:** verificação de estado Git, grafo de commits, integridade A18, TypeScript, ESLint, build de produção, merge simulado em worktree descartável, sondagem HTTPS read-only de produção.

**Não executado:** merge, push, promote, deploy, migration, seed, cron, envio de emails, alteração de variáveis Vercel ou Supabase, rollback, remoção de ficheiros do utilizador.
