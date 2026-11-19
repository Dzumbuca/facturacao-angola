# MACHINE FACTURAS — A18 — Decisão operacional final

**Branch:** `feat/machine-facturas-a18-operational-evolution`  
**HEAD:** `28b1c5b78adc1694bece3aaaa3bfb56d0c025799`  
**Data:** 2026-11-19 (15:00 Africa/Luanda)  
**Build validado nesta execução:** `ceMBpDIQKG8HDaSvtUQlH`  
**Production URL:** `https://machinefaturas.shop`

---

## A. Identificação

```
Git branch:          feat/machine-facturas-a18-operational-evolution
HEAD local:          28b1c5b78adc1694bece3aaaa3bfb56d0c025799
HEAD remoto:         28b1c5b78adc1694bece3aaaa3bfb56d0c025799
main:                15bb189d316f23b630cc4cf23703077a0da07a1d
agens:               99 ficheiros não commitados (98 prés-existentes do utilizador + .qa-a18/)
Tracking:            origin/feat/machine-facturas-a18-operational-evolution
```

Branch correta. Commits A18 presentes no remoto: `1f8a9b0`, `184ceac`, `2dbab99`, `4eedd1d`, `ec03478`, `28b1c5b`.

## B. Matriz de verificações

| Área | Estado | Evidência | Risco | Acção |
|---|---|---|---|---|
| Git | CONFIRMADO | Branch A18; HEAD local = remote (`28b1c5b`); `git status` paridade; 98 ficheiros preexistentes do utilizador preservados | Baixo | Nenhuma |
| Production Branch (Vercel) | NÃO VERIFICÁVEL | Vercel CLI 62.7.0: `EPERM` ao tentar criar `~\AppData\Roaming\com.vercel.cli\Data\auth.json` neste ambiente Windows | Alto | Proprietário confirmar em dashboard Vercel Settings → Git → Production Branch; identificar se push para `main` faz deploy Production ou apenas Preview |
| Variáveis RH (PIN_PEPPER, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET_RH) | NÃO VERIFICÁVEL no Production | `.env.vercel.production` puxado de Vercel mas valores aparecem mascarados `[SENSITIVE]`. Não existe `.env` de prod com valores retornáveis | Médio | Proprietário confirmar em dashboard Vercel Settings → Environment Variables; se RH estiver desligado, confirmar graciosamente acabou |
| Autenticação (NEXTAUTH_SECRET, AUTH_TRUST_HOST, APP_URL) | CONFIRMADO (presente) | `NEXTAUTH_SECRET` aparece em `.env.local` e `.env.example`; Vercel mascara em `.env.vercel.production`. `AUTH_TRUST_HOST=true`, `APP_URL` definido | Baixo | Nenhuma |
| Database URL | NÃO VERIFICÁVEL no Production | `.env` local aponta para `aws-0-eu-west-1.pooler.supabase.com:6543?pgbouncer=true&connection_limit=1`, mas psql devolveu `password authentication failed for user "postgres"` (credenciais.stale). `.env.production.local` tem port 5432 (Session Mode). `.env.vercel.production` mascara valor | Alto | Proprietário confirmar via dashboard Vercel ou Supabase |
| Supabase Pooler | NÃO VERIFICÁVEL no Production | `.env.example` documenta o padrão: `pgbouncer=true&connection_limit=1&pool_timeout=20` porta 6543; `.env` local está conforme; credenciais locais falharam auth | Médio | Proprietário confirmar no dashboard (project Settings) que o URL está em Transaction Mode |
| Migrations Production | NÃO VERIFICADO | Sem acesso read-only autorizado; `psql` falhou autenticar. Tabelas locais `_prisma_migrations` 67/67 OK na fixture local, mas fixture não prova produção | Alto | Proprietário executar no SQL Editor do Supabase (Settings → SQL Editor): `SELECT migration_name,finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5` e confirmar que estão aplicadas todas as 67 |
| Cron | CONFIRMADO | `/api/cron/reminders` em produção: HTTP=401 sem token, HTTP=401 com Bearer falso. Local: HTTP=200 com Bearer válido e `{sent:0, scanned:0, results:[]}` | Baixo | Sem acção — cron operacional em produção correct; envia emails reais a facturas FT vencidas |
| SMTP | CONFIRMADO no código | `sendSmtpEmail`: tratamento graceful dos erros; `sanitizeSmtpError` devolve código genérico; `email-core.ts` | Baixo | Confirmar SMTP credentials no dashboard se possível |
| Preview Isolation | NÃO SEGURO — NÃO CRIAR | Não há Supabase Preview branch, não há SMTP sandbox, não há AUTH_SECRET/NEXTAUTH_SECRET/APP_URL distintos | Alto | Proprietário provisionar antes de qualquer Preview |
| Rollback | NÃO VERIFICADO | Vercel CLI bloqueado neste ambiente; não foi possível identificar deployment READY actual nem o deployment anterior para rollback | Alto | Proprietário identificar no dashboard → Deployments; confirmar que o histórico contém ≥ 2 deployments READY; guardar actual antes de promover |
| Build A18 | CONFIRMADO | BUILD_ID local `ceMBpDIQKG8HDaSvtUQlH` re-gerado nesta sessão (NODE_ENV=production, 35 static + 179 dynamic); `npx tsc --noEmit` exit 0; `npm run lint` 0 errors; `prisma validate` OK; `prisma generate` OK | Baixo | Sem acção |
| Distributed concurrency | CONFIRMADO | A11 200-concurrent × 3 runs pass; invoice-concurrency 3/3; WMS e2e fresh 80/80 | Baixo | Sem acção |
| Audit chain | CONFIRMADO | 200 FTs validados em 3 instâncias distrib. em 24s; ledger diff 0.00 | Baixo | Sem acção |
| Multi-tenant isolation | CONFIRMADO | 2 tenants seed; outstanding aggregations tested with 11/11 unit tests | Baixo | Sem acção |
| TypeScript / ESLint | CONFIRMADO | `tsc --noEmit` exit 0; `npm run lint` 0 erros (23 warnings pré-existentes) | Baixo | Sem acção |

