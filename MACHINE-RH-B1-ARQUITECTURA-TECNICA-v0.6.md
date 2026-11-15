# Arquitectura Técnica — Etapa B1 v0.6
## Calendário Laboral — Machine RH

**Estado:** Documental. Não implementado.

---

## 1. Competências institucionais (distinção correcção)

**AGT** — fisco/taxaship; não valida legislação laboral.
**MAPTSS** — órgão sancionador e regulamentar.
**IGT** — Inspecção Geral do Trabalho.
**Advogado angolano especializado** — indispensável para interpretação jurídica.

---

## 2. Princípios

1. Determinismo;
2. `supersededBy` — versionamento imutável;
3. Africa/Luanda oficial;
4. Separação estrita: nacional / territorial / operacional / individual;
5. Rastreabilidade por evento;
6. Snapshot audit-ready — oito elementos exactos;
7. Multi-tenant apenas ao nível operacional;
8. Funções puras, independentes de produção.

---

## 3. Quatro camadas conceptuais — agrupam oito categorias técnicas

| Camada conceptual | Categorias técnicas |
|---|---|
| Nacional | L1 — Calendário Nacional; L2 — Datas Comemorativas |
| Territorial | L3 — Calendário Territorial |
| Operacional | L4 — Calendário Operacional; L6 — Tolerância de Ponto; L7 — Vésperas; L8 — Pontes |
| Individual | L5 — Escala Individual |

**L2, L6, L7 e L8 não são camadas conceptuais novas.** São elementos/regras técnicas que pertencem a uma camada.

---

## 4. Modelo conceptual (não implementado)

```ts
// Territorial context — input documentation only
type TerritoryContext = {
  province: string;
  municipality: string;
  establishment: string;
  locationOfWork: string;
  sector?: string;
};

CalendarEntry
  id                   uuid
  scope                enum["NATIONAL_HOLIDAY","LOCAL_HOLIDAY","MEMORIAL_DAY","PONTE","TOLERANCIA_PONTO","VESPERA"]
  layer                enum["NATIONAL","TERRITORIAL","OPERATIONAL","INDIVIDUAL"]
  date                 date
  name                 string
  source               string
  sourceDocumentUrl    string?
  legalStatus          string   // estado de validação jurídica desta regra
  sourceVersion        int
  supersededBy         uuid?
  effectiveFrom        date
  effectiveTo          date?
  notes                text
```

---

## 5. Fuso horário Africa/Luanda

```ts
const rangeStart = new Date(`${period}-01T00:00:00+01:00`);
const rangeEnd   = new Date(`${nextMonth}-01T00:00:00+01:00`);
```

| Exemplo | Local | UTC |
|---|---|---|
| 2026-03-01T00:00:00+01:00 | 2026-03-01T00:00:00 | 2026-02-28T23:00:00Z |

**Não usar offset mágico `3_600_000`.**

---

## 6. Determinismo

```ts
computeWorkdayContext(
  date: string,
  employeeId?: string,
  territory?: TerritoryContext
): WorkdayContext
```

Recebe data, posição dos trabalhadores, contexto territorial — **não** acede a `tenantId` implícito. O calendário nacional não depende de tenant. O calendário territorial depende do contexto territorial de um estabelecimento específico. Uma empresa com vários estabelecimentos em municípios diferentes terá calendários diferentes por estabelecimento.

---

## 7. Assinatura conceptual de funções

| Função | Assinatura |
|---|---|
| `getNationalHolidays` | `getNationalHolidays(year: number): CalendarEntry[]` |
| `getHolidaysForMonth` | `getHolidaysForMonth(period: string, territory?: TerritoryContext): CalendarEntry[]` |
| `isHolidayBy` | `isHolidayBy(date: string): CalendarEntry?` |
| `ponteForHoliday` | `ponteForHoliday(date: string): CalendarEntry?` |
| `getMemorialDays` | `getMemorialDays(year: number): CalendarEntry[]` |
| `getOperationalCalendar` | `getOperationalCalendar(establishmentId: string, year: number): CalendarEntry[]` |

**Nunca usar:** `getHolydaysForMonth(period, tenant, region)` — corrigida para `getHolidaysForMonth(period, territoryContext?)`.

---

## 8. Snapshot — oito elementos exigidos

```json
{
  "syntheticVersion": 1,                       // formato de snapshot
  "generatedAt": "2026-11-15T12:00:00Z",      // timestamp
  "yearOfReference": 2026,                     // ano em que as regras estão aceitas
  "calendarEngineVersion": "b1-0.5",           // versão do motor
  "appliedRules": [ ... ],                     // regras efectivamente aplicadas com source:
                                               // { "id":"2026-04-03", "type":"NATIONAL_HOLIDAY", "source":"Lei n.º 11/18 art. 2.º g)", "effective":"YYYY-MM-DD", "legalStatus":"VALIDADO" }
  "territory": {                               // contexto territorial:
    "province": "", "municipality": "", "establishment": "", "locationOfWork": ""
  },
  "status": "VALIDADO",                        // estado geral do snapshot
  "legalValidation": [                         // estado jurídico por regra:
    { "ruleId": "2026-04-03", "status": "VALIDADO", "responsible": "MAPTSS/" }
  ]
}
```

**Distinção:**
- `status` — estado global do snapshot.
- `legalValidation` — estado jurídico de **cada regra** aplicada, com responsável pela validação quando exista. Uma regra **não** deve aparecer como VALIDADA sem evidência documental.

## 9. Reconstrução da classificação

Cada classification de dia de trabalho como "feriado", "ponte", "tolerância", "dia normal" deve poder ser reconstruída a partir dos `appliedRules` e `legalValidation` deste snapshot.

## 10. Limites da B1.1

- Funções determinísticas para feriados nacionais, datas comemorativas, datas móveis, pontes (estrutura, não 1h30 enquanto pendente); geração anual determinística.
- Não altera `rh-payroll.ts`, endpoints, UI, schema.prisma, migrations.
- Não atinge Etapa A.

## 11. Histórico de alterações

| Versão | Data | Descrição |
|---|---|---|
| v0.3 | 2026-11-15 | Primeira |
| v0.4 | 2026-11-15 | 4 camadas separadas |
| v0.5 | 2026-11-15 | **Quatro camadas conceptuais (4 canónicas) com correspondência efectiva às 8 categorias técnicas; snapshot com 8 elementos exactos e `status` distinto de `legalValidation`; competências institucionais alinhadas (MAPTSS/IGT/adv. Angola; AGT apenas fiscais); função `getHolidaysForMonth(period, territoryContext?)` sem argumento tenant; inconsistência de Setembro 2026 (20)** |
