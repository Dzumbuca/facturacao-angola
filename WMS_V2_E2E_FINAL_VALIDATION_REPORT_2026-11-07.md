# WMS v2 — E2E Final Validation Report (2026-11-07) — BLOQUEADO (isolamento não comprovado para mutações)
Projeto: `C:\Users\Administrador\Desktop\facturacao-angola`  
Branch: `wms-v2-e2e-staging` (suja; alterações pré-existentes preservadas).  
Restrições cumpridas: sem Supabase/prod/Vercel; sem migrations/schema; sem escritas em DB sem prova de alvo descartável local; sem `git reset/clean/restore`; sem commits; sem auditoria RLS; sem mocks como substituto de E2E real.

## Estado final
**BLOQUEADO** para execução E2E com mutações. Build/TS/suite WMS permanecem aprovados no estado atual; validação funcional/visual E2E real e isolamento entre tenants por teste não foram executados porque o alvo de base de dados não foi comprovado como exclusivamente descartável para esta sessão.

## FASE 1 — Inspeção e isolamento (evidências observáveis, sem segredos)
| Item | Observado |
|---|---|
| Docker/Postgres local | Containers ativos: `erp-postgres` (postgres:17, `0.0.0.0:5433->5432`), `machine-wms-staging` (postgres:18, `127.0.0.1:5436->5432`), `machine-stock-test-pg` (postgres:17, `0.0.0.0:5437->5432`, up 43h), `mf_rls_baseline_lab_5440` (postgres:17, `0.0.0.0:5440->5432`). |
| Compose test | `docker-compose.test.yml` define serviço `postgres` `machine-stock-test-pg`, `POSTGRES_DB=machine_stock_test`, porta `5437:5432`, volume `machine_stock_test_data`. Compose principal `docker-compose.yml` define `erp-postgres`/5433. |
| Prisma | `prisma/schema.prisma` datasource PostgreSQL via `env("DATABASE_URL")`. 25 migrations em `prisma/migrations`. Sem `prisma/seed` inspecionado aqui. |
| Playwright | `playwright.config.ts`: `testDir: ./e2e`, `baseURL: http://localhost:3000`, chromium, `screenshot: only-on-failure`, **sem `webServer`**. Dev script: `next dev --webpack -p 3002` (porta difere do baseURL). |
| Env files | `.env`, `.env.local` existem; `.env.test` **não existe**. Conteúdo sensível **não lido/exposto** (apenas presença/nomes de variáveis mascarados quando verificado antes). |
| Uso prévio 5437 | Inspeções RLS read-only anteriores usaram DB `mf_rls_staging` no mesmo container 5437 (evidência de sessões anteriores). `machine_stock_test` é a DB do compose; **não confirmado** se está limpa/descartável para este WMS E2E sem risco a dados existentes. |

### Prova de isolamento
**Não comprovada para mutações.** Motivos:
- `DATABASE_URL`/alvo efetivo dos testes não pode ser inferido com segurança sem expor/assumir env; `.env.local`/`.env` podem apontar para alvo não descartável.
- `machine-stock-test-pg:5437` é local Docker, mas hospeda pelo menos histórico de uso (`mf_rls_staging`) e volume persistente; criar/migrar/semear/escrever na DB errada afetaria dados de teste/staging locais existentes.
- `machine-wms-staging`/5436 tem nome de staging e volume persistente — **não tratável como descartável** sem confirmação explícita.
- 5433/5440 também não comprovados como descartáveis para esta execução.

## FASE 2–5 — E2E/visual/integração (não executadas)
Não executadas por bloqueio de isolamento. Não foram criadas mutações, migrations, seeds, nem testes E2E que dependam de escrita em DB real.