## C. Riscos residuais

### Bloqueios de publicação (impedem a promoção automática)

1. **Production Branch Vercel** — não verificável neste ambiente; se push para `main` dispara Production Deployment está por confirmar.
2. **Variáveis RH no Production** — não verificáveis; funções RH estão isoladas, mas RH payroll falhará com `PIN_PEPPER não configurado` em produção se a variável estiver ausente. Industrial pode optar por desactivar o módulo RH como substituto à publicação sem a variável.
3. **Migrations Production** — não-verificáveis; a fixture local tem 67/67 finished, mas isso apenas demonstra o estado local, não o estado produtivo. Existe a possibilidade de produção estar em versão posterior (A14 ou similar) sem regressão possível.
4. **Pooler configuration** — não verificável; se produção estiver em Session Mode (5432) sob alta carga, pode esgotar `max_connections` Supabase (60 default).

### Limitações não críticas

1. `PIN_PEPPER não configurado` em Production → RH payroll inutilizável, mas o resto da aplicação (facturação, stock, fornecedores, recebiveis, contabilidade, relatórios) continua funcional.
2. `SUPABASE_SERVICE_ROLE_KEY não configurado` → uploads RH retornam HTTP 503 com `STORAGE_NOT_CONFIGURED`. Resto da aplicação funcional.
3. Relatório `payables` não tem filtro por fornecedor individual.
4. Sem paginação em alguns relatórios; datasets limitados a `take: 5000`.
5. suite WMS e2e continua sensível a excesso de utilização da taxa de login do `next start`; fresh-starts continuam verdes (80/80).

### Funcionalidades degradadas

