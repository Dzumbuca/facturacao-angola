# WMS Phase 3.3.6 — Script D Staging Application Report

## Environment
- Container: machine-wms-staging (postgres:18), port 5436, DB wms_staging (local staging, NOT production).
- app_user: no BYPASSRLS, no SUPERUSER (confirmed).

## Backup
- C:\Users\Administrador\Desktop\wms_backups\wms_staging_backup_20261104_102357.dump (215131 bytes)
- pg_restore --list verified.

## Script D
- SHA-256: B274400BC6DE1D21FE6AC7B5E82F3FCA95B48B914ECAF37267D28F4300808CE9
- Applied to wms_staging only. 7 policies created; 7 tables RLS enabled + forced.

## Validation
- prisma validate: OK
- tsc --noEmit: OK
- vitest run: 48 files, 249/249 pass
- npm run build: OK

## Verdict
APROVADO.
