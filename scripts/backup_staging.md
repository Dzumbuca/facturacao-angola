# Backup procedure for WMS staging (127.0.0.1:5436/wms_staging)

## Create backup
pg_dump -h 127.0.0.1 -p 5436 -U staging_admin -d wms_staging -F c -f "wms_staging_backup_$(Get-Date -Format yyyyMMdd_HHmmss).dump"

## Verify integrity
pg_restore --list wms_staging_backup_*.dump | head -20

## Restore (only if needed)
pg_restore -h 127.0.0.1 -p 5436 -U staging_admin -d wms_staging --clean --if-exists wms_staging_backup_*.dump

## Notes
- Do NOT print credentials in logs.
- Store backup outside the project repo (e.g., C:\Users\Administrador\Desktop\backups\).
- Verify row counts after restore match pre-backup counts.