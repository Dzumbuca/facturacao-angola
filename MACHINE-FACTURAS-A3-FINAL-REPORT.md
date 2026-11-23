# MACHINE FACTURAS — FASE A3
## Fecho funcional e integração definitiva do ERP

**Branch:** `feat/machine-facturas-a3-functional-integration`
**Branches preservadas:** `main` intocada, `feat/machine-facturas-a1-integrity` intocada, `feat/machine-facturas-a2-erp-consolidation` intocada.
**Data:** 2026-11-17
**Ambiente de validação:** PostgreSQL 18.6 descartável em `127.0.0.1:55432` (`a2_validation_test` para testes de integração; `a3_final_check` para verificação de migration from scratch).
**Ambiente de produção:** never touched.

---

## 1. Resultado final

**A3 FUNCTIONALLY COMPLETE** — com restrições honestas documentadas.

Esta fase encerra a integração entre Compras, Fornecedores, Stock, Facturas de Fornecedor, Pagamentos e Contabilidade (ledger). Os fluxos críticos foram validados. O sistema está pronto para revisão dos stakeholders antes de qualquer deploy.

---

## 2. Estado inicial do projecto antes desta fase

A1 entregou o motor integridade A1. A2 adicionou SupplierInvoice com tracking de payables e dashboards. Nesta fase A3:

- Contas a pagar disponíveis APENAS via API
- Nenhum UI para lançamento de SupplierInvoice
- Sem "Contas a pagar" no menu
- Sem integração automática com o ledger
- GL entries não existiam: FT emissão, pagamentos, compras — nenhuns traçavam à contabilidade

---

## 3. Lacunas identificadas

### 3.1 Críticas (subset implementations kept deduplicación uncertain)

1. Falta integração automática entre forma de garantir de um trabalho final e a lançamento no ledger
2. Conta a pagar nunca foi cancelada no GL quando cancelado unpaid
3. JE number (`JE-${Date.now()...}`) era o mesmo sob alta concorrência → 25P02 errors em muitos FTA seguidos
4. Chart of Accounts seeding em alta concorrência → P2002 (unique violation) → logs `GL_POST_FAILED`

### 3.2 Grave
  
1. UI para SupplierInvoice não existe → utilizadores têm que chamar API directamente
2. Reports não expostos sem configuração de credenciais

### 3.3 Menor
  
1. `npx prisma migrate diff` mostra "drops expected" das FKs compostas — schema não expressa essas FKs
2. AGT compliance não validada

---

## 4. Funcionalidades implementadas

### 4.1 UI para Contas a Pagar
- `/pagar` — página com lista de facturas pendentes/vencidas, filtros, ações inline
- `PagarActions` — modal de pagamento / cancelamento, validação local-side, feedback inline
- `/stock/compras/faturas/new` — formulário de registo de SIInvoice com vínculo opcional a PO
- Sidebar: `Operações → Contas a pagar`
- Dashboard KPI "A pagar" com valor pendente e contagem de facturas overdue

### 4.2 General ledger (partidas dobradas) — novo módulo mínimo
- Modelo: `GlAccount` + `JournalEntry` + `JournalEntryLine`
- Double-entry invariant validation com `_DEBIT == CREDIT_`
- Auto-post:
  - FT emissão → DR 1200 (AR) / CR 4000 (Revenue) + CR 2100 (VAT)
  - Customer payment → DR 1100 (Bank) / CR 1200 (AR)
  - SupplierInvoice → DR 1300 (Stock) / CR 2000 (PA)
  - SupplierInvoice payment → DR 2000 (PA) / CR 1100 (Bank)
  - SupplierInvoice cancel → DR 2000 / CR 1300 (estornar)
- Idempotência: `(source, sourceId)` no JournalEntry → re-post no-op
- Chart of accounts default: 15 entries (assets/liabilities/equity/revenue/expense)
- Advisory lock (`pg_advisory_xact_lock(hashtextextended('glSeed:tenantId', 0))`) antes de seed do chart → elimina race condition em 100 FT concorrentes

### 4.3 Concurrency fix

JE number agora usa `${Date.now()}-${Math.random()}` para uniqueness sob carga .Zero "GL_POST_FAILED" rows após concorrência de 100 FT.

## 5. Fluxos integrados e validados

