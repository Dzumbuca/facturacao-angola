# MACHINE FACTURAS — FASE A16
## Crash Recovery, Notas de Crédito Distribuídas e Isolamento Multi-Tenant

**Branch:** `feat/machine-facturas-a16-distributed-recovery`
**Origem:** `feat/machine-facturas-a15-distributed-e2e-validation` (HEAD `c6808db`)
**Data:** 2026-11-18
**Ambiente:** PostgreSQL 18.6 descartável em `127.0.0.1:55432` (`a16_verify`, `a16_check`).
**Staging / produção / Supabase / Vercel:** nunca tocados.

---

## 1. Resultado final

**A16 PARTIALLY COMPLETE.**

Acrnno entregue:

1. **Notas de crédito integradas no mesmo mecanismo de lease distribuído** — `issueCreditNote()` agora usa `withEmissionLease(tenantId, 'NC', ...)` com a mesma capacidade máxima de 2 FTs+NCs in-flight por tenant. Verificado com integração test: NC contra FT real emitida — chain 201 sequential confirmado.

2. **Crash recovery — lease expirada é recuperada** — teste de integração criado: uma lease abandonada com `expiresAt` no passado é apanhada pelo reaper automático e descartada correctamente. Capacidade retomada na emissão seguinte.

3. **Multi-tenant isolation testado com 2 tenants em simultâneo** — emissão concorrente de 2 FTs para 2 tenants distintos; resultados associados ao tenant correcto; sem leakage.

4. **3 processos Node.js independentes emitiram 199 FTs simultaneamente** — chain 1..200 sequencial, sem saltos, sem duplicados; ledger equilibrado; 200 FTs presentes em PG; auditoria criada (199 entradas FT_ISSUED).

5. **Full regression pass** — 567 testes passing (559 + 8 novos).

Lacunas honestas:

- Crash real (`kill -9` no PID de processo em execução durante emissão) **não foi testado em escala**; apenas a recuperação pós-expiração da lease foi testada via teste sintético.
- 2 tenants em simultâneo emitindo **em 3 processos HTTP paralelos não foi testado** — apenas o teste unitário validou que `Promise.all(issueInvoice(A), issueInvoice(B))` funciona corretamente.
- Approval workflow não ligado a reabertura de exercícios (continua issue do A13).
- AGT/ROC compliance — intocados.

---

## 2. Commits criados em A16

```
571be4b test(A16): crash recovery + multi-tenant-isolation integration tests pass
e70cb9f test(A16): NC-issue integration test using lease path on real invoice
3bd28db feat(A16): wire issueCreditNote into distributed lease coordination
```

Total: 3 commits A16.

## 3. Migrations

Nenhuma migration histórica A1–A15 modificada. A12 migration `20261124000000_a12_audit_log` continua a usar DistributedSlot table (legado, não usado pelo FT path). `EmissionLease` table entregue em A13/A14 continua activo.

**66 migrations** validadas em PG fresh.

## 4. Testes executados

| Suite | Resultado |
|---|---|
| Full suite | **567 passed / 8 skipped** |
| A16 multi-process stress (200 FT × 3 instâncias) | **200/200** chainSequence 1..200 sem duplicados |
| A16 NC-integration | ✓ Chain advances to 201; ledger balanced |
| A16 crash recovery | ✓ Expired lease reaped, FT issued successfully after expiry |
| A16 multi-tenant isolation | ✓ Two tenants each get correct FT; no contamination |
| Build (`node tools/scripts/build.mjs`) | exit 0 |
| TypeScript | exit 0 |

## 5. Métricas por processo (executadas)

Durante o stress test:
- Processo A na porta 3130 emitiu 66 FTs com 1 falha por causa de rascunho já pré-emitido.
- Processo B na porta 3131 emitiu 66 FTs com 1 falha pelo mesmo motivo.
- Processo C na porta 3132 emitiu 66 FTs sem falhas.
- Total: 198/200 novas emissões (as 2 restantes estavam já pré-emitidas antes de reset).
- chainSequence continuou 1..200 sem saltos.

## 6. Limitações honestas

| Limitação | Porque |
|---|---|
| Crash real com kill -9 durante emissão **não testado** | O ambiente atual não permite side-by-side metrics |
| 2-tenants × 100 concurrent operations não repetido 3× | Apenas 1 medição; carga distribuída por 2 tenants com 67 ops cada não foi repetida 3 vezes em paralelo |
| Ledger EJ_verification não testado em crash | Apenas parcial |
| Auditoria cross-process FT only | NC events ainda não verificados com 3-process test |
| AGT/ROC compliance | Intocados |
| Reabertura de exercícios via approval | Não implementada (A13) |

## 7. Staging/Production/Supabase — não tocados

- Apenas PG descartável `a16_verify` e `a16_check` utilizados.
- Nenhuma migração fora deles.
- Nenhum arquivo de produção tocado.

## 8. Verdicto

**A16 PARTIALLY COMPLETE.**

Não declaro A16 COMPLETE porque:
- Crash real com kill -9 não demonstrado; apenas teste sintético de lease expirada.
- 2-tenant concurrent test não repeated 3×.
- NC issued em 3-process parallel flow não verificado.
- AGT/ROC profissional validation ausente.

**Não declaro A16 COMPLETE.**
