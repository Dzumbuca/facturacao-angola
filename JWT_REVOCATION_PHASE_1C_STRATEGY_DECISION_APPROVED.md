# JWT REVOCATION — PHASE 1C STRATEGY DECISION (APPROVED)

## 1. Resumo executivo

Estado: BLOCKED — execução não autorizada.

Estratégia arquitectural preferida: A — Baseline controlado do schema actual.

Estratégia alternativa: C — Aplicação isolada e controlada da migration JWT.

A estratégia B — Reconciliação individual das migrations existentes — não é recomendada com as evidências disponíveis.

Esta decisão é baseada no diagnóstico fornecido pela Fase 1B. A validação independente do repositório e da base de dados permanece NOT EXECUTED.

## 2. Diagnóstico herdado

Ambiente:

* PostgreSQL 17.
* 127.0.0.1:5437.
* mf_rls_staging.
* 51 tabelas.
* RLS activo em 47 tabelas.
* Quatro tabelas de autenticação sem RLS.

Problemas:

* public._prisma_migrations inexistente.
* 24 migrations identificadas pelo Prisma como não aplicadas.
* Divergências entre migrations históricas e schema real.
* Estruturas RLS, roles e grants específicos da staging.

A causa original da ausência de _prisma_migrations continua NOT PROVEN.

## 3. Comparação das estratégias

### A — Baseline controlado

Vantagens:

* Estabelece uma referência coerente.
* Facilita futuras migrations.
* Permite documentar o estado actual.
* Evita marcar migrations antigas como aplicadas sem provas.

Riscos:

* Exige reconstrução rigorosa do schema.
* Pode perder configurações personalizadas se RLS, roles e grants forem omitidos.
* Um baseline incompleto perpetuaria o drift.

Decisão: RECOMENDADA, condicionada a inventário integral e testes numa cópia descartável.

### B — Reconciliação individual

Vantagens:

* Preserva a cadeia histórica original, caso exista evidência suficiente.
* Mantém a organização cronológica das migrations.

Riscos:

* Várias migrations apresentam colunas ausentes ou divergentes.
* Existência de tabelas não prova aplicação integral de uma migration.
* Registar migrations incorrectamente como aplicadas pode ocultar divergências.

Decisão: NÃO RECOMENDADA com as evidências actuais.

### C — Aplicação isolada

Vantagens:

* Limita o âmbito da intervenção.
* A migration JWT foi concebida como aditiva.
* Evita reconstruir imediatamente o histórico.

Riscos:

* Mantém o problema de Prisma Migrate.
* Introduz mais uma alteração fora do histórico formal.
* Exige rastreabilidade própria.
* Não resolve a compatibilidade das migrations futuras.

Decisão: ALTERNATIVA TEMPORÁRIA, sujeita a autorização específica e validação técnica.

## 4. Matriz de risco

| Critério                 | A                             | B     | C           |
| ------------------------ | ----------------------------- | ----- | ----------- |
| Integridade dos dados    | MÉDIO                         | ALTO  | BAIXO/MÉDIO |
| Preservação do histórico | MÉDIO                         | ALTO  | ALTO        |
| Compatibilidade futura   | BAIXO, após validação         | MÉDIO | ALTO        |
| Risco de drift           | BAIXO, após baseline completo | ALTO  | MÉDIO/ALTO  |
| Complexidade             | ALTA                          | ALTA  | BAIXA/MÉDIA |
| Auditabilidade           | ALTA                          | MÉDIA | MÉDIA       |

As classificações são avaliações arquitecturais preliminares, não resultados de testes.

## 5. Plano recomendado

1. Inventariar integralmente o schema actual.
2. Extrair uma representação fiel do PostgreSQL.
3. Comparar com prisma/schema.prisma.
4. Inventariar policies, roles, grants, triggers e funções.
5. Identificar todas as divergências.
6. Preparar baseline numa cópia descartável.
7. Reproduzir a estrutura completa.
8. Testar migrations futuras nessa cópia.
9. Executar testes RLS e isolamento multi-tenant.
10. Apresentar plano de execução e recuperação.
11. Aguardar autorização específica para intervir na staging.

## 6. Plano de recuperação

Antes de qualquer execução futura:

* Backup externo verificável.
* Verificação de integridade do backup.
* Inventário pré-execução.
* Registo do estado de migrations.
* Plano de recuperação testado.
* Comparação pós-execução.

Não presumir que uma operação de rollback SQL recupera automaticamente dados ou estados anteriores.

## 7. Critérios de aceitação

* Schema integralmente documentado.
* Ausência de divergências não explicadas.
* RLS e policies preservadas.
* Roles e grants documentados.
* Testes de isolamento aprovados.
* Baseline reproduzível numa cópia descartável.
* Migrations futuras testadas.
* Plano de recuperação aprovado.

## 8. Decisão final

Estratégia preferida: A.

Estratégia alternativa: C.

Estratégia B: rejeitada com as evidências disponíveis.

Execução: BLOCKED.

NOT EXECUTED:

* Baseline.
* Reconciliação.
* Aplicação isolada.
* Escritas na staging.
* Testes de recuperação.

NOT PROVEN:

* Causa da ausência do histórico Prisma.
* Equivalência integral entre migrations e schema.
* Reprodutibilidade integral do baseline.

Nenhuma alteração em produção autorizada.

Aguardar autorização explícita para a fase seguinte.
