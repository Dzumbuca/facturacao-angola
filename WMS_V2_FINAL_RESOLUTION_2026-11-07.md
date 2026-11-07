# WMS v2 — Resolução Final (2026-11-07)

Branch: `wms-v2-e2e-staging` · Base de dados de teste: `wms_e2e_disposable` em `127.0.0.1:5441` (descartável).

## 1. Bugs corrigidos nesta sessão

| # | Área | Bug | Correção |
|---|---|---|---|
| 1 | `GET /api/stock/movements` | Devolvia array fixo com `take: 100`, sem paginação nem filtros | Resposta paginada `{items,total,page,limit,totalPages}`, limite máx. 200, filtros `type/productId/warehouseId/from/to`; UI `stock-history`, `consultas` e `warehouse-management` adaptadas |
| 2 | `GET /api/stock/returns` | Inexistente — não havia listagem de devoluções | Endpoint paginado filtrando movimentos com `idempotencyKey` prefixo `return-` (discriminador estável de `registerPhysicalReturn`), filtros `productId/warehouseId/reference/from/to`; listagem + paginação na UI `/stock/devolucoes` |
| 3 | `POST /api/stock/purchase/orders` | 500 — `tenantId` inválido no nested create de itens | `product: { connect: { tenantId_id } }` + validação de produtos do tenant (404) |
| 4 | `POST /api/stock/purchase/receptions` | 500 — nested create de itens com escalares inexistentes | `product`/`purchaseOrderItem`/`lot` via `connect` |
| 5 | `POST /api/stock/transfers` | 500 — nested create com `tenantId` solto; sem validação de produtos | `product`/`lot` via `connect` + validação de produtos do tenant (404) |
| 6 | `PATCH /api/stock/transfers/[id]` (RECEIVE) | 500 — nested create de itens de receção inválido | `product`/`transferItem`/`lot` via `connect` |
| 7 | `POST /api/stock/adjustments` | 500 — modelo real usa `systemQty/countedQty/difference/stockId` e `status CLOSED`, rota usava `quantity/type/adjustmentNumber/COMPLETED` | Reescrita: contagem física real (system/counted/difference), PWS bootstrap seguro, movimento `ADJUSTMENT`, resposta com itens; `GET` também corrigido (relação `createdBy` inexistente) |
| 8 | `GET /api/stock/lots` | 500 — `orderBy createdAt` (campo inexistente; é `receivedAt`) | Corrigido |
| 9 | `/stock` (UI) | Crash React “Event handlers cannot be passed to Client Component props” — `onSuccess={() => {}}` passado de Server Component | `TransferForm.onSuccess` opcional com `?.()`; prop removida da página |
| 10 | Textos UI stock | Mojibake U+FFFD (`Ajustes de invent�rio`, `Armaz�m`, `Devolu��es`, etc.) em 9 ficheiros | Corrigidos (45 palavras mapeadas) |
| 11 | Migrations | `20261105233000_auth_jwt_revocation_phase1` começava com BOM UTF-8 → PostgreSQL `syntax error at "\uFEFF"` | BOM removido |
| 12 | Migrations | `20261027180000_public_api_security` exige roles Supabase `anon/authenticated/service_role`; JWT exige `mf_app_nobypass` | Roles NOLOGIN documentadas no plano E2E (criadas na BD descartável) |
| 13 | Prisma client | Cliente gerado desalinhado do schema (drift) causava validação de `tenantId` | `prisma generate` executado; build atualizado |
| 14 | Seed E2E | Falhava ao reexecutar por FKs de reservas/ajustes → stock inconsistente | Limpeza de dependências antes do reset; seed idempotente |
| 15 | Testes unitários | `invoice-draft-offline-sync` quebrado por `prisma.$transaction` ausente no mock; `server-only` fora do Next | Alias `server-only` no vitest; mock com `$transaction/$executeRaw` |
| 16 | Lint | ESLint não instalado; `typescript-eslint` incompatível com TS 7 (nativo) | Toolchain isolado em `tools/lint` com TypeScript 6 (parser 8.72.1), Next plugin e react-hooks; 0 erros |
| 17 | Lint | Erros reais: `<a>` em páginas admin; `useActionState` condicional em `plan-payment-review.tsx` | `next/link`; hook chamado incondicionalmente |

