# WMS Phase 3.2 — Backfill A Execution Report

**Projeto:** facturacao-angola (Machine Facturas)
**Database:** 127.0.0.1:5436/wms_staging (PostgreSQL 18.6)
**Data:** 2026-11-04

## 1. Preconditions verificadas

- Product B (qqqqqqqq-...) pertence ao tenant B (22222222-...): confirmado.
- Warehouse B (bbbbbbbb-...) é default e ativo para tenant B: confirmado.
- Product B não tinha PWS (count=0): confirmado.
- Product A não foi tocado: confirmado.

## 2. Execução

- Script restrito `backfill_A_restricted.sql` executado em transação (BEGIN/COMMIT).
- Preconditions validadas via DO block (RAISE EXCEPTION se falhassem).
- 1 registo PWS criado: id `pws-b-backfill-a`, quantity=30.000, isLegacy=true.

## 3. Resultados pós-execução

| Verificação | Resultado |
|-------------|-----------|
| PWS para Product B | 1 registo, quantity=30.000 |
| Product B stock | 30.000 (inalterado) |
| Product A stock | 50.000 (inalterado) |
| Product A PWS | 10.000 (inalterado) |
| FKs / isolamento | OK |

## 4. Rollback

- Registo criado: `pws-b-backfill-a`.
- Rollback: `DELETE FROM "ProductWarehouseStock" WHERE id='pws-b-backfill-a';`

## 5. Conclusão

Script A executado com sucesso exclusivamente para o Produto B. Nenhuma outra tabela ou registo foi alterado. Aguardando autorização para a próxima etapa (Script D / reconciliação manual do Produto A).