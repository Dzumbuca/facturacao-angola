# JWT Revocation — Phase 1H Final Reconciliation Proposal

**Estado:** **BLOCKED** por falta de evidência real de `127.0.0.1:5437/mf_rls_staging`. Proposta condicionada aos dados 5437 ainda não obtidos. Não aplicar migrations, não alterar dados/schema, não integrar NextAuth.

## Fundamentos disponíveis
| Fonte | Tipo | Limite |
|---|---|---|
| 1F diff/relatório | Lab/proxy estrutural | Não confirma dados/estado real 5437. |
| 1G decisões/semântica sintética | Synthetic/lab | Não confirma comportamento com dados reais. |
| 1H preflight | Real 5437 (apenas tentativa de ligação) | Ligação falhou; Fases B–G **NOT EXECUTED**. |

## Classificação global dos itens 1G (pendente de 5437)
| Item | Classificação actual |
|---|---|
| `StockMovement_tenantId_fkey` ON DELETE/semântica | **DECISION REQUIRED + NOT PROVEN** (dados 5437) |
| `Warehouse_tenantId_fkey` ON DELETE/semântica | **DECISION REQUIRED + NOT PROVEN** |
| 8 índices drop | **NOT PROVEN / DECISION REQUIRED** |
| 22 índices create | **NOT PROVEN** (benefício/pré-requisitos) |
| 9 FKs propostas | **NOT PROVEN** (órfãos/pré-requisitos) |
| 1 rename FK | **NOT PROVEN** (impacto operacional) |
| `Product_tenantId_barcode_key` | **DECISION REQUIRED + NOT PROVEN** |
| `BusinessDocument_tenantId_type_number_key` | **DECISION REQUIRED + NOT PROVEN** |
| `AuthJwtRevocation` staging | **NOT PROVEN** |
| `_prisma_migrations` | **NOT PROVEN / DECISION REQUIRED** |

## A. Alterações seguras/aditivas (após validação 5437 e autorização)
- Validar órfãos/pré-requisitos com `SELECT` read-only; só então considerar FKs aditivas (`NOT VALID`/validação controlada) se autorizado.
- Criar índices aditivos idempotentes apenas com evidência de uso/benefício e sem conflito semântico.
- AJR/VULN-1/VULN-2: aplicar apenas se 5437 confirmar ausência/incompletude e houver autorização formal; nunca inferir por PASS lab.

## B. Exigem alteração do schema Prisma oficial
- Representar `Product_tenantId_barcode_key` segundo decisão (partial `WHERE barcode IS NOT NULL` / normalização / obrigatório).
- Representar unicidade `BusinessDocument` (`tenantId,type,number` vs `tenantId,number`) segundo regra de negócio.
- Representar `ON DELETE` final de `StockMovement_tenantId_fkey` e `Warehouse_tenantId_fkey`.

## C. Exigem migrations oficiais
- Toda alteração de schema/índices/FKs/policies em ambiente oficial: migration controlada, autorização, backup/rollback, janela, validação pós-migração. Sem `db push`/`migrate dev`/`reset`/`resolve` não autorizado.

## D. Exigem decisão de negócio
- Numeração documental: independente por tipo (A) vs global por tenant (B) vs outra (C).
- Barcode: vazio→NULL/obrigatório/normalização/parcial.
- Cascata tenant: `CASCADE` vs `RESTRICT` vs processo controlado.

## E. Podem causar perda de dados / risco alto
- Recriar FKs com `CASCADE` sem validar dependências reais.
- Alterar unicidade documental com colisões existentes.
- Tornar barcode unique normal com vazios/duplicados.
- Dropar índices sem evidência de substituição/baixo risco de query/performance.

## Sequência após desbloqueio
1. Credenciais READ-ONLY 5437 → executar 1H Fases B–G.
2. Matriz: evidência real 5437 → decisão → migration candidata.
3. Validar candidatos em 5440 com dados sintéticos representativos (sem copiar dados sensíveis desnecessários).
4. Autorização formal antes de qualquer alteração oficial.
