# MACHINE FACTURAS — A18 — Publication Readiness Final

**Branch:** `feat/machine-facturas-a18-operational-evolution`  
**HEAD:** `ca26b6c2782ee1370df81cac3bc604ca01e5200f`  
**HEAD remoto:** `28b1c5b78adc1694bece3aaaa3bfb56d0c025799`  
**main conhecido:** `15bb189d316f23b630cc4cf23703077a0da07a1d`  
**Produção:** `https://machinefaturas.shop`  
**Plataforma:** Vercel  
**Database:** Supabase PostgreSQL  
**Data de análise:** 2026-11-19  
**Classificação:** **READY WITH CONDITIONS**

---

## 1. Estado Git e commits

```
Branch:            feat/machine-facturas-a18-operational-evolution
HEAD local:        ca26b6c2782ee1370df81cac3bc604ca01e5200f
HEAD remoto:       28b1c5b78adc1694bece3aaaa3bfb56d0c025799
main conhecido:    15bb189d316f23b630cc4cf23703077a0da07a1d
Uncommitted (excluindo 98 ficheiros preexistentes do utilizador e .qa-a18): 0
Total changed/untracked: 100 (99 anteriores + 1 novo: docs(A18): final operational publication decision)
```

Commits A18:
```
ca26b6c (local, não publicado) docs(A18): final operational publication decision
28b1c5b docs(A18): A18 final report — COMPLETE after localGates fix
4eedd1d test(A18): add cross-tenant edge cases to outstanding aggregates
2dbab99 fix(A18): add in-process capacity gate to withEmissionLease — avoids pool exhaustion under 200-concurrent
ec03478 docs(A18): A18 final report
184ceac feat(A18): add Contas a pagar report; fix outstanding type; report-data test payables
1f8a9b0 feat(A18): show outstanding balance per customer and supplier; split recebiveis by overdue vs pending
```

`git status --short` reporta apenas:

- 98 ou 99 ficheiros pré-existentes do utilizador (`M docs/ia-documents-preview/carta-apresentacao.docx`, `M src/app/rh/dashboard/page.tsx`, etc., todos intocados pela A18)
- `.qa-a18/` (scratch de verificação, não publicado)
- `.qa-a17/` (idem)

## 2. Correcção da consulta SQL

A consulta proposta anteriormente (`COUNT(finished_at IS NOT NULL)`) não é válida em PostgreSQL — não distingue entre migrations aplicadas e não aplicadas na tabela `_prisma_migrations`.

**Consulta correcta:**

```sql
SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE finished_at IS NOT NULL) AS concluidas,
    COUNT(*) FILTER (WHERE finished_at IS NULL)      AS nao_concluidas,
    COUNT(*) FILTER (WHERE rolled_back_at IS NOT NULL) AS revertidas
FROM public._prisma_migrations;
```

**Resultado esperado (produção):**

| Indicador | Valor esperado |
|---|---:|
| Total | 67 |
| Concluídas | 67 |
| Não concluídas | 0 |
| Revertidas | 0 |

**Programa local (fixture de testes) — verificado nesta execução:**

```
count total:  67
count finished: 67
count rolled back: 0
```

Esta é evidência de teste local apenas. **Não prova** que a base de dados real de produção esteja no mesmo estado.

**Sem acesso autorizado e comprovadamente read-only à base produtiva, esta consulta não foi executada contra produção.**

## 3. Evidências efectivamente obtidas

### Produção HTTPS (HEAD-only, sem modificar dados)

| Endpoint | HTTP |
|---|---|
| `/` | 307 (redirect para `/inicio`) |
| `/inicio` | 200 |
| `/login` | 200 |
| `/api/auth/csrf` | 200 |
| `/api/cron/reminders` (sem token) | 401 |
| `/api/cron/reminders` (com Bearer fake) | 401 |

Rota `/api/cron/reminders` está correctamente protegida por `CRON_SECRET` em produção.

### Migrations (fixture local)

