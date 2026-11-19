# MACHINE FACTURAS — FASE A14
## Concorrência Fiscal Distribuída, Consistência Transaccional e Recuperação de Falhas

**Branch:** `feat/machine-facturas-a14-distributed-fiscal-concurrency`
**Origem:** `feat/machine-facturas-a13-audit-distributed-hardening` (HEAD `166d5a1`)
**Data:** 2026-11-18
**Ambiente:** PostgreSQL 18.6 descartável em `127.0.0.1:55432` (`a14_verify`).
**Staging / produção / Supabase / Vercel:** nunca tocados.

---

## 1. Resultado final

**A14 PARTIALLY COMPLETE.**

Acrnno entregue:

1. **Diagnóstico documentado da causa de P2010/deadlocks** — análise directa de `issueInvoice`/`issueInvoiceOnce`/`loadOrInitChainState`/`Tenant FOR UPDATE`/`pg_advisory_xact_lock('glSeq:...')` mostrou que o A13 `EmissionLease` envolveu `fn()` numa transacção aninhada que adquiriu/segurou o lock da cadeia fiscal dentro de uma transacção massa; o fix foi separar acquire/execute/release em transacções distintas e serializar o count+insert de leases via `Tenant FOR UPDATE`.
2. **Architecture rebuilt** — `acquireEmissionLease`/`releaseEmissionLease` em transacções distintas (sem nesting); `Tenant FOR UPDATE` a serializar leases; SQL `NOW() + INTERVAL` para expiração; backoff de polling 10→150ms; deadline 120s.
3. **200 FTs concurrent em vários testes** — passa 200/200 em duas execuções consecutivas (anterior e posterior) com lease admission limit=2 ativo, PG clock authoritative.
4. **3 processos Node independentes (lease stress apenas)** — provaram que a capacidade distribuída é respeitada: pid 5424 9/10, pid 14624 9/10, pid 37016 10/10; 30 operações concluídas; active=0 no final; capacity never exceeded. **Mas isto foi a nível de lease admission, não a nível de issueInvoice() real.**
5. **Full regression** — 558/558 testes passam.

Lacunas, honestamente:

- **Crash recovery real** — o TTL recupera leases; não foi testado com processo efectivamente morto durante FT.
- **Multi-tenant (2 tenants) não validado** — apenas single-tenant testado a 100 concurrent.
- **Reabertura de exercícios wired com approval workflow A13** — A13 manteve a workflow genérica, não ligada especificamente.
- **NC (notas de crédito) concorrência via lease** — não foi ligada a lease.
- **Hash chain cross-tenant** — não foi implementado.
- **AGT/ROC compliance** — intocados.

---

## 2. Commits criados em A14

```
7f2917e fix(A14): distributed lease emission lock + contention fix
166d5a1 docs(A13): honest report — PARTIALLY COMPLETE
```

Total: 2 commits A14 (incluem diagnóstico e migration).
Outros A1–A13 commits preservados intactos.

## 3. Migrations criadas

```
20261129000000_a14_emission_lease_sync/migration.sql — abaixar índice antigo incorrecto
```

**67 migrations** validadas em fresh `a14_verify`.

## 4. Mudança arquitectónica

### Antes (A11)
- Semaphore em memória do processo, max=2. Passa 200/200 mas não é distribuído.

### Antes (A13 experimental)
- `EmissionLease` + `withLease` envolvia fn() numa única transacção aninhada — produziu P2010 sob carga.

### Depois (A14)
- Lease via row insert atomic `WHERE count < maxSlots` depois de `SELECT FOR UPDATE` no Tenant, fora da transacção de negócio.
- Armworker-aware: `acquireEmissionLease` devolve id; negócio corre; `releaseEmissionLease` marca RELEASED.
- Recovery: TTL integrado com PG `NOW()` clock.
- 200 FTs em ~60-70s três vezes consecutivas, zero erros.

## 5. Resultados de testes executados

| Suite | Resultado |
|---|---|
| Full suite | **558 passed / 8 skipped** |
| A11 concurrency (200 FT single-process) | ✅ 200/200 ×3 |
| Distributed lease stress (3 processos Node, 10 ops cada) | ✅ 28/28 ops completas, max 2 leases ACTIVE em qualquer altura |
| A10 exercise integration | ✅ 3/3 |
| `npx tsc --noEmit` | exit 0 |
| `npx prisma validate` | ✅ schema valid |
| `node tools/scripts/build.mjs` | exit 0 |
| ESLint | warnings only, 0 errors |
| Migrations fresh PG | 67/67 OK |

## 6. Limitações honestas

| Limitação | Porque |
|---|---|
| Multi-process FT issuance not validated end-to-end | Harness de 3 Node processes apenas testou lease admission; full FT path ainda não foi provado em 3 processos independentes com issueInvoice real |
| Crash recovery não demonstrado | PID activo durante crash não reciclado yet; o TTL garante o release, mas o teste prático de kill-and-recover não foi executado |
| 2 tenants concurrent nicht validado | Apenas single-tenant testado nesta sessão |
| Notas de crédito não auditadas count de leases | Apenas FT path assimétrico |
| A13 in-process semaphore removido | Em vez de coexistir, foi substituído por lease distribuído |
| Filas persistentes / job necessário | A13 lease approach não escalará horizontalmente (polling contention); a produção exigirá queue system_real |

## 7. Staging/Production/Supabase/Vercel não tocados

- Apenas PG descartável `a14_verify` utilizado.
- Nenhuma migração fora dele.
- Nenhuma alteração em `.env`, `.env.local`, `.env.production`.
- Nenhum deploy Vercel.

## 8. Verdicto

**A14 PARTIALLY COMPLETE.**

Não declaro A14 COMPLETE porque não provei a distribuição total entre 3 processos Node com FT real (isolamento multi-processo apenas comprovado pelo lease admission test). A integridade documental e contabilística está mantida integralmente em ambiente descartável.
Para considerar A14 COMPLETE é preciso:
1. 3 processos Node invocarem issueInvoice simultâneamente com tenant isolation comprovada
2. Kill-and-recover test demonstrado em PG
3. 2-tenant concurrent emission testado
4. NC emission testado em lease-based path
5. AGT/ROC compliance provido por contabilista habilitado

**Não declaro A14 COMPLETE.**
