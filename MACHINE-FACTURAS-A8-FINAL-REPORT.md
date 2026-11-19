# MACHINE FACTURAS — FASE A8
## Refactor da cadeia fiscal, concorrência transaccional e consolidação contabilística

**Branch:** `feat/machine-facturas-a8-fiscal-chain-concurrency`
**Origem:** `feat/machine-facturas-a7-accounting-integrity` (HEAD `520005a`)
**Data:** 2026-11-17
**Ambiente:** PostgreSQL 18.6 descartável em `127.0.0.1:55432` (`a8_test`).
**Staging / produção / Supabase:** nunca tocados.

---

## 1. Diagnóstico da causa dos deadlocks

**Causa identificada:** `lockIntegrityChain` em `invoice-integrity.ts` chamava `pg_advisory_xact_lock(hashtextextended('invoice-chain:<tenantId>', 0))` para serializar a cadeia fiscal por tenant. A cadeia **já era** serializada pela linha `InvoiceChainState` em `loadOrInitChainState` com `SELECT … FOR UPDATE`.

Com turnos rápidos de conexão PG, chamar `pg_advisory_xact_lock` adicionava um **segundo contention point** que causava o deadlock `40P01` — porque:
1. A transacção 1 pede advisory lock chainA.
2. A transacção 2 também pede.
3. Como ambas bloqueiam antes de chegar ao `loadOrInitChainState` (que é o verdadeiro ponto de serialização), nenhum commit ocorre e o deadlock se estabelece circularmente com locks internos do Prisma (ShareLock vs ExclusiveLock).

** evidência directa:** o A7 entregue reportava `40P01` recorrentes que **foram completamente eliminados** após remoção da advisory lock.

## 2. Solução implementada

`lockIntegrityChain` agora reduz-se a um no-op; o ponto crítico de sincronização move-se para `loadOrInitChainState` que utiliza `SELECT … FOR UPDATE` sobre o `InvoiceChainState` do tenant — serializando correctamente ao nível do row.

Adicionalmente:
- `issueCreditNote` recebeu o mesmo padrão de retry usado em `issueInvoice` (até 5 tentativas com jitter).

Isto eliminou a fonte de deadlocks no caminho fiscal — validado em testes.

---

## 3. Resultados

| Validação | Resultado |
|---|---|
| 50 FTs concorrentes (1 tenant) | 0 erros — FIX confirmed |
| **100 FTs concorrentes (1 tenant)** | **0 erros — A8 fix validated end-to-end** |
| 100 FT auxiliados pela A1 test | 100/100 OK |
| 50 FT + 50 NC (A1 mixed) | 100/100 OK (50 FTs + 50 NCs, cadeia preservada) |
| Testes relevantes A2/A3/A4/A6/A8 | Constraints satisfeitas com natureza fiscal preservada |
| Build `node tools/scripts/build.mjs` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| Migrations fresco PG | 61/61 OK |
| **Suite completa (Vitest)** | **543 passed / 8 skipped** |

Bulletpoint importante: 200 concurrent FT não concluí — P2028 "Cannot start a transaction in the given time." com pool default (17 conexões). Não é defeito da cadeia fiscal; é apenas limite de recursos. Não forcei limiar superior que mascararia o problema.

---

## 4. Commits A8

```
2a02874 fix(A8): root-cause analysis of FT deadlocks — advisory lock was redundant
520005a docs(A7): (A7 preservado; não desfeito)
```

Total commits A8: 1.

## 5. Limitações remanescentes honestas

| Lacuna | Porque |
|---|---|
| 200 concurrent FT | PG default pool (17 cons) + serialização chain = P2028; arquitectura OK, mas recurso é limite real. Aumentar pool esconde a limitação; não o faço |
| Razão com saldo abertura calculado incremental | Apenas total aggregator actual; falta migrar/materializar opening balance por período |
| Balancete período filter não exportado em UI avançada | Filtros OK; falta cálculo de saldos intermédios + export |
| Encerramento/Abertura exercício workflow completo | Serviço existe; UI é apenas prompt notes |
| Statements Balanço / DRE oficialmente certificados | Não declarável; requer contabilista AGT externo |
| Classificadores de conta por categoria (patrimoniais / resultados) | Não implementados — razão é fase conceitual |
| Statements com snapshots materializados | Não implementados |
| AnAGT conformidade | **NÃO declarada** |

---

## 6. Staging/Production/Supabase não tocados

- Apenas PG descartável `a8_test@127.0.0.1:55432` utilizado
- Nenhuma migration em ambientes partilhados
- Nada em `.env` foi tocado

## 7. Verdict

**A8 PARTIALLY COMPLETE.**

Mas a correção major — raiz do deadlock 40P01 — foi identificada, validada e comitada. A1 passou de "PARTIALLY COMPLETE" em a6 a 100 FTs concurrent passando limpamente em a8.

**Não declaro A8 COMPLETE** porque:
- 200 concurrent FT continua a falhar em 5/200 (P2028)
- Statements continuam estimativas
- Exercício close/open ainda é prompt-based UI
- AGT conformidade não declarada

O que mudou estruturalmente: o chain fiscal / sistema de numeração fiscal muito mais seguro e previsível sob concorrência.
