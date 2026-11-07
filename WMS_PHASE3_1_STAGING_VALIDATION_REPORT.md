# WMS Phase 3.1 — Staging Validation Report

**Projeto:** facturacao-angola (Machine Facturas)
**Database:** 127.0.0.1:5436/wms_staging (PostgreSQL 18.6)
**Data:** 2026-11-03
**Status:** Validação concluída — staging operacional

## 1. Dados sintéticos criados

- Tenant A (11111111-...) + Warehouse A (default) + Product A (stock=50) + PWS (quantity=10, isLegacy=true)
- Tenant B (22222222-...) + Warehouse B (default) + Product B (stock=30) + sem PWS inicial
- Todos os registos claramente identificados como SYNTHETIC.

## 2. Testes executados

| Teste | Resultado |
|-------|-----------|
| Conexão PostgreSQL 18.6 | OK |
| Schema (52 tabelas) | OK |
| Dados sintéticos (2 tenants, 2 warehouses, 2 products, 1 PWS) | OK |
| RLS habilitado (46 tabelas) | OK |
| FORCE RLS (21 tabelas) | OK |
| Roles app_user/migration_user criados | OK |
| Compatibilidade Prisma (migrate deploy + migration.v2) | OK |
| Integridade referencial (FKs) | OK (sem órfãos) |

## 3. Divergências de stock (esperadas, não corrigidas — conforme regras)

- Produto A: Product.stock=50 vs PWS.quantity=10 → diferença 40 (não reconciliado, backfill pendente)
- Produto B: Product.stock=30 vs sem PWS → diferença 30 (backfill pendente)

## 4. Isolamento multi-tenant

- Dados pertencem a tenants distintos; nenhuma partilha cross-tenant nos registos.
- RLS FORCE ativo nas 21 tabelas principais.
- 7 tabelas sem RLS identificadas para análise individual (Script D) — pendente.

## 5. Problemas encontrados

- Porta 5436 utilizada (5434 ocupada por kyc_postgres, não modificada).
- Staging original não recuperável; reconstruído do zero.
- Backfills NÃO executados (conforme autorização).

## 6. Próximos passos

Aguardar autorização específica para executar backfills A/B/C/D (corrigidos) e reconciliação do stock.