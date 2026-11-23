# MACHINE FACTURAS — A18 — Final Publication Status

**Branch:** `feat/machine-facturas-a18-operational-evolution`  
**HEAD local:** `ec196e92ba4e63ef81c8cb3f6c97a0b724c524ab`  
**HEAD remoto:** `28b1c5b78adc1694bece3aaaa3bfb56d0c025799`  
**main:** `15bb189d316f23b630cc4cf23703077a0da07a1d`  
**Production:** `https://machinefaturas.shop`  
**Plataforma:** Vercel  
**Database:** Supabase PostgreSQL  
**Data:** 2026-11-19  

---

## 1. Identificação Git

```
Branch:                 feat/machine-facturas-a18-operational-evolution
HEAD local:             ec196e92ba4e63ef81c8cb3f6c97a0b724c524ab
HEAD remoto:            28b1c5b78adc1694bece3aaaa3bfb56d0c025799
main:                   15bb189d316f23b630cc4cf23703077a0da07a1d
Branch local vs remote: local ahead of remote by 2 commits
Ca26b6c: presente em ambos (commit local de doc mais recente)
Commits A18 publicados no remote: 28b1c5b, 4eedd1d, 2dbab99, ec03478, 184ceac, 1f8a9b0
Commits A18 locais NÃO publicados: ca26b6c (docs final operational decision), ec196e9 (publication readiness)
Worktree: /c/Users/Administrador/Desktop/facturacao-angola
Tracking branch: origin/feat/machine-facturas-a18-operational-evolution
```

Ca e 98 ficheiros preexistentes do utilizador — todos intocados.

Os dois relatórios locais mais recentes (`ca26b6c` e `ec196e9`) são apenas documentação operacional. Nenhum deles altera código funcional.

## 2. Correcções efectuadas durante esta revisão

N/A — relatório novo, não altera código nem configuração.

Os relatórios anteriores (`MACHINE-FACTURAS-A18-OPERATIONAL-FINAL-DECISION.md` e `MACHINE-FACTURAS-A18-PUBLICATION-READINESS-FINAL.md`) preservados sem alteração, pois o utilizador solicitou "preservar o histórico".

## 3. Estado real das migrations

**Fixture local (base descartável a18_check / a17_http_final):**

```
_prisma_migrations (fixture local — propriedade nossa, não produtiva):
  total: 67
  finished: 67
  rolled_back: 0
```

**Produção:** **NÃO VERIFICADA**. Não foi possível efectuar consulta SELECT directa à base de produção (auth failure psql com credenciais localmente disponíveis — presumivelmente expiradas).

**A18 não introduziu nenhuma migration** — confirmado pela ordem temporal dos directórios `prisma/migrations/`: ultimo é `20261129000000_a14_emission_lease_sync`.

**Migrations diff expected vs HEAD:** A18 introduz ZERO nova migration. Não é necessário executar `prisma migrate deploy` antes de promover.

## 4. Estado das configurações externas

| Item | Confirmação Local | Confirmação Prod | Drift? |
|---|---|---|---|
| `.env` | `aws-0-eu-west-1.pooler.supabase.com:6543` + `pgbouncer=true` + `connection_limit=1` | NÃO VERIFICADO | Incapaz confirmar |
| `.env.production.local` | `:5432` session mode | NÃO VERIFICADO | Drift local — pequeno |
| `.env.staging` | `localhost:5432` | N/A | Local dev |
| `.env.example` | placeholder | N/A | Template |
| `.env.vercel.production` | `[SENSITIVE]` mascaradas | NÃO VERIFICÁVEL | n/a local |
| `vercel.json` | cron `0 8 * * *` em `/api/cron/reminders` | Confirmar via dashboard | idem |

**Precisão sobre produção:**
- `HTTPS machinefaturas.shop` retorna conteúdo A1-A17 já deployado. Sem qualquer confirmação visual de que execução specific commit (we só sabemos que /inicio returns HTTP 200).
- HTTP probe `https://machinefaturas.shop/api/cron/reminders` → **HTTP 401 sem token** → CRON_SECRET protection está funcional em produção.

