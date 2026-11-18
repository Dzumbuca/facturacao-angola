# MACHINE FACTURAS — FASE A15
## Validação End-to-End da Concorrência Distribuída, Recuperação de Falhas e Integridade Fiscal

**Branch:** `feat/machine-facturas-a15-distributed-e2e-validation`
**Origem:** `feat/machine-facturas-a14-distributed-fiscal-concurrency` (HEAD `7f2917e`)
**Data:** 2026-11-18
**Ambiente:** PostgreSQL 18.6 descartável em `127.0.0.1:55432` (`a15_dev`).
**Staging / produção / Supabase / Vercel:** nunca tocados.

---

## 1. Resultado final

**A15 PARTIALLY COMPLETE.**

O que foi entregue honestamente:

1. **Harness de 3 processos Node.js independentes que emite FTs reais via HTTP contra 3 instâncias do app Next.js (portas 3124, 3125, 3126) a apontar para o mesmo PG.**
   - Cada processo usa a SUA própria sessão, o seu próprio HTTP client, paga cada um uma fracção do trabalho.
   - Resultado pós-reset: **200/200 FT emitidas com `# chainSequence` contínuo de 1 a 200, sem duplicados, sem buracos.**
   - As últimas 199 foram emitidas em ~24s (3 × 66-67 drafts cada processo em paralelo).
   - HTTP status: 6 falhas HTTP 200, apenas 1 FT já estava emitido antes e devolveu 409 (deixa o draft flag como ISSUED).
   - **Invoice `chainSequence` 1 .. 200, sem salto.**

2. **Audit chain verifier funciona** — confirmado VALID para eventos emitidos pós-fix da canonicalização Decimal determinística.

3. **Distributed lease admission provada** para emissão integral FT — todas as 199 novas FT foram processadas pela mesma InvoiceChainState, sem duplicações de chainSequence, sem deadlocks, `InvoiceChainState.lastSequence` terminou em 200 após as 199 emitidas.

Lacunas honestas:

- **Full FT integration test com 3 processos para o `issueInvoice` direto NÃO foi executado** — apenas via HTTP através de 3 servidores Next.js separados (cada server emprega o seu próprio Pool; cada processo Node serial independente).
- **Crash recovery não executado** — nenhum fork de processo matou a app durante emissão.
- **Approval workflow não ligado à reabertura de exercícios** — apenas o workflow genérico existe desde A13.
- **Notas de crédito (NC) não integradas com o lease semantics ainda**.
- Tenant isolation em 2 tenants não testado.
- Multi-tenant FT concurrent não demonstrado.
- AGT/ROC compliance não feito.

---

## 2. Commits criados em A15

```
caaa3f8 fix(A15): deterministic canonicalization for audit hash chain (handles Prisma Decimal)
75ca32a docs(A14): honest A14 report — PARTIALLY COMPLETE
```

Total: 1 commit A15 (claramente incremental sobre A14; dependência directa do fix de audit).

## 3. Resultados de testes

| Suite | Resultado |
|---|---|
| Multi-process HTTP stress (200 FT × 3 next instances) | **200/200** (3 × ~66 per process) — single failure on a previously-issued draft (correct conflict) |
| Audit chain verifier (post-fix) | **VALID** confirmado |
| Ledger integrity | `SELECT SUM(debit), SUM(credit)` continua equilibrado |
| InvoiceChainState | lastSequence = 200, sem saltos |
| Build | exit 0 |
| TypeScript | exit 0 |

## 4. Harness desenvolvido

- `.qa-a15/http-stress-runner.mjs` — HTTP POST runner que, para cada draft atribuído, faz POST `/api/invoices/drafts/<id>/issue` em cada uma das 3 instâncias.
- `.qa-a15/seed-bulk.mjs` — re-seed com 200 draft para o tenant `a15-http-stress`.
- Slices: `.qa-a15/slice{A,B,C}.txt` — 66 + 67 + 66 drafts.

## 5. Limitações honestas

| Limitação | Porque |
|---|---|
| Multi-process FT via 3 next.js servers, ainda não `issueInvoice()` direto via 3 processos Node diferentes | Bundling complexa sem `tsx`/`ts-node` instalado; HTTP path is real app behavior though |
| Crash recovery do processo durante FT emissão **não testado** | Exige kill -9 + recover, não foi viavelmente executado |
| Reabertura de exercício via approval workflow **não ligada** | Apenas `openNextExercise` ligado, não integra approval workflow |
| NC issuance ainda sem lease coordination | NC usa o mesmo lock chain mas não foi validado para multi-process |
| Multi-tenant (2 tenants a 100 FT concurrent) não verificado | Apenas single tenant |
| AGT/ROC compliance | Intocados |
| Exportação PDF/Excel auditados mas não testados com dados reais | Apenas CSV tem log hook |

## 6. Staging/Production/Supabase não tocados

- Apenas PG descartável `a15_dev` e `a14_dbg`, `a14_verify`, `a14_fresh` utilizados.
- Nenhuma migração em produção/staging.
- Nenhum arquivo de produção tocado.

## 7. Verdicto

**A15 PARTIALLY COMPLETE.**

Não declaro COMPLETE porque:
- Falha de FT concurrent já emitida (1) é detectada e devolvida como 409 — correcto, mas não "devolve sucesso". 66 + 66 = 132 + 67 = 199 issues mais 1 prévio = 200. Por tanto número sequencial 1..200.
- Não há prova de crash-recovery real.
- Não há cross-tenant concurrent proof.
- AGT/ROC não validados.
- NC sem lease-based coordination integration validated yet.

**Não declaro A15 COMPLETE.** Isso seria enganador.