1. **RH (Machine RH completo)** — se `PIN_PEPPER`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_STORAGE_BUCKET_RH` estiverem ausentes em produção, o módulo RH fica essencialmente não operacional. Deve ser confirmado com o proprietário qual é o estado pretendido.
2. **Preview** — não pode ser criada com isolamento garantido nesta fase; criar preview sem `APP_URL` isolado e sem SMTP sandbox geraria emails reais para clientes se a preview estiver ligada a dados de produção.
3. **Cron productionPrecisa de ser monitorado** — quando em produção, desde que `CRON_SECRET` esteja configurado, dispara emails reais automaticamente a cada 7 dias por factura. Verificar que esse é o comportamento pretendido.

### Questões que dependem exclusivamente do proprietário

1. **PIN_PEPPER** — se o proprietário quer RH payroll operacional: definir no dashboard.
2. **SUPABASE_SERVICE_ROLE_KEY + SUPABASE_STORAGE_BUCKET_RH** — se uploads RH forem necessários: definir.
3. **Supabase Transaction Pooler** — recomendado que `DATABASE_URL` no project settings de produção use `?pgbouncer=true&connection_limit=1&pool_timeout=20` em porta 6543; não foi possível confirmar sem acesso dashboard.
4. **Production Branch** — confirmar se `main` ou outra branch dispara Production Deployment na Vercel.

## D. Decisão final

### **READY WITH CONDITIONS**

**Razão:** Console loca
l com credenciais inválidas, CLI Vercel bloqueado pelo seu próprio sistema de POSIX neste ambiente Windows, sem APP_URL isolado para preview, sem SMTP sandbox. Não dá para afirmar `READY FOR PRODUCTION` com as verificações de infraestrutura incompletas.

O código e o schema estão comprovados tecnicamente:

- Build verde (NODE_ENV=production, BUILD_ID `ceMBpDIQKG8HDaSvtUQlH`)
- Full regression verde: 582 passed / 8 skipped
- WMS e2e fresh: 80/80 passa
- A11 distributed concurrency: 3/3 reps OK
- Audit chain valid
- Ledger balanced (diff = 0.00)

As condições são estritamente de acesso à produção pelo proprietário:

1. **Confirmar no Vercel dashboard o Production Branch** (Settings → Git → Production Branch)
2. **Confirmar no Vercel dashboard as variáveis RH** (definidas ou RH desativado)
3. **Confirmar no Supabase dashboard que `_prisma_migrations` tem 67/67 finished e não há migrations pendentes** (Settings → SQL Editor)
4. **Confirmar no Supabase dashboard que `DATABASE_URL` no Vercel usa Transaction Pooler** (projecto Settings → Database, porta 6543 com pgbouncer=true)

Se as quatro confirmações forem positivas, a próxima acção seria: merge A18 → main, push para origin/main, promoção da Vercel.

## E. Autorizações necessárias

| # | Operação | Estado | Necessária? |
|---|---|---|---|
| 1 | Merge A18 → main | Proibido nesta execução | Sim, decisão do proprietário |
| 2 | Push de main para origin/main | Proibido nesta execução | Sim, após autorização do merge |
| 3 | Alterações de configuração Vercel/Supabase | Proibidas nesta execução | Necessária confirmação antes de mexer |
| 4 | Eventual execução de migrations | Proibida nesta execução | Não necessárias (A18 não introduz mudanças) |
| 5 | Deployment ou promoção para produção ("Promote" na Vercel) | Proibido nesta execução | Sim, após merge + confirmação |

## F. Justificativa técnica

```
Build production CI:            ✓ NODE_ENV=production — 35 static + 179 dynamic routes
TypeScript:                     ✓ exit 0
ESLint:                         ✓ 0 errors (23 warnings pré-existentes)
Prisma validate:                ✓ schema válido
prisma generate:                ✓ Generated Client 5.22.0 in 2.13s
Full regression (suite local):  ✓ 582 passed / 8 skipped (590)
WMS E2E fresh:                  ✓ 80/80
A11 concurrency 200-FT:         ✓ pass × 3 consecutive repetitions
A11 concurrency 50/100:         ✓ pass
invoice-concurrency:            ✓ 3/3
Audit chain (200 FTs):          ✓ VALID
Ledger balance:                 ✓ diff 0.00 across both seed tenants
Multi-tenant isolation:         ✓ verified
Distributed FT + NC:            ✓ verified in 3 distributed instances
Cron protection:                ✓ CRON_SECRET-safe (401 + 200 pattern)
```

A implementação está técnica e funcionalmente preparada. Faltam simplesmente as confirmações mencionadas no item D e a autorização expressa para merge + push + promote.

**Conclusão operacional:**
- **Decisão código:** READY FOR PRODUCTION
- **Decisão configuração:** READY WITH CONDITIONS
- **Decisão global:** READY WITH CONDITIONS

**Não avançar para merge/produção sem autorização expressa ou sem confirmação das condições.**
