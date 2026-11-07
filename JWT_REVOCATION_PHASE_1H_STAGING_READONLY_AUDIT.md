# JWT Revocation — Phase 1H Staging Read-Only Audit

## 1. Resumo executivo
| Área | Classificação | Nota |
|---|---|---|
| Autorização READ-ONLY 5437 | **BLOCKED** | Sem credenciais legítimas de leitura; ligação falhou no preflight. |
| FKs e órfãos | **NOT EXECUTED** | Bloqueado por falta de acesso. |
| Índices (8 drop + 22 create / 9 FKs / 1 rename) | **NOT EXECUTED** | Bloqueado. |
| Product barcode | **NOT EXECUTED** | Bloqueado. |
| BusinessDocument numbering | **NOT EXECUTED** | Bloqueado. |
| Roles/memberships/grants/RLS (5437) | **NOT EXECUTED** | Bloqueado. |
| Divergências Prisma reais (5437) | **NOT PROVEN** | Apenas evidência anterior/lab; estado real 5437 não confirmado nesta fase. |
| Proposta final de reconciliação | **DECISION REQUIRED / BLOCKED** por evidência real | Baseada em 1F/1G/lab; não fundamentada com dados reais de 5437. |

## 2. Confirmação READ-ONLY / Preflight (Fase A)
- **Branch:** `wms-v2-e2e-staging`
- **Commit:** `95e00366`
- **Git status antes (Phase 1H):** worktree com alterações preexistentes M/?? preservadas (sem commits); novos artefactos 1H apenas em `tmp/jwt-revocation-baseline-lab/phase-1h/*` e relatórios 1H.
- **Git status depois (Phase 1H):** inalterado face ao antes, excepto artefactos 1H não rastreados permitidos.
- **Alvo:** `127.0.0.1:5437/mf_rls_staging` (host/porta/db confirmados na tentativa).
- **Tentativa:** `pg.Client` com `application_name='phase1h_readonly_audit'`, `connectionTimeoutMillis=4000`, `statement_timeout=10000`, `query_timeout=10000`, `options='-c default_transaction_read_only=on'`, utilizador tentado `postgres`.
- **Resultado:** **FALHA** — `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string` (`2026-11-06T01:35:14.987Z`).
- **Evidência:** `tmp/jwt-revocation-baseline-lab/phase-1h/evidence/connection-preflight.json`, `tmp/jwt-revocation-baseline-lab/phase-1h/evidence/blocked-summary.json`, `tmp/jwt-revocation-baseline-lab/phase-1h/scripts/00-readonly-preflight.cjs`.
- **Read-only confirmado na sessão real:** **NOT PROVEN** (ligação não estabelecida).
- **`current_user`/`session_user`/`transaction_read_only`/`current_database()`/`version()`/privilégios:** **NOT EXECUTED**.
- **Tentativas de escrita para testar bloqueio:** não efectuadas.
- **Acções NÃO tomadas:** leitura de `.env`/`.env.local`, pesquisa em logs/histórico/secret stores, adivinhação de passwords, retry com superuser ou modo escrita, modificação de credenciais/permissões, `SET ROLE`/`SET SESSION AUTHORIZATION`, qualquer DDL/DML, `prisma db push`/`migrate deploy`/`migrate dev`/`migrate reset`/`migrate resolve` contra 5437, uso de 5436/Supabase/produção.

## 3. Estado das foreign keys
**BLOCKED / NOT EXECUTED.** Não auditadas em 5437: `StockMovement_tenantId_fkey`, `Warehouse_tenantId_fkey`, 9 FKs propostas pela Fase 1G. Nenhum catálogo PostgreSQL (`pg_constraint`, colunas, `confdeltype/confupdtype`, validação, deferrable) lido.

## 4. Registos órfãos
**BLOCKED / NOT EXECUTED.** Nenhuma consulta `SELECT` de integridade executada em 5437 (órfãos, tenant IDs inconsistentes, cross-tenant, referências inválidas, movimentos sem armazém válido, produtos/tenants incompatíveis, inconsistências WMS).

## 5. Análise dos índices
**BLOCKED / NOT EXECUTED.** Os 8 índices que o Prisma pretende eliminar, 22 índices propostos e 1 rename não foram inspecionados em 5437 (definição, tabela, colunas, ordem, unique, predicate, método, constraint associada, validade, tamanho, substituto, evidência de uso).

