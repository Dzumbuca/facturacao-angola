# WMS Phase 3.1 — Final Backfill Audit

**Projeto:** facturacao-angola (Machine Facturas)
**Database:** 127.0.0.1:5436/wms_staging (PostgreSQL 18.6)
**Data:** 2026-11-03
**Tipo:** Auditoria (nenhuma alteração executada)

## 1. Scripts A, B, C — Stock

### Script A — Registos em falta (ProductWarehouseStock)
- **Objetivo:** criar PWS no armazém default para produtos sem PWS.
- **Análise:** deve filtrar `WHERE NOT EXISTS (PWS por tenantId+productId+warehouseId)` e juntar apenas warehouse default ativo do mesmo tenant. Idempotente.
- **Problema no rascunho original:** não garante unicidade composta (tenantId, productId, warehouseId) nem trata produtos com múltiplos armazéns (só default). Deve incluir `isLegacy=true` e `reservedQuantity=0`.
- **Correção proposta:** adicionar `AND w."isDefault"=true AND w."isActive"=true`, `ON CONFLICT` não aplicável (sem constraint única no rascunho) → usar `WHERE NOT EXISTS` robusto; registar IDs criados numa tabela de auditoria temporária para rollback.

### Script B — Atualização de stock
- **Problema grave no rascunho original:** `UPDATE PWS SET quantity = Product.stock WHERE isLegacy=true` sobrescreve indiscriminadamente e pode destruir quantidades operacionais de vários armazéns.
- **Correção proposta:** Script B não deve ser executado como está. A reconciliação deve ser feita por armazém, comparando `Product.stock` (legado) com a **soma** dos PWS. Se houver divergência, registar para revisão manual, não sobrescrever.
- **Recomendação:** desativar Script B na execução inicial; usar apenas para casos validados manualmente.

### Script C — Relatório de reconciliação
- **Correção proposta:** comparar `Product.stock` com `SUM(PWS.quantity)` agrupado por tenantId+productId, distinguindo:
  - Diferença justificada (movimentos OUT/IN posteriores, reversões).
  - Diferença não explicada (requer investigação).
- Incluir coluna `explicacao` (ex.: "movimentos posteriores", "sem PWS", "divergência não explicada").

### Idempotência
- Script A: idempotente via `WHERE NOT EXISTS`.
- Script B: não idempotente de forma segura (sobrescreve) → não executar.
- Script C: apenas leitura, idempotente.

### Rollback
- Script A: `DELETE FROM "ProductWarehouseStock" WHERE "isLegacy"=true AND id IN (<ids registados na execução>)` — nunca `DELETE ... WHERE isLegacy=true` genérico.
- Registar IDs criados em ficheiro/relatório antes da execução.

## 2. Script D — RLS (7 tabelas)

| Tabela | Escopo | tenantId nullable | Proposta |
|--------|--------|-------------------|----------|
| BusinessDocument | tenant | não (NOT NULL) | `USING (current_setting('app.tenant_id', true) = "tenantId")` + WITH CHECK idêntico; FORCE RLS |
| BusinessDocumentCounter | tenant | não | idem |
| EmailActionToken | user (global-ish) | n/a (sem tenantId; via userId) | RLS por `userId = current_setting('app.user_id')` ou service_role; tenant não aplicável |
| EmailCampaign | global (admin) | n/a | Apenas service_role/admin; app_user sem acesso direto |
| EmailCampaignRecipient | global (via campaign) | n/a | Acesso via service_role; sem tenant |
| EmailDelivery | misto (tenantId nullable) | sim | `USING (tenantId IS NULL OR current_setting('app.tenant_id',true)=tenantId)`; service_role bypass |
| PlatformTeamInvite | global (admin) | n/a (sem tenantId) | Apenas service_role/admin |

**Princípios:**
- Não aplicar `tenant_isolation` genérico a tabelas globais/admin.
- `app_user` (NOBYPASSRLS) respeita RLS; `service_role` (se existir) bypassa.
- `FORCE ROW LEVEL SECURITY` apenas onde RLS deve ser incontornável.
- Operações administrativas (email campaigns, platform invites) devem usar service_role ou um role dedicado, não app_user.

## 3. Testes preparados

1. Isolamento entre tenants: app_user com tenant A não vê dados do tenant B (RLS).
2. Ausência de duplicação: Script A executado 2x → count PWS inalterado.
3. Preservação de quantidades: PWS existente não sobrescrito.
4. Rollback limitado: apenas IDs da execução atual removidos.
5. Acesso legítimo: service_role acede EmailCampaign/PlatformTeamInvite; app_user não.

## 4. Plano de execução faseado

1. Backup lógico do staging (pg_dump).
2. Registar estado anterior (counts, divergências).
3. Executar Script A (com registo de IDs).
4. Executar Script C (relatório de divergências).
5. Repetir Script A (idempotência).
6. Aplicar Script D (RLS por tabela, individualmente).
7. Validar integridade, FKs, RLS, isolamento.

## 5. Plano de rollback

- Script A: DELETE apenas IDs registados.
- Script D: DISABLE RLS + DROP POLICY por tabela.
- Backup lógico disponível para restore completo.

## 6. Veredito

**NÃO APROVADO PARA BACKFILL** — pendente:
- Correção do Script B (não executar como está).
- Análise individual de políticas RLS (Script D) a validar com a equipa.
- Backup do staging a criar antes da execução.

Aguardando autorização expressa para executar os backfills (após correções e backup).