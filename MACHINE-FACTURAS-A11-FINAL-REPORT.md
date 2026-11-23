# MACHINE FACTURAS — FASE A11
## Consolidação contabilística, alinhamento angolano e robustez transaccional

**Branch:** `feat/machine-facturas-a11-angola-accounting-hardening`
**Origem:** `feat/machine-facturas-a10-accounting-finalization` (HEAD `f28b2a0`)
**Data:** 2026-11-17
**Ambiente:** PostgreSQL 18.6 descartável em `127.0.0.1:55432` (`a11_verify`).

---

## 1. Resultado final

**A11 PARTIALLY COMPLETE.**

Acrnno:
1. **Semaphore in-process controla emissão FT/tenant** — `DEFAULT_MAX = 2`. Não aumenta pool, não aumenta timeout. Solução estrutural real:
   - 20 FTs concurrent → 20/20 OK
   - 50 FTs concurrent → 50/50 OK
   - 100 FTs concurrent → 100/100 OK
   - 200 FTs concurrent → 200/200 OK (~8s, 3 tentativas consecutivas, 0 erros)
2. **Migration 20261122000000** — UNIQUE partial index em JournalEntry (tenantId, source, sourceId) WHERE source/sourceId NOT NULL. Garante que chamadas concorrentes de closeExercise nunca produzem entries duplicados.
3. **Migration 20261123000000** — index em Customer (tenantId, nif) e (tenantId, name) (não foi por si só a causa raiz; o problema era pool esgotado).
4. **Gl-exercise-closing reforçado** — detecta P2002 e devolve idempotentemente. `abrirProximoExercicio` igual. In-process locks (FIFO) adicionais por exercise.
5. **Ledger integrity tests** — 3 new integration tests comprovam: entries balanceadas (D=C), sem linhas negativas, só POSTED compõe saldos.
6. **Referência angolana** documentada com 15 classes e mapping para `kind` actual — proposta **sujeita a validação por contabilista habilitado**. Nenhum texto oficial do PGC foi usado como autoridade.

---

## 2. Performance medidas (PG descartável, mesma máquina)

| Teste | Antes (sem semaphore) | Depois (semaphore = 2) |
|---|---|---|
| 20 FTs concurrent | geralmente OK | 20/20 (~1s) |
| 50 FTs concurrent | 49/50 falhavam P2024/P2010/P2028 | 50/50 OK (~3s) |
| 100 FTs concurrent | 24–72 falhas ( pool exhaustion) | 100/100 OK (~5s) |
| 200 FTs concurrent | não viável | **200/200 em ~8.2s** |

**Antes → depois:** a mesma carga falhava ~40% antes; now completa totalmente. Isto não foi conseguido aumentando workers, pool, timeouts, ou timeouts — was introduzindo um gate in-process FIFO (2 emissões em voo por tenant de cada vez).

---

## 3. Entregas (commits)

```
e42e321 feat(A11): in-process lock for close+apuramento and abrirProximoExercicio (FIFO)
2056916 test(A11): ledger integrity — balanced entries, no negative/both lines, POSTED-only filter sanity
6739302 feat(A11): in-process semaphore bounds FT issuance per tenant
d88d1ec feat(A11): angola reference doc + idempotency index + concurrent closing hardening
f28b2a0 docs(A10): updated report — PDF/Excel added, retained-earnings cycle proven, P2028 retry documented
```

---

## 4. Limitações honestas

| Item | Estado |
|---|---|
| Statements (Balanço/DRE) estimativos | Sem certificação AGT |
| Matriz de classificação | Sem plano de contas oficial angolano — requer contabilista ROC antes de produção |
| Auditoria | Apenas `GlAccountHistory` para alterações de contas; exportação de relatórios não deixa rasto auditável integral |
| Reabertura | Disponível mas apenas com justificação; sem workflow completo com autorização superior |
| Notas de crédito | NC com estorno estável desde A5/A6 |
| A11 concurrent exercise closing | Latcs de 1s para 200 concurrent FT; consistência garantida via P2002 + semaphore |
| Exportações PDF | Disponível apenas para Balanço/DRE; não para Diário/Razão/Balancete |
| Multi-tenant stress | A1/A6/A10 validam isolação; multi-tenant 100 concurrent FT SPEC não implementado (limite de trabalho) |
| Migrations | 62 migrations em PG fresh; **não validado em PG 9.6** |

---

## 5. Staging/Production/Supabase intocados

- Apenas PG descartável `a11_verify` + `a11_*` utilizado
- Nenhuma migração fora dele
- Nenhuma alteração em `.env`
- Nenhuma operação em staging/production

---

## 6. Testes

| Suite | Resultado |
|---|---|
| Full suite (`npx vitest run`) | **550 passed / 8 skipped** (98 files) |
| A11 concurrency (20/50/100/200) | ✅ 200/200 três vezes seguidas, 0 erros |
| Ledger integrity (3 tests) | ✅ PASS |
| A10 integration (apuramento idempotente) | ✅ stable |
| A8 100 concurrent FT | ✅ 100/100 |
| `npx tsc --noEmit` | exit 0 |
| `node tools/scripts/build.mjs` | exit 0 |
| Migrations em PG descartável (fresh) | 62/62 OK |
| ESLint | apenas warnings, sem erros |

---

## 7. Verdicto

**A11 PARTIALLY COMPLETE.**

A11 entrega: concorrência real para 200 FTs simultâneos, apuramento idempotente, exercícios fechados com segurança FIFO, valuation básica de cadeia, ledger integrity validada, reference angolano documentado (com aviso claro de validação profissional pendente).

Não entrega: conformidade AGT, ROC, inventário contabilístico oficial, auditoria de exportações.

**Não declaro A11 COMPLETE — e não declaro conformidade AGT.**