## 6. Product barcode
**BLOCKED / NOT EXECUTED.** `Product_tenantId_barcode_key` e distribuições (total, NULL, vazio, espaços, duplicados intra/inter-tenant, normalização analítica, case, incompatibilidades com índice parcial/normal/obrigatório) não analisadas em 5437.

## 7. BusinessDocument numbering
**BLOCKED / NOT EXECUTED.** `BusinessDocument_tenantId_type_number_key` vs `@@unique([tenantId, number])` não comparados com dados reais (total, por tipo, repetidos intra-tipo/inter-tipo/inter-tenant, NULL/vazio, colisões potenciais, regra A/B/C).

## 8. Roles e memberships
**BLOCKED / NOT EXECUTED.** Existência real/visível em 5437, atributos, memberships, INHERIT/NOINHERIT, SUPERUSER/BYPASSRLS/LOGIN de `mf_app_nobypass`, `mf_app_login`, `mf_admin_executor`, `mf_admin_login`, `mf_auth_executor`, `mf_auth_login`, `mf_jwt_writer` não comprovados. `SET ROLE` não executado.

## 9. RLS e grants
**BLOCKED / NOT EXECUTED.** RLS, FORCE RLS, policies, grants (tabelas/sequências/funções), ownership, funções SECURITY DEFINER e `search_path` na staging não inspecionados. Presença real de VULN-1/VULN-2 na staging **NOT PROVEN** (PASS lab ≠ staging).

## 10. Divergências Prisma
**NOT PROVEN (estado real 5437).** Comparação com `prisma/schema.prisma`, migrations, diff 1F e decisões 1G permanece condicionada; staging real não confirmada nesta fase. Nenhum Prisma executado contra 5437.

## 11. Decisões arquitecturais
Pendentes de evidência real 5437 antes de alteração oficial: semântica `ON DELETE` (`StockMovement_tenantId_fkey`/`Warehouse_tenantId_fkey`); regra de numeração documental; estratégia barcode (parcial/normal/obrigatório/normalização); preservar/substituir/redundância/NOT PROVEN para 8 índices; pacote 22 índices/9 FKs/1 rename; presença/integração `AuthJwtRevocation`; estratégia `_prisma_migrations`.

## 12. Proposta de reconciliação
Ver `JWT_REVOCATION_PHASE_1H_FINAL_RECONCILIATION_PROPOSAL.md`. Fundamentação com dados reais: **BLOCKED**.

## 13. Riscos residuais
- Reconciliação sem auditoria 5437: risco de perda de semântica (CASCADE↔RESTRICT), colisões de unicidade, falha de FKs por órfãos, degradação de queries, incompatibilidade com dados reais.
- VULN-1/VULN-2 validados em lab; staging **NOT PROVEN**.
- Roles reais, pooling/runtime, grants efectivos, `mf_app_login` e memberships em 5437 **NOT PROVEN**.

## 14. Próxima fase recomendada
1. Fornecer credenciais legítimas **READ-ONLY** para `127.0.0.1:5437/mf_rls_staging` (não superuser como substituto de app NOBYPASSRLS). Sessão com `default_transaction_read_only=on`.
2. Reexecutar Phase 1H Fases B–G apenas com `SELECT`/catálogos read-only.
3. Consolidar decisões de negócio/dados com evidência 5437; validar candidatos em 5440 sintético; submeter proposta oficial para autorização (sem apply).

## Acesso de leitura necessário (exacto)
- **Host/porta/db:** `127.0.0.1:5437/mf_rls_staging`.
- **Modo:** conexão READ ONLY (`default_transaction_read_only=on` ou equivalente), sem DDL/DML.
- **Privilégios mínimos inventário:** `CONNECT`; `USAGE` em `public`; `SELECT` em catálogos necessários (`pg_class`, `pg_namespace`, `pg_constraint`, `pg_index`, `pg_am`, `pg_attribute`, roles/policies/procs visíveis, `information_schema.*`) e tabelas-alvo existentes: `"Tenant"`, `"Product"`, `"BusinessDocument"`, `"StockMovement"`, `"Warehouse"`, `"PurchaseReception"`, `"StockTransfer"`, `"StockTransferReception"`, `"ProductWarehouseStock"`, `"AuthJwtRevocation"` (se existir), tabelas auth relevantes para grants/RLS visíveis.
- **Provas RLS (etapa separada/autorizada):** role NOBYPASSRLS representativa da aplicação, apenas transação read-only, sem `SET ROLE`/`SET SESSION AUTHORIZATION` proibidos.
- **Excluído:** escrita, superuser para contornar auditoria, alteração de credenciais/permissões nesta fase.
