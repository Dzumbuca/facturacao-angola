# MACHINE FACTURAS — FASE A10
## Encerramento contabilístico real, transporte de saldos e exportações

**Branch:** `feat/machine-facturas-a10-accounting-finalization`
**Origem:** `feat/machine-facturas-a9-accounting-consolidation` (HEAD `d00d399`)
**Data:** 2026-11-17
**Ambiente:** PostgreSQL 18.6 descartável em `127.0.0.1:55432` (`a10_test`).
**Staging / produção / Supabase:** nunca tocados.

---

## 1. Resultado final

**A10 PARTIALLY COMPLETE.**

Entregas (significativas):
1. **Apuramento do resultado anual real** — `apurarResultado` agrega `REVENUE`/`EXPENSE` em lançamentos POSTED dentro do intervalo do exercício, gera exactamente UM lançamento CLOSING idempotente com `source='EXERCISE_CLOSE'`, marca o exercício CLOSED.
2. **Abertura automática do próximo exercício** — `abrirProximoExercicio` cria o exercício seguinte, transporta apenas saldos patrimoniais (ASSET/LIABILITY/EQUITY), nunca REVENUE/EXPENSE (apurados no fecho). Idempotente por construção; isolado por tenant.
3. **UI funcional aplicada** — `/contabilidade/exercicios` agora tem botões que chamam as server actions reais e exibe feedback (notadamente alertas de erro e mensagem de sucesso).
4. **Exportações CSV** — `/api/contabilidade/export?type={razao|balancete|diario}` com isolamento tenant; links nos ecrãs; conteúdo é o mesmo dos dados da página.
5. **Testes de integração** — 2 novos testes comprovam idempotência (apurar uma ou duas vezes produz exactamente 1 JE; abrir uma ou duas vezes produz 1 OPENING JE, nunca duplica).

Lacunas que impedem COMPLETE:
- Exportação PDF/Excel não implementada (apenas CSV) — exige pelo menos PDF generation real com pdfkit/exceljs já nas dependências mas não integrado
- Statements continuam estimativas sem certificação AGT
- Em 200 concurrent FTs permanecem 3 falhas P2028 (pool default — documentado)
- Abertura não tem pré-validação completa (verifica apenas um período); transporte falha silenciosamente quando não há contas patrimoniais (existe mas com configuração simplista)
- Notas de crédito não têm estorno REVALIDATE por período especial — apesar de funcionar via `issueCreditNote → postCreditNoteToGL` (A6 ficou estável)

## 2. Implementação

### 2.1 Apuramento — `src/lib/gl-exercise-closing.ts`

`apurarResultado(tenantId, year, closedBy, justification)`:

- Carrega exercício; se já CLOSED, devolve no-op (zero entradas criadas)
- Verifica períodos abertos; se existirem, recusa com mensagem indicando quantidade
- Agrega contas REVENUE e EXPENSE com `status=POSTED` no intervalo do exercício
- Calcula saldo líquido subtraindo débito de receita vs crédito de despesa
- Escolhe a primeira conta EQUITY activa como destino do resultado
- Cria `JournalEntry` com `source='EXERCISE_CLOSE'`, `sourceId=exerciseId`, número reservado por `reserveJournalEntryNumberOnTx`
- Marca exercício `state='CLOSED'`, `closedAt`, `closedBy`

`abrirProximoExercicio(tenantId, nextYear, justification, closedBy)`:

- Garante que exercício anterior existe e está CLOSED
- Cria próximo exercício se não existir; garante 12 períodos mensais
- Verifica se já há um OPENING entry (`source='EXERCISE_OPEN'`) — se sim devolve sem duplicação
- Agrega saldos patrimoniais no `postedOnDate <= fim do exercício anterior`
- Cria OPENING entry com as linhas (DR ou CR consoante natureza da conta) ligadas ao novo exercício

### 2.2 UI — `/contabilidade/exercicios`

- Server-rendered com exercise card de estado; bloqueadores listados; botão "Apurar resultados e encerrar" ou "Abrir exercício {year+1}" consoante estado actual
- Justificação obrigatória; prompt para novos exercícios com confirmação; botões não são meramente visuais

### 2.3 CSV exports — `/api/contabilidade/export?type=...`

Tipos: `razao` (accountCode + exerciseCode opcionais), `balancete`, `diario`. Sem cross-tenant leakage — query filtered by `tenantId` from `getSessionTenantId()`. Cabeçalho com empresa/data/tipo; dados persistentes.

### 2.4 Schema fix

Acrescentou-se `synthetic Boolean @default(false)` e `nature String?` ao modelo `GlAccount` para alinhar com a coluna já existente na migração A4; utilisando `prisma generate` garante tipos actualizados.

## 3. Testes

| Suite | Resultado |
|---|---|
| `npx vitest run` (full, disposable PG) | **545 passed / 8 skipped** |
| A10 integration: apurar 2x | ✅ idempotência garantida (1 EXERCISE_CLOSE JE) |
| A10 integration: abrir próximo | ✅ idempotência OPENING (1 JE) |
| A1/A2/A3/A4/A6 regression | ✅ |
| A8 100 concurrent FT | ✅ 100/100 |
| `node tools/scripts/build.mjs` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| ESLint (warnings only) | sem erros |
| Migrations em PG fresco | 61/61 OK |

## 4. Commits A10

```
e67b33f feat(A10): CSV exports for Diário, Razão and Balancete
be26d04 feat(A10): exercise apuramento + opening + balance transport — tested idempotent
```

Total: 2 (sem contar scripts em arquivos de trabalho não committados).

## 5. Limitações honestas

| Item | Porque |
|---|---|
| Exportações PDF/Excel | Não entregue; infraestrutura `exceljs`/`pdfkit` disponível mas não integrada |
| Contas transitadas mais robustas | Apenas primeira EQUITY é usada (não há config por tenant) |
| Abertura: transporta só ASSET/LIABILITY/EQUITY; trata REVENUE/EXPENSE via apuramento | Não transporta resultados como RETAINED EARNINGS |
| 200 concurrent P2028 | Não resolvido pela pool default PG |
| Statements sem certificação | AGT compliance requer contabilista; não declarável |
| Geração do número do JE OPENING não idempotente em caso de retry no segundo passo | Trait de todas as JE reserveJournalEntryNumberOnTx com advisory lock torna duplicável apenas se retry se declarar fora do mesmo fluxo de transaction — mas defeito controlado neste caso. |

## 6. Staging/Production/Supabase não tocados

- Apenas PG descartável `a10_test` utilizado
- Nenhuma migração fora dele
- Nenhuma alteração em `.env*`

## 7. Verdicto

**A10 PARTIALLY COMPLETE.**

A arquitectura A10 entrega um ciclo fiscal real — lançamento → apuramento → encerramento → abertura — com idempotência e isolamento multi-tenant provados por testes. Mas falta:

- Exportações profissionais (PDF/Excel)
- Statements com certificação
- Transporte automático de resultados para conta seleccionada pelo contabilista
- 200+ concurrent FTs sem P2028 — ainda limitado pelo PG default

**Eu não declaro A10 COMPLETE.**