## 2. Pendência de negócio documentada

`restoreStockForCancelledInvoice` foi mantido **não integrado à emissão de Nota de Crédito** — decisão de negócio já escrita no código (`invoice-service.ts`): NC é operação fiscal/financeira; a reposição de stock ocorre apenas na **devolução física** aceite no armazém (`POST /api/stock/returns` com `creditNoteId`, que liga a devolução à NC via idempotency key `return-nc-*`). O import morto foi removido.

## 3. Evidência de validação (ambiente descartável)

| Suite | Resultado |
|---|---|
| `npm test` (Vitest unitário) | **60 ficheiros / 308 testes — 100%** |
| `npx tsc --noEmit` | **0 erros** |
| `npm run lint` | **0 erros** (43 avisos não bloqueantes) |
| `npm run build` | **Compilado com sucesso** (Next 16.4.2) |
| `npm run test:e2e` (HTTP real: NextAuth + Prisma + APIs) | **6 ficheiros / 25 testes — 100%** |
| `npm run test:e2e:ui` (Playwright, desktop 1280×800 + mobile 390×844) | **8 testes — 100%** |

Cobertura E2E: login NextAuth real, compras→receção parcial→total (PARCIAL/RECEIVED), transferências (PENDING→DISPATCH→RECEIVE), ajustes (aumento/redução + insuficiente 400), reservas (criar/libertar), lotes (criar/listar), devoluções (POST+GET), movimentos paginados, saldos, isolamento entre 2 tenants (produtos, movimentos e escrita cross-tenant 404).

## 4. Como reproduzir

```bash
# 0) BD descartável (Docker, porta 5441)
docker ps | grep machine-wms-e2e-disposable

# 1) Migrations + schema completo + seed
DATABASE_URL=postgresql://postgres:***@127.0.0.1:5441/wms_e2e_disposable npx prisma migrate deploy
DATABASE_URL=... npx prisma db push --skip-generate --accept-data-loss
npm run test:e2e:seed

# 2) servidor de produção em 5441/3002
DATABASE_URL=... npx next start -p 3002

# 3) suites
APP_URL=http://localhost:3002 npm run test:e2e
npx playwright test
```

`tools/lint` usa TypeScript 6 apenas para lint (o app compila com TS 7 nativo); `npm run lint` usa esse toolchain.

## 5. Riscos remanescentes

1. **Drift schema ↔ migrations — resolvido nesta sessão** (ver secção 6): baseline `20261107190000_stock_schema_baseline`. Em BDs novas, `migrate deploy` cria tudo; em BDs onde os objetos já existem (criados por `db push`), registar a baseline como aplicada **antes** de correr `migrate deploy`.
2. **Drift de índices fora do stock — resolvido** com `20261107191000_align_nonstock_indexes` (BusinessDocument, Email*, PlatformTeamInvite). Validado: BD nova criada só por `migrate deploy` fica **idêntica** ao schema (diff vazio). Em BDs já alinhadas por `db push`, registar como aplicada.
3. **Volume do incidente** `facturacao-angola_machine_stock_test_data`: inspecionado em **read-only sobre cópia** — dados presentes (`machine_stock_test` 9.5 MB, `mf_rls_staging` 12 MB, `mf_rls_shadow` 9.3 MB, PG 17). Original permanece sem container montado; recuperação/restauro de serviço só com autorização explícita.
4. 38 avisos de lint (imports/`catch(error)` não usados) em código legado fora do WMS.
5. `docker compose` deve usar sempre `-p <projeto>` para evitar reconciliação multi-stack.

## 6. Migration baseline do stock (2026-11-07)

