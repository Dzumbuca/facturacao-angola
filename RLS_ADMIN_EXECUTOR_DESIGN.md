# RLS_ADMIN_EXECUTOR_DESIGN.md

## Problema
Operações globais/admin (admin actions/UI, `plan/payment/proof/[id]`, `cron/reminders`, auditoria, gestão de planos/equipa) não podem usar isolamento tenant empresarial. Sob RLS com role sem BYPASSRLS, precisam de caminho explícito e auditável.

## Desenho
1. **Role/Executor:** `mf_admin_executor` (staging local criada, `NOBYPASSRLS`). Produção: role dedicada equivalente, **não aplicada**.
2. **Contexto GUC:** `SELECT set_config('app.is_admin','true', true); set_config('app.user_id','<adminId>', true); set_config('app.tenant_id','', true);` — apenas após autorização servidor confiável.
3. **Autorização fonte confiável:** sessão + DB (`User.platformRole`/permissões via guards `admin-auth`); **nunca** `is_admin/tenantId/role` do cliente.
4. **Políticas:** tabelas admin globais (`AdminAuditLog`, campanhas, platform config, etc.) `USING/WITH CHECK (app.is_admin='true')`. Tabelas tenant podem permitir admin explícito quando necessário (`current_setting('app.is_admin')='true' OR ...`).
5. **Auditoria:** todas ações sensíveis gravam `AdminAuditLog` (quem, ação, recurso, motivo, resultado). Leituras de dados sensíveis (comprovativos/PII) devem ser auditáveis.
6. **Cron:** `api/cron/reminders` protegido por `CRON_SECRET`; migrar para executor admin explícito + transações por tenant ou varrimento admin com auditoria; limitar taxa; segredos em infra, não código.

## Riscos remanescentes
- `admin-actions.ts` usa Prisma/tx global sem `app.is_admin` GUC; compatível com owner atual, **não comprovado** sob role sem BYPASSRLS + políticas.
- Escalada se endpoint confiar em input cliente.
