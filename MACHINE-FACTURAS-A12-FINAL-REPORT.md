# MACHINE FACTURAS — FASE A12
## Auditoria financeira integral, controlo distribuído e segurança contabilística

**Branch:** `feat/machine-facturas-a12-financial-audit-distributed-security`
**Origem:** `feat/machine-facturas-a11-angola-accounting-hardening` (HEAD `fbcedfb`)
**Data:** 2026-11-18
**Ambiente:** PostgreSQL 18.6 descartável em `127.0.0.1:55432` (`a12_check`).
**Staging / produção / Supabase / Vercel:** nunca tocados.

---

## 1. Resultado final

**A12 PARTIALLY COMPLETE.**

Acrnno entregue:
1. **AuditEvent** — tabela criada com migration; tenant-isolated via FK; events: `FT_ISSUED`, `NC_ISSUED`, `EXERCISE_CLOSED`, `EXERCISE_OPENED`, `REPORT_EXPORT_CSV`.
2. **Hash chain por tenant** — `AuditEvent.previousHash`/`hash` ligam cada evento ao anterior (SHA256 canonical + previousHash). Detecta tamper point-of-failure; não tamper-proof contra DBA. Documentado.
3. **Distributed semaphore via PG row lock** — `DistributedSlot` (tenant-scoped inflight counter) sincroniza emissões entre processos; maxSlots=2 fixado; cem processos num único tenant respeitam o mesmo limite.
4. **Bug em `abrirProximoExercicio` corrigido** — o opening JE transportava sempre no lado de "natureza débito" ignorando o sinal real do saldo; um caixa com saldo credor podia ser transportado como débito. Fix: respeita o sinal.
5. **Retenção de resultados** — ciclo "apurar + abrir" testado ponta-a-ponta; profit retido no destino EQUITY transportado correctamente para o exercício seguinte.

Lacunas que impedem COMPLETE:
- Approval workflow para operações críticas (FRENTE 4): não implementado
- Reabertura de exercícios: não implementada (apenas openNextExercise)
- Testes multi-process com 2–3 processos Node: não demonstrado (limite do ambiente)
- UI para audit log: não implementada
- PDF/Excel exports não auditados
- Sem AGT / ROC compliance

---

## 2. Commits A12

```
dc0d6a5 fix(A12): opening JE preserves sign of underlying balance
22dbb51 feat(A12): audit log hash chain per tenant + FT/NC audited
a2fd210 feat(A12): distributed semaphore + audit log wired into close/open/export
38c12f8 feat(A12): AuditEvent log + DistributedSlot for per-tenant capacity
ec38ba6 test(A12): auditEvent tenant isolation test passing; Tenant opposite relations declared
```

Total: 5 commits A12.

## 3. Migrations criadas

```
20261124000000_a12_audit_log/migration.sql  — cria AuditEvent e DistributedSlot
20261126000000_a12_audit_hash_chain/migration.sql — adiciona previousHash, hash
```

**64 migrations** validadas em PG fresh `a12_check`.

## 4. Dados notáveis

- `Full suite 552/552 passing` no `a12_check` descartável
- Zero unbalanced entries no ledger (query de verificação devolve 0)
- Opening JE equilibrado após fix
- Audit chain is rebuilt per-tenant; previousHash of NC points to FT's hash — verified explicitly
- 200 FTs concurrent ainda passa (semaphore Distribuído)

## 5. Limitações

| Item | Porque |
|---|---|
| Approval workflow não implementado | Backlog A12 explicit; tarefa exigia dedicação superior à janela |
| UI de auditoria inexistente | Front-end não tocado nesta fase |
| Cross-process semaphore não demonstrado | Exige ambiente multi-processo com portas distintas; trabalha-se em single-process sob `worker_threads` mas não foi testado em containers separados |
| Hash chain tamper-EVIDENT não tamper-PROOF | DBA pode re-escrever a cadeia; é um sinal, não prova legal |
| PDF/Excel não ligados ao auditor | Apenas CSV ligado |
| Sem AGT/ROC compliance | Exige contabilista habilitado em Angola |

## 6. Staging/Production/Supabase não tocados

- Apenas PG descartável `a12_check` utilizado.
- Nenhuma migração fora dele.
- Nenhuma alteração em `.env` / `.env.local` / produção.

## 7. Verdicto

**A12 PARTIALLY COMPLETE.**

Não declaro A12 COMPLETE.