- **Ficheiro**: `prisma/migrations/20261107190000_stock_schema_baseline/migration.sql`.
- **Como foi gerada**: `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <shadow> --script`, filtrada para o domínio de stock (excluído o drift de índices de tabelas não-stock).
- **Validação**: BD nova `wms_baseline_verify` em 5441 → `migrate deploy` aplicou as 26 migrations; o diff resultante contra `schema.prisma` contém apenas os drops/criações de índices não-stock (excluídos de propósito). DB temporária removida no fim.
- **BD descartável de E2E**: baseline registada com `prisma migrate resolve --applied 20261107190000_stock_schema_baseline`; `migrate status` = up to date.
- **Para ambientes existentes (staging/produção), quando autorizado**:
  ```bash
  # 1) confirmar que as tabelas já existem (criadas por db push)
  npx prisma migrate status
  # 2) registar a baseline sem a executar
  npx prisma migrate resolve --applied 20261107190000_stock_schema_baseline
  # 3) confirmar
  npx prisma migrate deploy   # deve responder "No pending migrations"
  ```

## 7. E2E num comando, CI e volume (2026-11-07)

- **`npm run test:e2e:local`**: build → `prisma generate` → `migrate deploy` → seed → servidor `next start` em 3002 → Vitest E2E → Playwright (desktop+mobile) → servidor terminado. Executado com sucesso: **25/25 HTTP + 8/8 UI**. `--skip-build` reutiliza o build.
- **Compatível com CI**: lê `DATABASE_URL` do ambiente (`.env.e2e.local` opcional) e recusa alvos que não sejam `wms_e2e_disposable:5441`.
- **CI** (`.github/workflows/ci.yml`): jobs `test-and-build` (existente), `lint` (toolchain isolado) e `e2e` (Postgres 17 service em 5441, roles via `scripts/ensure-db-roles.cjs`, Chromium, build e `e2e-local.cjs --skip-build`).
- **Toolchain de lint**: `tools/lint` com lockfile próprio (`npm ci` no job de lint); removido o vínculo acidental ao pacote raiz que partia o build.
- **Volume do incidente**: cópia read-only montada num Postgres temporário em 5450; listadas as bases `machine_stock_test` (9.5 MB), `mf_rls_staging` (12 MB), `mf_rls_shadow` (9.3 MB). Cópia e container temporários removidos; volume original intacto.

## 8. Ambientes alinhados (2026-11-07 — autorização "faça tudo")

| Ambiente | Antes | Ação | Estado final |
|---|---|---|---|
| local `127.0.0.1:5436/wms_staging` | 24 migrations; `AuthJwtRevocation` ausente; baselines não registadas | roles criadas; JWT aplicada manualmente em transação + `resolve --applied`; baselines registadas | **27 migrations**, 53 tabelas, status up to date, RLS + 3 policies |
| Supabase staging (`DIRECT_URL` 5432) | `public` vazio, sem `_prisma_migrations` | roles `mf_*` criadas; `migrate deploy` das 27 migrations | **27 migrations**, 53 tabelas, stock presente, status up to date |
| descartável `5441/wms_e2e_disposable` | baselines resolvidas | — | status up to date; E2E 25/25 + 8/8 |

Notas:
- **Nenhuma base de produção foi tocada** — não existe URL de produção nos ficheiros de ambiente do repositório; o alvo remoto em `.env.staging` é staging.
- Snapshot do histórico de migrations do staging local guardado em `tmp/local-staging-5436-migrations-*.json`.
- `scripts/ensure-db-roles.cjs` cria as roles de forma idempotente em qualquer alvo.

## 9. Produção sem credenciais (2026-11-07)

O código novo é compatível com o schema atual; **nada fica bloqueado** se ninguém tiver acesso à BD de produção.

Quando existir acesso, o alinhamento é feito por script, com dry-run por omissão:

```bash
# 1) dry-run (não escreve nada)
DATABASE_URL="postgresql://..." npm run db:align-prod

# 2) aplicar (snapshot + roles + JWT se faltar + resolve das baselines)
DATABASE_URL="postgresql://..." npm run db:align-prod -- --apply
```

O script:
- recusa correr sem `DATABASE_URL`;
- guarda snapshot do `_prisma_migrations` em `tmp/` antes de escrever;
- só trata das migrations conhecidas (JWT, baseline de stock, índices);
- **aborta** se houver migrations pendentes desconhecidas ou se as tabelas de stock não existirem (nesse caso a BD precisa de `migrate deploy`, não de `resolve`);
- termina com `prisma migrate status`.

Se o deploy for gerido por outra pessoa, basta entregar-lhe este ficheiro e a secção 6.
