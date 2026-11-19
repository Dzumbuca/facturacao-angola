# Auditoria do Código Existente — B1 v0.6
## Calendário Laboral — Machine RH

## 1. Escopo

Leitura dos ficheiros de código relevantes. **Sem alterações.**

## 2. Alterações v0.5 → v0.6

| # | Item | v0.5 | v0.6 |
|---|---|---|---|
| 1 | Competências institucionais | "MAPTSS/AGT/MAPT Território" | **MAPTSS/IGT/adv. Angola**; AGT apenas fiscal |
| 2 | Snapshot — quantos campos | 7 explícitos + 1 implícito | **8 elementos exactos** |
| 3 | Status do snapshot | único `status` | **`status`** (snapshot global) + **`legalValidation`** (por regra) |
| 4 | Assinatura `getHolidaysForMonth` | `(period, tenant, region)` | **`(period, territoryContext?)`** |
| 5 | Setembro 2026 dias úteis | 20 (correct) | **20** confirmado autonomously |
| 6 | Testes snapshot | 7 testes | **8 testes exactos** |
| 7 | 4 camadas conceptuais | não explícitas | **explícitas com correspondência às 8 categorias técnicas** |

## 3. Código existente — inalterado

| Ficheiro | Estado |
|---|---|
| `src/lib/rh-payroll.ts` (`businessDaysInMonth`, `expectedHoursPerDay`, `workedHoursPerDay`) | inalterado |
| `src/app/api/rh/payroll/runs/route.ts` (`rangeStart`/`rangeEnd`, `−3_600_000`) | inalterado |
| `src/components/rh/payroll-manager.tsx` | inalterado |
| `prisma/schema.prisma` | inalterado |

## 4. Riscos técnicos identificados (actualizado)

- Compatibilidade papel negócio-unidade: ainda existe `RhShift.nightPremiumPercent` em `RhShift` — não é o mesmo que adicional nocturno (art. 182.º). Em fase B3/B5 deverá ser distinguido.
- snapshot `RhPayslip.lines` não inclui estado de calendário por enquanto.
- `RhLeaveRequest` não tem aspectos necessários para fases B4.

## 5. Etapa A — inalterado

| Verificação | Estado |
|---|---|
| OFICIAL com ruleset PENDENTE → 403 | intacto |
| SIMULAÇÃO sem persistência | intacto |
| snapshot `lines` preservado | intacto |
| patch CALC→APROVADO bloqueia PENDENTE | intacto |

## 6. Status

- Nenhum ficheiro `src/` alterado
- Nenhum schema.prisma alterado
- Nenhuma migration
- Nenhum commit/merge/deploy

## Histórico de alterações

| Versão | Data | Descrição |
|---|---|---|
| v0.3 | 2026-11-15 | redacção Lei 11/18 |
| v0.4 | 2026-11-15 | 4 camadas, exclusões 24/31 dez |
| v0.5 | 2026-11-15 | **Competências institucionais; snapshot 8 elementos; assinatura `territoryContext`; Setembro 2026 confirmed; 4 camadas conceptuais mapeadas às 8 categorias técnicas** |
