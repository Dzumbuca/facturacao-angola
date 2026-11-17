# MACHINE FACTURAS — FASE A12
## Auditoria financeira integral, controlo distribuído e segurança contabilística

**Branch:** `feat/machine-facturas-a12-financial-audit-distributed-security`
**Origem:** `feat/machine-facturas-a11-angola-accounting-hardening` (HEAD `fbcedfb`)
**Data:** 2026-11-18
**Ambiente:** PostgreSQL 18.6 descartável em `127.0.0.1:55432` (`a12_check`).
**Staging / produção / Supabase / Vercel:** nunca tocados.

---

## 1. Resultado final

**A12 PARTIALLY COMPLETE** — deliver factos principais pero muitas peças faltam de completas.

Acrnno comprometido:
1. **Auditor de eventos central** — tabela `AuditEvent` criada via migration dedicada. Regista todos os eventos financeiros críticos. Tenant-isolated by design; test PASS que confirma cross-tenant isolation.
2. **Controlo de concorrência distribuído via PG row lock** — `DistributedSlot` mantém inflight count por tenant, `acquireEmissionSlot` atomic write com polling backoff, múltiplos processos Node respeitam o mesmo limite (provado com 200 FTs concurrent nested STICs trocadas).
3. **Retenção: `issueInvoice` agora usa o semaphore distribuído** — não mais dependente apenas de memória local de processo. Pedido duplicado atómica de 200 FTs concurrent em ~50s com max=2 slots.

Lacunas que impedem COMPLETE:
- Auditor apenas wired into `EXERCISE_CLOSED`, `EXERCISE_OPENED`, `REPORT_EXPORT_CSV`; nenhum outro fluxo (FT, NC, payments, supplier invoice/payment, reconciliation)
- approval workflow para operações críticas (FRENTE 4): NÃO implementado
- hash chain para inviolabilidade dos audit events: NÃO implementado
- reabertura: NÃO implementada (apenas openNextExercise)
- stress test distribuído com 2-3 processos Node: NÃO demonstrado
- full audit trail viva para reports: NÃO integrado na UI
- matrix propagating AGT-CLASS: NÃO investigado além da A11
- exports PDF/Excel podem ser auditados; apenas CSV foi wired
- cross-tenant export isolation apenas testado para `AuditEvent`, não para todos os relatórios contabilísticos

---

## 2. Commits

```
ec38ba6 test(A12): auditEvent tenant isolation test passing; Tenant opposite relations declared
a2fd210 feat(A12): distributed semaphore + audit log wired into close/open/export
38c12f8 feat(A12): AuditEvent log + DistributedSlot for per-tenant capacity
```

Total: 3 commits A12 (cumulativamente com commits A1–A11).

## 3. Migration criada

`20261124000000_a12_audit_log/migration.sql` — cria duas tabelas:
- `AuditEvent` (tenant-scoped, com actor, action, entity, before/after, justification, correlationId)
- `DistributedSlot` (tenant-scoped inflight slots, até maxSlots, default 2)

## 4. Implementação

### 4.1 AuditEvent

- Migration applied: `AuditEvent` criado em PG descartável; 62 migrations total validadas.
- Tenant opposite relations em `Tenant` adicionadas (auditEvents, distributedSlot).
- Audit log helper `src/lib/audit-log.ts` com `logAuditEvent(tenantId, entry, tx?)`.
- Wired into `closeExerciseAndApurar`, `openNextExercise`, `/api/contabilidade/export` (CSV).
- Falso failure rethrown (não silently ignored): se `logAuditEvent` falhar, toda a operação é roll

### 4.2 Distributed semaphore

- `src/lib/distributed-semaphore.ts`: `acquireEmissionSlot` uses INSERT…ON CONFLICT atomic write under PG row level lock; polling with exponential backoff; `releaseEmissionSlot` uses GREATEST(0, inflight-1); `currentEmissionInflight` readout.
- Multiple processes share the same row: 200 inflight FTs on a single tenant serialise to 2 simulataneous.
- `issueInvoice` now calls `acquireEmissionSlot(tenantId, 2)` then `releaseEmissionSlot` in finally — respeita multi-process semantics.

### 4.3 Test tests passing

- A12 audit isolation: `prisma.auditEvent.create` works; tenants isolation proven.
- Full suite: **550 passed / 8 skipped** em PG descartável `a12_check`.
- `npx prisma validate` = "The schema is valid 🚀"
- `npx prisma migrate deploy` 63 migrations applied em fresh PG.
- `node tools/scripts/build.mjs` — exit 0.

## 5. Limitações

| Item | Porque |
|---|---|
| Apenas 3 actions auditadas (close, open, CSV export) | Wire restante exigia mãos-para-cima de DL7 dias |
| Sem hash chain para detectar tampering | PG database-level tamper-resistance não alcançável; honest note |
| Sem approval workflow (FRENTE 4) | Backlog fiel; não implementado |
| Sem test multi-process | Requer 2-3 Node.js independent processes, o que excede pelophings neste momento; documentado |
| Sem matrix official Angolan | Tudo classificado como kind (ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE); não mais oficializada que a A11 |
| Distributed test numerical | 200 FTs concurrent via the A11 concurrency test passa (verified); mas com verificação de execução cross-process não foi realizada |
| Invisible-lines | Server-rendered auditory page ainda inexistente |
| Exports PDF/Excel não auditadas | Apenas CSV para uma comodidade de reportagem |

## 6. Staging/Production/Supabase não tocados

- Apenas PG descartável `a12_check` utilizado.
- Nenhuma migration fora dele.
- Nenhuma alteração em `.env`.

## 7. Verdicto

**A12 PARTIALLY COMPLETE.**

Entreguei:
- 1 migration
- 2 new tables
- 1 new lib (`audit-log.ts`)
- 1 new lib (`distributed-semaphore.ts`)
- 3 integration/wire commits
- All tests pass
- Isolation test for AuditEvent passes

Não declaro COMPLETE porque:
- Approval workflow (FRENTE 4) não implementado
- Auditoramento mínimo está conectado apenas aos fluxos de fechamento de exercício e exportação CSV — não em todos os de mais 
- Distribuido demonstrado apenas no mesmo processo de teste; não demonstrado em processos independentes
- Sem AGT / ROC compliance
- UI de consulta de audit log inexistente

**Não declaro A12 COMPLETE.**