| Item | Resultado | Razão |
|---|---|---|
| Playwright auth/fixtures WMS | Não implementado em runtime mutante | Depende de DB/seed isolado comprovado. |
| Páginas `/stock*` (10 rotas) | Não validadas em browser real | Sem servidor/DB de teste isolado autorizado. |
| Fluxo A compras/recepções (criar?parcial?PARCIAL?restante?RECEIVED?saldos/movimentos) | Não executado | Requer escritas; alvo não comprovado. |
| Fluxo B reservas (criar/libertar/efeitos/consumo) | Não executado | Requer escritas. |
| Fluxo C ajustes (aumento/redução/saldos/validações) | Não executado | Requer escritas. |
| Fluxo D lotes (criar/consultar/validade; sem campos não persistidos) | Não executado | Requer escritas. |
| Fluxo E devoluções (registar/efeito suportado; limitação GET documentada) | Não executado | Requer escritas. |
| Desktop+mobile screenshots | Não geradas | Sem execução browser segura. |
| `GET /api/stock/products`, `GET /api/stock/suppliers` em runtime | Não verificados com auth real | Sem ambiente de teste autenticado isolado. |
| Isolamento 2 tenants (teste) | **Não demonstrado** | Exige duas identidades/tenants em DB isolada + asserções HTTP/UI; não executado. |

## FASE 6 — ESLint
| Item | Resultado |
|---|---|
| Sintoma | `npx eslint ...` ? `ERR_MODULE_NOT_FOUND: Cannot find package 'eslint' imported from eslint.config.mjs`; bin local não encontrado no passo rápido. |
| Causa provável (diagnóstico) | Execução via `npx`/resolução de módulos não encontra `eslint` no contexto esperado do projeto (dependência local ausente/incompatível no ambiente atual, ou `npx` resolvendo pacote isolado sem deps do config). `eslint.config.mjs` importa `eslint`/config packages; requer instalação local consistente. |
| Correção mínima recomendada | 1) No diretório do projeto, verificar dependências: `npm ls eslint` / `pnpm ls eslint` conforme lockfile em uso (repo tem lockfiles múltiplos; **não alterar dependências sem confirmar gerenciador**). 2) Se faltar, instalar versão compatível com `eslint.config.mjs` usando o gerenciador do projeto (`npm ci`/`npm install`/`pnpm install` conforme política). 3) Rodar ESLint local: `npx --no-install eslint 'src/app/(dashboard)/stock/**/*.{ts,tsx}' 'src/app/api/stock/products/route.ts' 'src/app/api/stock/suppliers/route.ts' 'src/app/api/stock/balances/route.ts'`. 4) Se config usa flat config ESM, garantir Node/ESLint compatíveis já presentes. |
| Ação tomada | **Nenhuma** alteração de dependências/config (risco a tree preexistente/lockfiles). Bloqueio documentado. |

## FASE 7 — Pendências funcionais (análise, sem implementação)
### 1. Ausência de GET/listagem dedicada de devoluções
- **Impacto:** UI atual só regista devolução física (`POST /api/stock/returns`); utilizadores não consultam histórico dedicado de devoluções.
- **Solução recomendada:** adicionar `GET /api/stock/returns` tenant-scoped (paginação/filtros por produto/armazém/data/referência/creditNoteId se modelo suportar) + UI de listagem em `/stock/devolucoes`; incluir movimentos/estado quando aplicável. Requer verificar schema/modelo existente para devoluções/movimentos (sem migration).
- **Testes necessários:** Vitest rota GET (auth 401, tenant isolation, filtros, shape); E2E: registar devolução ? listar ? conferir impacto em movimentos/saldos.

### 2. `restoreStockForCancelledInvoice` não integrado
- **Impacto:** cancelamento/anulação de fatura pode não repor stock automaticamente; risco de divergência operacional/fiscal de inventário.
- **Solução recomendada:** localizar fluxo autorizado de cancelamento/anulação de fatura; invocar restauração em transação idempotente com regras fiscais/estado do documento, warehouse/lotes corretos, e auditoria; respeitar idempotency keys/movimentos. **Alto risco de negócio** — requer decisão funcional.
- **Testes necessários:** unit/integration para idempotência, tenant, estado inválido, documento já anulado, lote/warehouse; E2E controlado com fatura+stock+cancelamento em DB descartável.

