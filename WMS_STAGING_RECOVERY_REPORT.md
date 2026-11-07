# WMS Staging Recovery Report

**Projeto:** facturacao-angola (Machine Facturas)
**Data:** 2026-11-03
**Status:** Staging local não recuperável a partir dos artefactos existentes

---

## 1. Localização da instância original

A instância documentada (PostgreSQL 18.6, 127.0.0.1:5433, database `wms_staging`) **não existe** no ambiente atual.

- Porta 5433: listener é `wslrelay` (WSL2); nenhum PostgreSQL ativo em WSL (`pg_lsclusters` vazio, utilizador `postgres` inexistente).
- Porta 5432: PostgreSQL 18 nativo, mas credenciais desconhecidas (`password authentication failed for user "postgres"`).

## 2. Mecanismo utilizado

Nenhum mecanismo de execução da instância original foi encontrado. O histórico do projeto não contém scripts de arranque, docker-compose ou backup do staging WMS.

## 3. Estado dos volumes e dados

- Volume Docker `facturacao-angola_machine_stock_test_data` (projeto `facturacao-angola`) existe, mas a base de dados associada (`machine_stock_test`) contém um schema antigo — a tabela `ProductWarehouseStock` não existe. Não é o staging WMS v2.
- Container `machine-stock-test-pg` (postgres:17, porta 5437) está removido; apenas o volume persiste.
- Container `erp-postgres` (postgres:17, porta 5433) é uma instância ERP não relacionada (`erp_db`/`erp_user`), não o WMS staging.

## 4. Versão PostgreSQL

- Documentada: 18.6.
- Encontrada em volumes: 17 (postgres:17).
- Nativo Windows: 18.6 (porta 5432, credenciais desconhecidas).

## 5. Database identificada

Nenhuma database `wms_staging` foi encontrada em nenhuma instância acessível. Apenas `machine_stock_test` (schema antigo) e `erp_db` (não relacionado).

## 6. Estado das credenciais

- Credenciais do staging WMS não estão documentadas em nenhum ficheiro (sem passwords/secrets no relatório, conforme regra).
- `.env` → Supabase produção (proibido utilizar).
- `.env.staging` → Supabase staging cloud (não é o staging local documentado).

## 7. Possibilidade de recuperação

**Não é possível recuperar o staging original.** Os dados de teste WMS (2 tenants, 2 produtos, 3 movimentos, 1 PWS) não foram encontrados em nenhum volume ou instância. O único artefacto é a documentação nos relatórios WMS.

## 8. Plano recomendado (caso seja necessário reconstruir staging)

1. Criar uma nova instância PostgreSQL (preferencialmente 18.x) em 127.0.0.1:5433.
2. Criar database `wms_staging` com um utilizador superuser dedicado (credenciais guardadas em ficheiro seguro, não commitado).
3. Aplicar o schema via `prisma migrate deploy` (sem `db push`).
4. Recriar os dados de teste documentados nos relatórios (2 tenants, 2 warehouses, 2 produtos, movimentos, PWS, adjustment, counters) — apenas dados sintéticos de teste, nunca dados reais de clientes.
5. Reaplicar RLS e validações.
6. Verificar isolamento multi-tenant.

**Nenhuma operação de escrita foi executada nesta etapa.** Todos os passos acima requerem autorização explícita antes de execução.

## Resumo

- Prisma Client: regenerado com sucesso (EPERM resolvido).
- Validações: `prisma validate` OK, `tsc --noEmit` OK, `vitest` 249/249 OK.
- Staging WMS: **não recuperável** — instância original inexistente; volume disponível contém schema antigo.
- Aguardo instruções para reconstruir o staging ou fornecer credenciais de uma instância existente.
