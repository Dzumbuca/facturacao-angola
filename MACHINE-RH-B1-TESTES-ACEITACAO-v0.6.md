# Testes de Aceitação — B1 v0.6
## Calendário Laboral e Feriados — Machine RH

> Estados: **CONFIRMADO** | **CONFIRMADO COM CONDIÇÕES** | **PENDENTE** | **BLOQUEADO** | **N/A**
>
> Identificador: `B1v6-T-###`

> **Alteração em relação a v0.5:** Junho 2026 = **22 dias úteis** (verificado autonomamente); mês correcto corrigido. Os identificadores `B1v5-T-###` permanecem inalterados por rastreabilidade.

---

## 1. Calendário 2026 — valores base (independentemente verificados)

| ID | Cenário | Entrada | Resultado | Fundamento | Estado |
|---|---|---|---|---|---|
| B1v5-T-001 | Dias úteis Janeiro 2026 | Y=2026 M=01 | **20** | Lei 11/18 art. 6.º | CONFIRMADO |
| B1v5-T-002 | Dias úteis Fevereiro 2026 | Y=2026 M=02 | **17** | Lei 11/18 art. 6.º | CONFIRMADO |
| B1v5-T-003 | Dias úteis Março 2026 | Y=2026 M=03 | **21** | Lei 11/18 art. 2.º | CONFIRMADO |
| B1v5-T-004 | Dias úteis Abril 2026 | Y=2026 M=04 | **21** | Lei 11/18 art. 2.º | CONFIRMADO |
| B1v5-T-005 | Dias úteis Maio 2026 | Y=2026 M=05 | **20** | Lei 11/18 art. 2.º | CONFIRMADO |
| B1v5-T-006 | Dias úteis Junho 2026 | Y=2026 M=06 | **22** | — | CONFIRMADO |
| B1v5-T-007 | Dias úteis Julho 2026 | Y=2026 M=07 | 23 | — | CONFIRMADO |
| B1v5-T-008 | Dias úteis Agosto 2026 | Y=2026 M=08 | 21 | — | CONFIRMADO |
| B1v5-T-009 | Dias úteis Setembro 2026 | Y=2026 M=09 | **20** | Lei 11/18 art. 6.º | CONFIRMADO |
| B1v5-T-010 | Dias úteis Outubro 2026 | Y=2026 M=10 | 22 | — | CONFIRMADO |
| B1v5-T-011 | Dias úteis Novembro 2026 | Y=2026 M=11 | **19** | — | CONFIRMADO |
| B1v5-T-012 | Dias úteis Dezembro 2026 | Y=2026 M=12 | **22** | Lei 11/18 art. 2.º | CONFIRMADO |

**Setembro de 2026 = 20 dias úteis** — confirmado autonomamente; inclui 17 Set (feriado nacional) e 18 Set (ponte); sábados e domingos não contam.

---

## 2. Feriados nacionais

(Idêntico.)

| ID | Cenário | Resultado | Estado |
|---|---|---|---|
| B1v5-T-020 a T-031 | 12 feriados nacionais | identificação | CONFIRMADO |

---

## 3. Datas comemorativas

(Idêntico.)

| ID | Cenário | Resultado | Estado |
|---|---|---|---|
| B1v5-T-032 a T-039 | 8 datas comemorativas | `isHoliday=false` | CONFIRMADO |

---

## 4. Vésperas 24 e 31 dez

| ID | Cenário | Resultado | Fundamento | Estado |
|---|---|---|---|---|
| B1v5-T-040 | 24 Dez — regime normal | `suspendedAfter1230=true` | Lei 12/23 art. 199.º | CONFIRMADO |
| B1v5-T-041 | 24 Dez — horário 08h-22h | `suspendedAfter1230=true` | Lei 12/23 art. 199.º | CONFIRMADO |
| B1v5-T-042 | 24 Dez — funcionamento contínuo | `suspended=false` | Lei 12/23 art. 199.º n.º 2 | CONFIRMADO |
| B1v5-T-043 | 31 Dez — regime normal | `suspendedAfter1230=true` | Lei 12/23 art. 199.º | CONFIRMADO |
| B1v5-T-044 | 31 Dez — funcionamento contínuo | `suspended=false` | Lei 12/23 art. 199.º n.º 2 | CONFIRMADO |
| B1v5-T-045 | 24 Dez — turnos | **PENDENTE** | Lei 12/23 art. 199.º n.º 2 | PENDENTE DE INTERPRETAÇÃO JURÍDICA |

---

## 5. Tolerância de ponto

(Idêntico)

| ID | Cenário | Resultado | Estado |
|---|---|---|---|
| B1v5-T-050..T-054 | Se decretar, suspensão; não é feriado | suspensão só do território | CONFIRMADO COM CONDIÇÕES |

---

## 6. Feriados locais — identificação por estabelecimento

