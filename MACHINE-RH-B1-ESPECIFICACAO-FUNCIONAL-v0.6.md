# Especificação Funcional — Etapa B1 v0.6
## Calendário Laboral e Feriados — Machine RH

| Campo | Valor |
|---|---|
| Versão | v0.6 |
| Data | 2026-11-15 |
| Projecto | Machine RH |
| Estado | Documental exclusivamente — NÃO implementar |
| Base | v0.6 (especificação Etapa B); v0.7 (auditoria complementar); v0.4 (revisão anterior) |

---

## 1. Sumário normativo

| Diploma | Aplica-se | Artigo-chave |
|---|---|---|
| Lei n.º 12/23 de 27 de Dezembro | Lei Geral do Trabalho | `art. 179.º–182.º`; `art. 199.º` (interrupção 24/31 dez) |
| Lei n.º 10/11 de 16 de Fevereiro | Lei dos Feriados | `art. 2.º, 3.º, 4.º, 5.º, 6.º, 7.º, 8.º` |
| Lei n.º 11/18 de 28 de Setembro | Alteração da Lei n.º 10/11 | `art. 2.º, 3.º, 6.º` (redacção de substituição) |
| Decreto Presidencial n.º 50/25 de 19 de Fevereiro | Contra-ordenações | — |
| Rectificação n.º 2/24 de 1 de Março | Rectifica LGT | `art. 16.º, 34.º, 55.º, 151.º, 303.º, 304.º` |

**Autoridades competentes para validação jurídica das regras laborais:**
- **MAPTSS** — Ministério da Administração Pública, Trabalho e Segurança Social;
- **IGT** — Inspecção Geral do Trabalho;
- **Advogado especializado em legislação laboral angolana**.

A **AGT** é autoridade fiscal e tributária. **Não valida interpretação da legislação laboral.**

---

## 2. Terminologia

- **Interrupção parcial da actividade laboral** — expressão correcta para a interrupção da actividade laboral a partir das 12h30 em 24 e 31 de Dezembro.
- **Feriado nacional** — categorias do art. 2.º da Lei n.º 10/11 (na redacção da Lei n.º 11/18).
- **Data de celebração nacional** — categorias do art. 3.º; não é feriado; não suspende actividade.
- **Feriado local** — categorias do art. 4.º; suspende apenas serviços administrativos municipais.
- **Tolerância de ponto** — suspensão decretada por Decreto Governamental ou da Autoridade competente; não é feriado.
- **Ponte** — suspensão decretada pelo fenómeno de feriado nacional em Terça/Quinta (Lei n.º 11/18, art. 6.º).

---

## 3. Texto consolidado — artigo 6.º da Lei n.º 11/18

> «ARTIGO 6.º» (Ponte)
>
> 1. Quando o dia de feriado nacional coincidir com o dia de Terça ou Quinta-feira, há lugar à suspensão da actividade laboral no dia útil anterior ou no dia imediatamente a seguir, respectivamente, Segunda ou Sexta-feira.
>
> 2. A suspensão da actividade laboral nos dias referidos no número anterior dá lugar a denominada «Ponte».
>
> 3. Na semana que anteceder a ponte é acrescida uma hora e meia diária no período normal de trabalho.

**Interpretação da expressão «semana que anteceder a ponte» — PENDENTE DE VALIDAÇÃO JURÍDICA** consistente em todas as versões dos cinco documentos. **Não** presumir uma definição operacional;** não** aplicar automaticamente a qualquer categoria de trabalhadores;** aguardar** confirmação documental do MAPTSS/IGT ou parecer jurídico.

---

## 4. Quatro camadas conceptuais — agrupam oito categorias técnicas

### 4.1. Correspondência

| Camada conceptual | Categorias técnicas |
|---|---|
| Nacional | L1 — Calendário Nacional; L2 — Datas Comemorativas |
| Territorial | L3 — Calendário Territorial |
| Operacional | L4 — Calendário Operacional; L6 — Tolerância de Ponto; L7 — Vésperas; L8 — Pontes |
| Individual | L5 — Escala Individual |

---

## 5. Calendário 2026 — valores base

(Conteúdo inalterado — confirmações específicas por cálculo autónomo em 2026-11-15.)

| Data 2026 | Dia da semana | Feriado nacional | Ponte |
|---|---|---|---|
| **2026-01-01** | Qui | Ano Novo | **2026-01-02 (Sex)** |
| 2026-02-04 | Qua | Luta Armada | não |
| **2026-02-17** | Ter | Carnaval | **2026-02-16 (Seg)** |
| 2026-03-08 | Dom | Mulher | não |
| 2026-03-23 | Seg | AF Austral | não |
| 2026-04-03 | Sex | Sexta-Feira Santa | não |
| 2026-04-04 | Sáb | Paz | não |
| 2026-05-01 | Sex | Trabalhador | não |
| **2026-09-17** | Qui | Herói Nacional | **2026-09-18 (Sex)** |
| 2026-11-02 | Seg | Finados | não |
| 2026-11-11 | Qua | Independência | não |
| 2026-12-25 | Sex | Natal | não |