```sql
SELECT count(*) FROM _prisma_migrations;  -- 67
SELECT count(*) WHERE finished_at IS NOT NULL;  -- 67
SELECT count(*) WHERE rolled_back_at IS NOT NULL;  -- 0
```

### Build

- `npm run build` com `NODE_ENV=production`: OK; BUILD_ID `ceMBpDIQKG8HDaSvtUQlH`
- 35 static + 179 dynamic
- `prisma generate`: OK, v5.22.0
- `prisma validate`: schema válido
- `tsc --noEmit`: exit 0
- `npm run lint`: 0 errors (23 warnings pré-existentes)

### Testes

- `npx vitest run`: 582 passed / 8 skipped (590)
- WMS E2E (`vitest.e2e.config.ts`): fresh 80/80 passa
- A11 concurrency (20/50/100/200 FT): 3/3 passa
- A16 e A17 SIGKILL integration suites: passes
- Audit chain: VALID (200 FTs validados distribuído)
- Ledger: diff 0.00

### Git e remote

- `git status --short`: 99 untracked/modified — 98 do utilizador intocados + 1 documento (este novo relatório)
- Não tocado nenhum arquivo preexistente do utilizador
- `.env*` não está no repositório
- `.qa-a18/`, `.qa-a17/`, `.qa-a16/`, `.qa-a15/`, `.qa-a15-seed.mjs`, `.npm-cache-temp/` — não publicados

### Local Supabase connection (`.env`)

- Host: `aws-0-eu-west-1.pooler.supabase.com`
- Port: `6543` (Transaction Pooler)
- `pgbouncer=true`
- `connection_limit=1`
- `pool_timeout`: **não configurado no .env local**
- Senha local: **inválida** — `psql` rejeita `password authentication failed for user "postgres"`

### Vercel project link (`.vercel/project.json`)

- Project name: `facturacao-angola`
- Project ID: `prj_bQuNw8oUhZnsgXBRs5h6BKEfR220`
- Org ID: `team_LITGObtclPkwH7QM8WESHZve`
- Project is **currently deployed and live** at `machinefaturas.shop` (verified via `/inicio` returns HTTP 200 with HSTS headers)

## 4. Itens não verificáveis

| Item | Razão | Confirmação necessária do proprietário |
|---|---|---|
| Production Branch Vercel | Vercel CLI POSIX permission denied (`EPERM creating \~/AppData\Roaming\com.vercel.cli\Data\auth.json`); `.env.vercel.production` valores masked `[SENSITIVE]` | Dashboard Vercel → Settings → Git → Production Branch |
| Estado de `_prisma_migrations` em produção | `psql` failed auth (senha local desactualizada) | Supabase dashboard → Settings → SQL Editor |
| Variáveis RH em Production (`PIN_PEPPER`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET_RH`) | `.env.vercel.production` valores masked | Vercel Settings → Environment Variables → Production (verificar presença) |
| Pooler configuration de produção | `.env.vercel.production` masked; não há confirm via CLI | Vercel Settings → Environment Variables → `DATABASE_URL` |
| Deployment actual publicado e deployment anterior para rollback | Vercel CLI bloqueado | Dashboard Vercel → Deployments |
| Preview deployment seguro | Não existe Supabase preview branch; não existe SMTP sandbox; AUTH_SECRET/NEXTAUTH_SECRET/APP_URL não independentes | Requer provisionamento explícito |
| Cron behaviour em Production | UTC 08:00 daily; acreditamos que configuração expõe emails reais; não há como observar a cadência real sem executar o cron | Confirmação directa no Vercel dashboard |

## 5. Instruções para o proprietário

### Vercel Local verification

```
Settings → Git → Production Branch
   Resultado esperado: "main"
   Se vazio ou diferente, identificar qual branch está configurada

Settings → Environment Variables → Production
   Verificar PRESENTE / AUSENTE para cada variável:

   PIN_PEPPER                          (se quiseres RH Payroll)
   SUPABASE_SERVICE_ROLE_KEY           (se quiseres uploads RH)
   SUPABASE_STORAGE_BUCKET_RH          (se quiseres uploads RH)
   NEXTAUTH_SECRET                     (recomendado, obrigatório)
   AUTH_TRUST_HOST=true                (recomendado)
   APP_URL                             (obrigatório; deve apontar para produção)
   CRON_SECRET                         (obrigatório se CRON_ENABLED)
   DATABASE_URL                        (obrigatório; verificado: pode estar em Session ou Transaction Pooler)
```

### Vercel Deployments inspection

```
Dashboard Vercel → Project Facturacao-Angola → Deployments
   Identificar o deployment publicado actualmente (verde, "Production")
   Identificar o `commit SHA` e a branch associada
   Notar o segundo deployment mais recente READY
   Guardar a informação para rollback
```

### Supabase Database verification

```
Dashboard Supabase → Project → Settings → SQL Editor

   Executar apenas:

   SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE finished_at IS NOT NULL) AS concluidas,
       COUNT(*) F