### 3. Limite de 200 movimentos em consultas
- **Impacto:** histórico truncado; utilizadores podem não ver movimentos antigos; análises incompletas.
- **Solução recomendada:** paginação server-side/cursor em `GET /api/stock/movements` + UI (página/tamanho/data range) ou carregamento incremental; manter filtros e performance (índices existentes). Default seguro com total/count opcional.
- **Testes necessários:** API paginação/ordem/filtros/tenant; UI estados carregamento/vazio/mais resultados; performance básica em dataset maior.

## Plano concreto para ambiente descartável (somente após autorização explícita)
1. **Confirmar alvo descartável local:** criar DB dedicada e explicitamente descartável no container local de teste, ex. `wms_e2e_disposable_YYYYMMDD` em `127.0.0.1:5437` (container `machine-stock-test-pg`, compose `docker-compose.test.yml`). **Não usar** `mf_rls_staging`, `machine_wms_staging`/5436, nem qualquer DB de nome ambíguo. Obter autorização explícita para criar/usar essa DB.
2. **Isolamento de config:** usar `.env.e2e.local` (gitignored) ou variáveis de processo apenas para E2E apontando `DATABASE_URL` à DB descartável; não alterar `.env`/`.env.local` de produção/dev; não expor credenciais.
3. **Preparação controlada:** `docker compose -f docker-compose.test.yml up -d postgres` (já ativo) ? criar DB descartável ? aplicar schema/migrations **somente nessa DB** (`prisma migrate deploy` ou `db push` conforme estratégia aprovada) ? seed sintético mínimo (2 tenants, 2 users, warehouses, produtos, fornecedores). Registrar comandos executados.
4. **Playwright:** ajustar config E2E isolada (ou env) com `webServer` apontando a app em porta dedicada (`3002` ou outra livre) e `DATABASE_URL` da DB descartável; `baseURL` alinhado; storageState/auth helper para 2 tenants.
5. **Dados sintéticos:** prefixos `E2E-WMS-*`; cleanup por truncation/recriação da DB descartável ao final.
6. **Execução:** Vitest relevante + Playwright desktop/mobile + capturas em `docs/evidence/wms-e2e-2026-11-07/` (sem segredos). Validar isolamento com asserções cross-tenant 403/404/vazio conforme contrato.

## Evidências e screenshots
Nenhuma captura gerada (E2E não executado). Diretório de evidências não criado para evitar artefatos vazios enganosos.

## Correcções efetuadas nesta etapa
- Criado este relatório de bloqueio/diagnóstico/plano: `WMS_V2_E2E_FINAL_VALIDATION_REPORT_2026-11-07.md`.
- Nenhuma correção de código/dependências/DB executada.

## Resumo objetivo
- **Ambiente:** inspecionado; local Docker Postgres disponível (5433/5436/5437/5440), mas **nenhum alvo comprovado como exclusivamente descartável** para mutações E2E nesta sessão.
- **Não executado (bloqueado):** migrations/seeds/writes, Playwright E2E funcional/visual, screenshots, prova de isolamento 2 tenants, ESLint focado (tooling bloqueado).
- **Aprovado anteriormente (não revalidado além do reportado):** build Next, `tsc --noEmit` 0 erros, WMS/API Vitest 55/55.
- **Riscos remanescentes:** fluxos críticos sem E2E real; isolamento multi-tenant não demonstrado por teste; ESLint WMS não executado; devoluções sem GET; cancelamento fatura sem restauração stock integrada; consultas limitadas a 200 movimentos.
- **Próximo passo seguro:** autorização explícita para criar/usar DB descartável local nomeada (ex. `wms_e2e_disposable_YYYYMMDD` em 5437), seguida do plano acima.
