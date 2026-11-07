# WMS Phase 3.1 — Remediation Report

**Projeto:** facturacao-angola (Machine Facturas)
**Database:** 127.0.0.1:5436/wms_staging (PostgreSQL 18.6)
**Data:** 2026-11-03

## 1. Alterações realizadas (ficheiros preparados, não executados)

- `scripts/backfill_A.sql` — Script A corrigido (idempotente, só cria PWS em falta no armazém default, quantity inicial 0, registo de IDs para rollback).
- `scripts/backfill_B.sql` — Script B convertido em análise (NO-OP). Não sobrescreve quantidades. Reporta divergências.
- `scripts/backfill_C.sql` — Script C corrigido (compara Product.stock com SUM(PWS.quantity), classifica divergências).
- `scripts/backfill_D_rls.sql` — Políticas RLS específicas por tabela (7 tabelas), justificadas individualmente.
- `scripts/backup_staging.md` — Procedimento de backup e restore.

## 2. Problemas resolvidos

- Script B não sobrescreve mais indiscriminadamente.
- Script C agora compara com soma dos PWS.
- RLS D não usa políticas genéricas; cada tabela tem política justificada.
- Rollback limitado a IDs registados (não genérico por isLegacy).

## 3. Problemas pendentes

- Execução dos backfills (aguarda autorização).
- Criação de backup antes da execução.
- Testes de isolamento RLS a validar em staging.

## 4. Resultados dos testes

- Nenhum teste executado (fase de preparação). Testes planeados documentados em `WMS_PHASE3_1_FINAL_BACKFILL_AUDIT.md`.

## 5. Scripts finais preparados

- `scripts/backfill_A.sql`
- `scripts/backfill_B.sql`
- `scripts/backfill_C.sql`
- `scripts/backfill_D_rls.sql`
- `scripts/backup_staging.md`

## 6. Procedimento de backup

Documentado em `scripts/backup_staging.md` (pg_dump + pg_restore, verificação de integridade).

## 7. Veredito final

**APROVADO PARA BACKFILL** (após criação de backup e autorização expressa).

Aguardando autorização para:
1. Criar backup do staging.
2. Executar backfills A e C.
3. Aplicar Script D (RLS).
4. Validar isolamento e idempotência.