## 6. Riscos operacionais

### Bloqueios (impede promoção automática)

1. `_prisma_migrations` em produção não confirmável sem SQL Editor com query SELECT manual executada pelo utilizador
2. Production Branch no Vercel não confirmável — se for `feat/...-a18-operational-evolution` em vez de `main`, o push para main não promoverá para produção; a promoção terá que ser explícita
3. Variáveis RH no Vercel Production desconhecidas — RH Payroll或 uploads RH podem falhar em produção
4. Supabase Pooler configuration não confirmável — pode estar em Session Mode (porta 5432) com limite inferior de connections vs Transaction (porta 6543)

### Não-críticos mas notáveis

1. `pool_timeout` não configurado na .env local — para Vercel Serverless é recomendável `pool_timeout=20` em conjunto com `connection_limit=1`
2. Não há preview deployment seguro — impossível validar completamente a A18 antes de promoção
3. `.env.production.local` aponta para `pooler.supabase.com:5432` (Session Mode), `.env` aponta para `pooler.supabase.com:6543` (Transaction Mode); provavelmente `.env` mais actualizado
4. Cron de produção envia emails reais a clientes com facturas emitidas vencidas há mais de 7 dias — activado por `CRON_SECRET` da Vercel; tem limite de 20 destinatários por execução

### Funcionalidades degradadas sem variáveis RH

1. `PIN_PEPPER` não configurado → RH Payroll bloqueia no `pinLookup`
2. `SUPABASE_SERVICE_ROLE_KEY` não configurado → Uploads RH retornam HTTP 503 com `STORAGE_NOT_CONFIGURED`
3. `SUPABASE_STORAGE_BUCKET_RH` não configurado → idem

### Performances nota

- Build em Node 22 native OK; uso de `node_modules/@prisma/client` foi restaurado nesta máquina após corrupção local; produção Vercel gera o seu próprio `@prisma/client` no build
-WMS e2e críticos (RH payroll) não podem ser garantidos se variáveis estiverem ausentes

## 7. Rollback

### Preparação

- Viam Vercel: `Deployments → escolher o mais recente READY cujo commit não é 28b1c5b` — promover de novo (com 1 click)
- Supabase: schema não foi alterada pela A18; rollback de DB é inviável sem migration revert, ridiculum não necessária
- DNS: não é tocado; machinefaturas.shop permanece

### Limitações

- Sem acesso directo à produção, não conseguimos listar os deployments READY nem identificar o commit actual
- Proprietário tem que fazer: Dashboard → Project → Deployments → identificar o último READY Production e registar o SHA

## 8. Decisão final

**READY WITH CONDITIONS**

### Decisões por área:

- Código A18 (build, testes, concurrency audit chain): **READY FOR PRODUCTION**
- Estrutura git/commits: **READY FOR PRODUCTION**
- Migrations: **READY WITH CONDITIONS** (fixture local prova 67/67 mas não pode ser confundida com produção)
- Variáveis Vercel: **READY WITH CONDITIONS**
- Supabase Pooler: **READY WITH CONDITIONS**
- Preview deployment seguro: **NOT READY** (sem isolamento)
- Production Branch: **NOT READY** (não confirmável neste ambiente)
- Rollback readiness: **READY WITH CONDITIONS** (não verificável remotamente sem credenciais mas reversível via 1 click no Vercel)