**Precisão sobre Vercel CLI neste ambiente:**
- `vercel env ls` → `EPERM` ao tentar criar `~/.vercel/cli/Data/auth.json`. Bloqueado por Windows POSIX permissions.
- `vercel ls` → `Retrieving project…` não retorna saída útil.
- Não tenho acesso de leitura autorizado para configuracões Vercel neste trabalho.

## 5. Riscos residuais

### Bloqueios

- `_prisma_migrations` em produção: não-verificável sem contribuição do proprietário
- Production Branch: configuração no Vercel não confirmável
- Preview isolado: não existe
- Rollback: não confirmável sem Vercel dashboard

### Não-críticos

- `pool_timeout` em `.env` local não configurado — porém soteria é apenas cosmético
- 2 commits locais não-publicados (apenas documentos novos desta review)

### Funcionalidades degradadas

- RH Payroll não activo se `PIN_PEPPER` ausente
- RH uploads retornam 503 se `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET_RH` ausentes

### Questões do proprietário exclusivo

1. PIN_PEPPER definido? 
2. SUPABASE_SERVICE_ROLE_KEY definido?
3. SUPABASE_STORAGE_BUCKET_RH definido?
4. DATABASE_URL usa Transaction Pooler (6543 + pgbouncer=true) ou Session Pooler (5432)?
5. Production Branch = `main`?
6. Rollback ready no Vercel (deployment anterior READY)?

## 6. Procedimento de confirmação manual do proprietário

**Vercel Dashboard — passo a passo:**

```
Visit: vercel.com/cars/... project Settings

  Git → Production Branch
   Esperado: "main"
   Se diferente, registar valor

  Environment Variables → Production filter
   Confirmar presença (PRESENTE ou AUSENTE):

   PRESENTE       AUSENTE
   ────────────  ──────────
   DATABASE_URL  PIN_PEPPER (se RH off)
   NEXTAUTH_SECRET
   AUTH_TRUST_HOST=true
   APP_URL       SUPABASE_SERVICE_ROLE_KEY (se RH off)
   CRON_SECRET   SUPABASE_STORAGE_BUCKET_RH (se RH off)
   SMTP_*       PIN_PEPPER (se RH off)
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

 Deployments → Identificar:
   - Deployment actual publicado (Production verde)
   - Deployment mais recente READY imediatamente anterior
   - SHAs / branchies associados
```

**Supabase Dashboard — passo a passo:**

```
Visit: https://supabase.com/dashboard/project/<seu-projecto>/sql

   SQL Editor新建 query:

   SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE finished_at IS NOT NULL) AS concluidas,
       COUNT(*) FILTER (WHERE finished_at IS NULL)      AS nao_concluidas,
       COUNT(*) FILTER (WHERE rolled_back_at IS NOT NULL) AS revertidas
   FROM public._prisma_migrations;

   Resultado esperado:
     total | concluidas | nao_concluidas | revertidas
       67 |          67 |             0 |          0

Visit: supabase.com/dashboard/project/<seu-projecto>/settings/database

   Connection Pooling:
     - Mode: Transaction (6543) ou Session (5432)
     - pgbouncer=true configurado?
```

## 7. Plano de publicação

**Não prossiga sem autorização expressa do proprietário**.

Passos (depois de autorização):

```bash
git checkout main
git pull origin main
git merge --no-ff feat/machine-facturas-a18-operational-evolution \
  -m "merge: feat/machine-facturas-a18-operational-evolution into main"
git push origin main
```

A Vercel detecta push e (conforme Production Branch config) promove ou cria Preview.

## 8. Plano de rollback

**Vercel dashboard → Project → Deployments:**

```
1. Identificar o deployment MAIS RECENTE já promovido Production
2. Promote (1 clique) esse deployment anterior
3. Verificar /inicio returns HTTP 200 em ~30 segundos

Custo: zero perda de dados; zero migration; nada a reverter no Supabase
```