| ID | Cenário | Resultado | Estado |
|---|---|---|---|
| B1v5-T-060 | Estabelecimento em Maianga | aplica-feira feriado Maianga | CONFIRMADO |
| B1v5-T-061 | Estabelecimento em Zango | aplica outro feriado local se existir | CONFIRMADO COM CONDIÇÕES |
| B1v5-T-062 | Tenant em Luanda tem Maianga | aplica Maianga | CONFIRMADO |
| B1v5-T-063 | Tenant em Luanda também estabelece em Cazenga | aplica Cazenga nesse estabelecimento | CONFIRMADO COM CONDIÇÕES |
| B1v5-T-064 | Local_externo sem feriado | nenhuma feriado local | PENDENTE DE INTERPRETAÇÃO JURÍDICA |

---

## 7. Setembro 2026 — cross-validation

| ID | Cenário | Contagem | Estado |
|---|---|---|---|
| B1v5-T-070 | Y=2026, M=09 com 17 Set feriado + 18 Set ponte | 20 dias úteis | CONFIRMADO |
| B1v5-T-071 | Y=2026, M=01 com 1 Jan feriado + 2 Jan ponte | 20 dias úteis | CONFIRMADO |
| B1v5-T-072 | Y=2026, M=02 com 4 Feb feriado + 17 Fev Carnaval + 16 Fev ponte | 17 dias úteis | CONFIRMADO |
| B1v5-T-073 | Y=2026, M=03 com 23 Mar feriado | 21 dias úteis | CONFIRMADO |
| B1v5-T-074 | Y=2026, M=04 com 3 Abr Sexta-Feira Santa | 21 dias úteis | CONFIRMADO |
| B1v5-T-075 | Y=2026, M=05 com 1 Mai feriado | 20 dias úteis | CONFIRMADO |
| B1v5-T-076 | Y=2026, M=11 com 2 Nov + 11 Nov | 19 dias úteis | CONFIRMADO |
| B1v5-T-077 | Y=2026, M=12 com 25 Dez feriado | 22 dias úteis | CONFIRMADO |

---

## 8. Snapshot — verificação dos oito campos

| ID | Cenário | Resultado | Estado |
|---|---|---|---|
| B1v5-T-080 | `syntheticVersion` presente e válido | número inteiro ≥1 | CONFIRMADO |
| B1v5-T-081 | `generatedAt` ISO 8601 válido | timestamp | CONFIRMADO |
| B1v5-T-082 | `yearOfReference` = 2026 | número 2026 | CONFIRMADO |
| B1v5-T-083 | `calendarEngineVersion` presente | versão string | CONFIRMADO |
| B1v5-T-084 | `appliedRules` é array não-vazio com source | array; cada item com `source` legal | CONFIRMADO |
| B1v5-T-085 | `territory` presente e contém contexto | objeto territoryContext | CONFIRMADO |
| B1v5-T-086 | `status` presente | identificador VALIDADO ou PENDENTE | CONFIRMADO |
| B1v5-T-087 | `legalValidation` presente com VALIDADO/PENDENTE por regra | array com legalStatus por regra | CONFIRMADO |

---

## 9. Reconstrução da classificação

| ID | Cenário | Resultado | Estado |
|---|---|---|---|
| B1v5-T-090 | Reconstruir por que razão 2026-04-03 foi Sexta-Feira Santa | regra `NATIONAL_HOLIDAY` por `Lei n.º 11/18 art. 2.º g)` | CONFIRMADO |
| B1v5-T-091 | Reconstruir por que razão 2026-09-18 foi ponte | regra `PONTE` por `Lei n.º 11/18 art. 6.º n.º 1` | CONFIRMADO |
| B1v5-T-092 | Reconstruir status jurídico de cada regra | usando `legalValidation[]` | CONFIRMADO |

---

## Pendências jurídicas (consistentes em todos os documentos)

| ID | Questão | Estado |
|---|---|---|
| B1v5-T-1xx | «Semana que antecede a ponte» — definição operacional | **PENDENTE DE INTERPRETAÇÃO JURÍDICA** (MAPTSS/IGT/adv. Angola) |
| B1v5-T-1xx+1 | Aplicação de ponte a turnos contínuos | **PENDENTE DE INTERPRETAÇÃO JURÍDICA** |
| B1v5-T-1xx+2 | Aplicação de 1h30 a turnos | **PENDENTE DE INTERPRETAÇÃO JURÍDICA** |
| B1v5-T-1xx+3 | Aplicação de 12h30 (véspera) a turnos | **PENDENTE DE INTERPRETAÇÃO JURÍDICA** |

---

## Histórico de alterações

| Versão | Data | Descrição |
|---|---|---|
| v0.3 | 2026-11-15 | redacção Lei 11/18 |
| v0.4 | 2026-11-15 | vésperas 24/31 dez por regime |
| v0.5 | 2026-11-15 | **Setembro 2026 = 20 confirmado; snapshot com 8 campos completos e verificáveis; competências institucionais corrigidas (AGT removido de questões laborais)** |