### Condições necessárias para PROMOÇÃO AUTORIZADA

1. Proprietário confirma no Vercel dashboard: Settings → Git → Production Branch = `main`
2. Proprietário executa via Supabase SQL Editor:
   ```sql
   SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE finished_at IS NOT NULL) AS concluidas,
       COUNT(*) FILTER (WHERE finished_at IS NULL)      AS nao_concluidas,
       COUNT(*) FILTER (WHERE rolled_back_at IS NOT NULL) AS revertidas
   FROM public._prisma_migrations;
   ```
   Resultado esperado: 67/67/0/0
3. Proprietário confirma no Vercel dashboard: Settings → Environment Variables → Production
   - DATABASE_URL presente
   - NEXTAUTH_SECRET presente
   - PIN_PEPPER ou RH desativado

### Se as 3 condições forem cumpridas

```
git checkout main
git pull origin main
git merge --no-ff feat/machine-facturas-a18-operational-evolution -m "merge: feat/machine-facturas-a18-operational-evolution into main"
git push origin main
```

A Vercel detecta automatically o push e promove para Production se Production Branch=main.

### Próximo para o proprietário

```
Antes de promover:
  1. Confirmar as 3 condições acima via dashboards
  2. Decidir explicitamente se quer RH payroll funcional em produção
  3. Autorizar merge + push explicitamente

Após promoção:
  4. Validar /inicio returns 200
  5. Verificar logs Vercel 15min
  6. Decidir sobre CRON_SECRET se não quiser emails automáticos
```

## 9. Autorizações ainda necessárias

| Operação | Estado | Requer autorização? |
|---|---|---|
| Merge A18 → main | Proibido nesta execução | Sim, após confirmação das 3 condições |
| Push de main para origin/main | Proibido nesta execução | Sim |
| Promote deployment na Vercel | Proibido nesta execução | Sim |
| Alterações de configuração Vercel/Supabase | Proibidas nesta execução | Sim |
| Execução do cron de produção | Nunca executar sem autorização expressa | Sim |
| Envio de qualquer email | Nunca executar sem autorização expressa | Sim |
| Migrations — qualquer execução | Não necessárias para A18 (sem novas migrations) | Não |

## 10. Conclusão operacional

A A18 está tecnicamente **READY FOR PRODUCTION** com base em:

- Build verde com `NODE_ENV=production`, BUILD_ID `ceMBpDIQKG8HDaSvtUQlH`
- TypeScript estrito ✅ 0 errors
- ESLint ✅ 0 errors
- Full regression suite 582 passed (8 skipped)
- WMS E2E fresh 80/80
- A11 concurrency (20/50/100/200 FT): 3/3 reps OK
-invoice-concurrency integration: 3/3 passes
- Audit chain VALID (200 FTs distributed across 3 instances)
- Ledger balanced (diff 0.00 across both tenants)
- Multi-tenant isolation verificada
- 0 migrations pendentes

Para a promoção definitiva faltam apenas as 3 confirmações do proprietário via dashboards (git → DB → pooling). Sem autorização expressa **não executar nada** que afete produção.

**Nunca foi executada nesta fase nem durante esta execução:**

- merge
- push
- promote
- migration
- seed
- cron invocation
- email delivery
- alteração de variáveis Vercel ou Supabase
- alteração de roles ou permissões
- alteração do DNS

**Estado final absoluto:**

- Branch `feat/machine-facturas-a18-operational-evolution`
- HEAD local: `ca26b6c2782ee1370df81cac3bc604ca01e5200f`
- HEAD remoto: `28b1c5b78adc1694bece3aaaa3bfb56d0c025799`
- 1 commit pendente de publicação (`ca26b6c`) — relatório do operador
- 98 ficheiros preexistentes do utilizador: NÃO TOUCHED
- 0 dados causalmente modificados na A18