**Não apagar deployments anteriores**; **não alterar DNS**; **não fazer rollback de migrations** (nenhuma migration pendente).

## 9. Decisão final

| Verificação | Estado |
|---|---|
| Código A18 | **READY FOR PRODUCTION** |
| Build local | **READY** (`ceMBpDIQKG8HDaSvtUQlH`, NODE_ENV=production) |
| Testes | **READY** (582 passed / 8 skipped; WMS E2E 80/80 fresh) |
| Audit chain | **READY** (VALID) |
| Ledger balanced | **READY** (diff 0.00) |
| Multi-tenant isolation | **READY** (verificado) |
| Migrations Production | **NÃO VERIFICADO** |
| Production Branch | **NÃO VERIFICADO** |
| Variáveis RH | **NÃO VERIFICADO** |
| Preview isolado | **NOT READY** (não existe) |
| Rollback identificado | **NÃO VERIFICADO** |
| Pooler Production | **NÃO VERIFICADO** |

**Decisão global:** **READY WITH CONDITIONS**

Condições:

1. Proprietário confirma Production Branch = main (ou outra branch válida, e o push visa essa branch)
2. Proprietário confirma `_prisma_migrations` em produção: 67/67/0/0
3. Proprietário confirma 
`DATABASE_URL` em produção está em Transaction Pooler (ideal) ou Session Pooler válido
4. Proprietário confirma `PIN_PEPPER` se RH payroll é desejado, OU confirma RH off explicitamente no tenant de produção

Sem estas 4, a promoção é inaceitável.

Com estas 4 confirmadas, o plano em §7-§8 passa de pendência-preventiva para ordem-de-execução.

---

**Nenhum destes itens requere nova fase A19. Nenhuma nova migration necessária. Nenhuma alteração de código. A decisão é puramente de infraestrutura e operação.**

## 10. Resumo dos artefactos publicáveis

```
A18 branch pushes (remote):   1f8a9b0, 184ceac, 2dbab99, ec03478, 28b1c5b
A18 branch local:             ca26b6c, ec196e9, **este ficheiro ec196ex** (ou seja este será um novo commit que NÃO foi enxertado ao remote)
Main:                         15bb189 (sem alterações de código desde a1-A18-baseline)

Commits a publicar no remote:
  (atualmente 28.1c.5b está ahead ok sobre 15bb189? Sim, A18 existia em 15bb189-origin que é o mesmo
   que o merge-base; A18 não foi puxado para main ainda)
```

## 11. Commit history expectation

```
main          15bb189 (atual)
     │
     └── A18 will branch off after merge:  <merge-commit>
              ├── 1f8a9b0 feat(A18): outstanding balances
              ├── 184ceac feat(A18): payables report
              ├── 2dbab99 fix(A18): in-process capacity gate
              ├── ec03478 docs(A18): A18 final report
              ├── 28b1c5b docs(A18): A18 final report — COMPLETE after localGates fix
              ├── ca26b6c docs(A18): final operational publication decision
              └── (este document doc-status)
```

## 12. Conclusão sobre o que esta execução alterou

```
Arquivos adicionados (não empurrados):
  ✓ MACHINE-FACTURAS-A18-OPERATIONAL-FINAL-DECISION.md      (commit ca26b6c)
  ✓ MACHINE-FACTURAS-A18-PUBLICATION-READINESS-FINAL.md      (commit ec196e9)
  ✓ MACHINE-FACTURAS-A18-FINAL-PUBLICATION-STATUS.md         (este ficheiro)
```

Nenhum dos três artefactos altera o código operacional. Todos são apenas documentação de auditoria.

## 13. Items fora-deste-relatório

- Production must satisfy 4 conditions
- No further commits needed for engineering completeness
- 
- None of `.env*` are committed (checked: git ls-tree -r HEAD .env* → nenhum resultado)
