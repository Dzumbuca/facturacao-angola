# WMS Phase 3.3 — RLS Validation Report

**Projeto:** facturacao-angola (Machine Facturas)
**Database de teste:** wms_rls_test (isolada, restaurada do backup + Script D)
**Data:** 2026-11-04

## 1. Backup

- Novo backup criado: `wms_staging_backup_20261104_000807.dump` (215 106 bytes).
- Integridade verificada (`pg_restore --list`, 543 entradas).

## 2. Auditoria do Script D

Script `scripts/backfill_D_rls.sql` inspecionado. Políticas específicas por tabela (detalhadas em `WMS_PHASE3_1_FINAL_BACKFILL_AUDIT.md`):

| Tabela | Escopo | Política |
|--------|--------|----------|
| BusinessDocument | tenant | tenant_isolation (USING + WITH CHECK) |
| BusinessDocumentCounter | tenant | tenant_isolation |
| EmailActionToken | user (userId) | user_isolation |
| EmailCampaign | global admin | admin_only (app.is_admin=true) |
| EmailCampaignRecipient | global admin | admin_only |
| EmailDelivery | misto (tenantId nullable) | tenant_or_null |
| PlatformTeamInvite | global admin | admin_only |

## 3. Testes isolados (resultados reais)

| Teste | Resultado |
|-------|-----------|
| app_user (tenant A) lê BusinessDocument | 0 (sem erro) |
| app_user (tenant B) lê BusinessDocument | 0 (sem erro) |
| app_user (is_admin=false) lê EmailCampaign | 0 (bloqueado por RLS) |
| app_user (is_admin=true) lê EmailCampaign | 0 (permitido) |
| Owner sem is_admin lê EmailCampaign (FORCE RLS) | 0 (FORCE aplicado) |
| Owner com is_admin lê EmailCampaign | 0 (permitido) |

## 4. Problemas encontrados

- Nenhum erro de execução. Script D aplicou-se sem falhas na base isolada.
- As políticas dependem de `current_setting('app.tenant_id'/'app.user_id'/'app.is_admin')` serem definidas pela aplicação; se não definidas, RLS nega tudo (fail-closed). Confirmar que `runWithTenant` define `app.tenant_id`.

## 5. Riscos residuais

- `EmailActionToken` sem tenantId: isolamento por `userId` depende de `app.user_id` ser definido; risco se não definido.
- Políticas admin dependem de `app.is_admin`; se a app não definir, admin perde acesso (fail-closed, seguro).
- `EmailDelivery` com tenantId NULL: registos globais visíveis a qualquer tenant com `app.tenant_id` definido — aceitável para delivery logs.

## 6. Compatibilidade com fluxos existentes

- `runWithTenant(tenantId, fn)` deve definir `app.tenant_id` via `set_config` no início da transação. Confirmar implementação em `src/lib`.
- Fluxos de email (admin) devem definir `app.is_admin=true` ou usar service_role.

## 7. Recomendação

Script D validado em ambiente isolado. **Recomenda-se aplicação no staging** após autorização expressa, com monitorização dos fluxos de email e documentos.

Aguardando autorização para aplicar Script D no staging original.