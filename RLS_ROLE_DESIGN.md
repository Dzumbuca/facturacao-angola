# RLS_ROLE_DESIGN.md — desenho de roles (staging/teste local)

## Princípio
Separar papéis e privilégios mínimos. **Produção intocada.** Em `mf_rls_staging` (5437 local), roles criadas com `NOSUPERUSER`, `NOBYPASSRLS`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, `NOLOGIN` (usadas via `SET ROLE` no harness; app real usaria LOGIN dedicado com mesmas flags).

| Role | Objetivo | SUPERUSER | BYPASSRLS | Privilégios | RLS |
|---|---:|---:|---:|---|---|
| `mf_app_nobypass` | Runtime da aplicação (tenant) | não | **não** | CONNECT/USAGE + DML tabelas públicas | Sujeita a RLS; requer `app.tenant_id`/`app.user_id`; `app.is_admin='false'` |
| `mf_migration` | Migrações/DDL controladas em staging | não | não | CONNECT/USAGE/CREATE schema + ALL tables/sequences | Usar com cuidado; migrações DDL não são queries de dados tenant — preferir role dedicada e janela controlada |
| `mf_admin_executor` | Operações admin/cross-tenant explícitas (cron, gestão global) | não | **não** | CONNECT/USAGE + DML | Só acede a linhas admin quando políticas permitem `app.is_admin='true'`; ações auditáveis |
| `mf_auth_executor` | Protótipo NextAuth/adapter isolado | não | **não** | CONNECT/USAGE + DML em `User,Account,Session,VerificationToken,EmailActionToken,EmailRequestLimit` | Tabelas auth **não** cobertas por políticas tenant genéricas neste estágio; isolamento por grants mínimos + políticas auth futuras |

## Verificação efetiva (`pg_roles`)
```
mf_admin_executor: rolsuper=false, rolbypassrls=false, rolcanlogin=false
mf_app_nobypass:   rolsuper=false, rolbypassrls=false, rolcanlogin=false
mf_auth_executor:  rolsuper=false, rolbypassrls=false, rolcanlogin=false
mf_migration:      rolsuper=false, rolbypassrls=false, rolcanlogin=false
```

## Compatibilidade produção (planeamento, NÃO aplicado)
- Criar role de app dedicada com `NOBYPASSRLS` e grants mínimos; conectar app via essa role (ou pooler com user sem bypass), após testes completos.
- Manter owner/migration separado; nunca usar owner como runtime.
- `app.is_admin` deve ser derivado de autorização servidor/DB confiável — nunca do cliente.
- NextAuth: considerar schema/políticas auth isoladas ou executor dedicado antes de `FORCE RLS` em tabelas adapter.
