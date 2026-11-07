# Supabase Roles and Privileges — Machine Facturas (preparação)

**Fonte:** código Prisma/NextAuth + auditoria read-only em staging/local 127.0.0.1:5436/wms_staging (2026-11-05). **Produção não inspecionada nem alterada.**

## Roles observadas (staging/local)
| Role | Login | Superuser | BYPASSRLS | Create role/DB | Observação |
|---|---:|---:|---:|---:|---|
| staging_admin (current_user/sessão) | true | **true** | **true** | true | Admin/owner local; **inadequado como role de app** |
| non | false | false | false | false | Role API Supabase; sem grants em public no staging |
| uthenticated | false | false | false | false | Role API Supabase; sem grants em public no staging |
| service_role | false | false | false | false | Mantida; USAGE em public no staging |

## Role efetiva da aplicação (Prisma)
- **Código:** 
ew PrismaClient() com DATABASE_URL (src/lib/prisma.ts, prisma/schema.prisma). A role real é a do utilizador da connection string em cada ambiente.
- **Staging auditado:** efetivamente staging_admin (superuser/bypass) — distorce resultados de RLS/FORCE.
- **Produção:** **desconhecida nesta auditoria**; Security Advisor reportou role Prisma com BYPASSRLS — confirmar no alvo antes de qualquer mudança.
- **Target preparado:** role dedicada de aplicação (ex.: pp_user) **NOLOGIN/NOSUPERUSER/NOBYPASSRLS/NOCREATEDB/NOCREATEROLE** (ou LOGIN conforme padrão Supabase/pooler), com grants mínimos necessários, operando sob RLS + pp.tenant_id/app.user_id/app.is_admin via unWithTenant. Migrations podem exigir role separada com privilégios DDL/owner controlados.

## Privilégios (staging, observados)
- **anon/authenticated:** 0 grants em tabelas/colunas/sequências/funções no public; sem USAGE/CREATE em public. Bom sinal local; **confirmar em produção**.
- **Schema public:** owner/uso controlado; service_role com USAGE. Aplicação não usa Supabase Auth/Data API (por arquitetura); manter Data API roles sem acesso a tabelas sensíveis.
- **Default privileges:** staging mostra default EXECUTE para staging_admin; sem defaults para anon/authenticated detectados. prisma/app-user-role.sql assume FOR ROLE postgres — **ajustar ao role owner/migration real no Supabase**.

## Ownership
- Todas as 52 tabelas public (incl. _prisma_migrations) pertencem a staging_admin. Em produção, ownership/superuser/bypass afetam se FORCE RLS é necessário/eficaz e quem pode aplicar DDL.

## Princípio de menor privilégio (proposto)
1. **anon/authenticated (Data API):** sem acesso a tabelas/seq/funções/schema necessários; RLS enabled como defesa em profundidade.
2. **service_role:** acesso apenas quando explicitamente necessário por infraestrutura Supabase confiável; tratar como privilegiado.
3. **Role migração/DDL:** separada, usada apenas em CI/janela controlada; pode precisar ownership/DDL, nunca exposta à app.
4. **Role app Prisma:** DML mínimo nas tabelas necessárias, sem BYPASSRLS/superuser; contexto tenant setado por transação.
5. **Admin plataforma:** preferir caminhos server-side autenticados com checks explícitos + políticas/admin context, não elevar role global da app.