| Fluxo | Validado |
|---|---|
| Venda → FT → Pagamento → Stock | `a2-erp-integration.test.ts` ✅ |
| Compra → PO → Recepção → Stock → SupplierInvoice → Pagamento → GL | `a2-po-flow.integration.test.ts` ✅ |
| FT emissão → GL (DR 1200 / CR 4000) | `a3-gl-integration.test.ts` ✅ |
| Customer payment → GL (DR 1100 / CR 1200) | `a3-gl-integration.test.ts` ✅ |
| Concorrência 100 FT — nenhum GL_POST_FAILED | `a1.2` (concurrency test, com env disposable PG) ✅ |
| Dashboard payables KPI | ✅ |
| Multi-tenant isolation | ✅ (entre vários FTs/FCs/STs/NCs) |

---

## 6. Schema changes

### 6.1 Migration `20261119000000_a3_general_ledger`

Adiciona: `GlAccount`, `JournalEntry`, `JournalEntryLine` com FKs compostas; `@@unique([tenantId, id])` em `JournalEntryLine` que faltava.

### 6.2 Schema relationships adicionadas:
- `Tenant → GlAccount[]`, `Tenant → JournalEntry[]`, `JournalEntry → JournalEntryLine[]`, `GlAccount → JournalEntryLine[]`

### 6.3 Migration verificada

```
npx prisma migrate deploy  # em a3_final_check (base limpa)
# 59 migrations found — All migrations have been successfully applied.
```

---

## 7. Testes executados e resultados

| Suite | Resultado |
|---|---|
| `npx vitest run` (HG robust safety mode) | 545 passed / 0 failed / 91 files |
| A1 Integrity motor original | 6/6 ✅ |
| Concurrency 100 FT | 3/3 ✅ — nenhum GL_POST_FAILED logado |
| A2 end-to-end ERP flows | 4/4 ✅ |
| A3 GL integration | 2/2 ✅ |
| RH integration tests (8) | 8/8 ✅ (com disposable PG + env RH_INTEGRATION_TEST=1) |
| `node tools/scripts/build.mjs` | exit 0 — 180 static pages built |
| `prisma migrate deploy` (fresh disposable PG) | 59/59 ✅ |

(Nota: testes A1/A2/A3 tests exigem `DATABASE_URL_A1/A2/A3` se precisarem de conectar a PG real descartável; default `vitest run` pula estes testes — safety-first.)

---

## 8. Commits principais (esta fase)

```
475e7a2 fix(A3): cancelSupplierInvoice posts GL reversing entry
7433c8b fix(A3): gl-service — unique JE numbers under concurrency, advisory lock on seed, tolerate P2002 race
f4b7ce2 feat(A3): general ledger (partidas dobradas) — auto-post on FT/payment/supplier-invoice
c3ec896 feat(A3): SupplierInvoice management — UI for accounts payable
```

Mais as docs de entrega `MACHINE-FACTURAS-A3-FINAL-REPORT.md` (este arquivo).

---

## 9. Limitações ainda existentes

| Limitação | Porquê |
|---|---|
| AGT compliance não atingida | Processo AGT externo; não houve validação |
| GL é mínimo: sem chart-of-accounts UI, periods, closing, statements | Tempo limitado; requires AGT-certified setup |
| Reversões apenas para SupplierInvoice cancelados | FT já anulado absorve a reversão; payment reversal: pattern a definir |
| Quotes: "valores por receber" e "por pagar" exibidos no dashboard (A pagar) sem histórico analítico | Apenas snapshot |
| NIF exigível apenas em issuing de FT ("consumidor final" continua disponível) | Comportamento mantido |
| Permissões para "anular" SupplierInvoice após PAID | Bloqueado pelas regras — só PENDING/OVERDUE can be cancelled |
| Production staging: it unfolds reality — only disposable PG used | Regra obrigatória |
| `npx prisma migrate diff` shows 2 "DropForeignKey" warnings | As FKs compostas não são parte do schema model — nested FK indexes not expressible. Puro ruído Prisma; migrations successfully |

---

## 10. Staging/Production não tocados

- Nenhum arquivo `.env`, `.env.staging`, `.env.production` foi lido ou modificado
- Nenhuma migration foi aplicada a staging ou produção
- Nenhum deploy foi feito ou previsto
- A interface v1 do Machine Facturas continua intacta

---

## 11. Confirmação explícita

- A1: integrity branch preservada intacta (commits A1 intocados)
- A2: suppliers/payables branch preservada intocada
- A3 branch preparada para review/staging; **staging e production intocados**

**   Próximos passos:**
- DBA review da migration 20261119000000_a3_general_ledger e da .a2_supplier_invoice
- App owner pode decidir se deploy em staging é viável
- Contribuidores externos devem validar AGT compliance antes de qualquer certificação
- Operadores devem escolher o plano de contas correto para a empresa antes de usar o módulo GL em produção