**Pontes 2026:** 2026-01-02 (Sex), 2026-02-16 (Seg), 2026-09-18 (Sex).

### 5.1. Dias úteis

| Mês | Weekdays | Com feriados+pontes | Dias úteis |
|---|---|---|---|
| Janeiro | 22 | 2 | **20** |
| Fevereiro | 20 | 3 | **17** |
| Março | 22 | 1 | **21** |
| Abril | 22 | 1 | **21** |
| Maio | 21 | 1 | **20** |
| Junho | 22 | 0 | 22 |
| Julho | 23 | 0 | 23 |
| Agosto | 21 | 0 | 21 |
| Setembro | 22 | 2 | **20** |
| Outubro | 22 | 0 | 22 |
| Novembro | 21 | 2 | **19** |
| Dezembro | 23 | 1 | **22** |

---

## 6. Territorialidade — rubrica única

**Feriados locais não dependem do tenant; dependem do território de prestação de trabalho do estabelecimento.**

Eixos territoriais:
- **Província**;
- **Município/cidade**;
- **Estabelecimento**;
- **Local de prestação de trabalho**.

Mesmo tenant com vários estabelecimentos em municípios diferentes → calendários territoriais diferentes por estabelecimento.

Calendário nacional: independente de tenant e independente de território.
Calendário operacional da empresa: válido para todo o tenant.
Calendário territorial: aplicável por estabelecimento (não por tenant).
Calendário nacional + territorial: combinados pelo motor para produzir o calendário do estabelecimento.

---

## 7. Tolerâncias de ponto (Lei n.º 10/11 art. 5.º)

- Decreto do **Titular do Poder Executivo** OU Decreto de **Governo Provincial** dentro da sua competência legal.
- Suspensão em parte ou todo o território; em horário total ou parcial; em sectores específicos ou em todos.
- Não é feriado.

## 8. Vésperas de 24 e 31 de Dezembro — Interrupção parcial (Lei n.º 12/23 art. 199.º n.º 2)

- **Regime normal** — Interrupção parcial a partir das 12h30.
- **Funcionamento contínuo** — Excluído pela própria Lei (art. 199.º, n.º 2).
- **Trabalho em turnos** — **PENDENTE DE VALIDAÇÃO JURÍDICA**.

## 9. Quatro camadas conceptuais — precedência técnica

1. Nacional — não pode ser desactivada por iniciativa local;
2. Territorial — aplicada conforme território do estabelecimento;
3. Operacional — regras da empresa/estabelecimento;
4. Escala individual — horário/escala do trabalhador.

**Sem invenção de regra de prevalência jurídica** — conflitos pendentes de validação jurídica.

---

## 10. Snapshot — oito elementos exigidos

1. `syntheticVersion` — versão do formato do snapshot;
2. `generatedAt` — data e hora da geração;
3. `yearOfReference` — ano de referência;
4. `calendarEngineVersion` — versão do motor de calendário;
5. `appliedRules` — regras aplicadas, com identificação e fundamento legal;
6. `territory` — contexto territorial;
7. `status` — estado geral do snapshot;
8. `legalValidation` — estado de validação jurídica de cada regra (com responsável quando uma validação tenha sido feita).

O estado geral do snapshot (`status`) é distinto do estado jurídico de cada regra (`legalValidation`).

---

## 11. Histórico de alterações

| Versão | Data | Descrição |
|---|---|---|
| v0.3 | 2026-11-15 | Primeira versão consolidada com a redacção Lei n.º 11/18 art. 6.º |
| v0.4 | 2026-11-15 | Vésperas 24/31 dez com exclusões; territorialidade; tolerância Executive/Provincial; terminologia «interrupção parcial» |
| v0.5 | 2026-11-15 | **Camadas conceptuais (4) formalizadas com correspondência às 8 categorias técnicas; snapshot com 8 elementos exactos e distinção `status` vs `legalValidation`; competências institucionais afectadas (MAPTSS/IGT/adv. Angola); assinatura de funções (`getHolidaysForMonth(period, territoryContext)`); inconsistências internas detectadas (Setembro 2026 = 20)** |
| v0.6 | 2026-11-15 | **Junho 2026 = 22 dias úteis** (verificado autonomamente por script independente) |
