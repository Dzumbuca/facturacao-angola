# WMS Phase 3.1 — Backup Verification Report

**Projeto:** facturacao-angola (Machine Facturas)
**Data:** 2026-11-04

## 1. Backup criado

- **Ficheiro:** `C:\Users\Administrador\Desktop\wms_backups\wms_staging_backup_20261104_000353.dump`
- **Tamanho:** 215 056 bytes
- **Formato:** custom (pg_dump -F c)
- **Origem:** 127.0.0.1:5436/wms_staging (PostgreSQL 18.6)

## 2. Verificação de integridade

- `pg_restore --list` → 543 linhas, incluindo tabelas, políticas RLS, FKs, índices. Sem erros.

## 3. Restauração em base isolada

- Base de dados criada: `wms_staging_restore_test` (mesmo container, isolada).
- `pg_restore --clean --if-exists` → concluído sem erros.

## 4. Validação pós-restauração

| Item | Original | Restaurado | OK |
|------|----------|------------|----|
| Tabelas | 52 | 52 | ✓ |
| Tenants | 2 | 2 | ✓ |
| Products | 2 | 2 | ✓ |
| ProductWarehouseStock | 1 | 1 | ✓ |

## 5. Conclusão

Backup integral criado, verificado e restaurado com sucesso em base isolada. Dados íntegros e consistentes. Nenhuma alteração foi feita ao staging original.

**Próximo passo:** aguardar autorização para executar backfills.