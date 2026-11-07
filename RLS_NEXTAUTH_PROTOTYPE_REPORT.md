# RLS_NEXTAUTH_PROTOTYPE_REPORT.md
## Estado
**Nenhuma alteração aplicada ao NextAuth/Prisma Adapter em produção/código runtime.** Protótipo é desenho + evidência de limites.

## Tabelas sensíveis
`User`, `Account`, `Session`, `VerificationToken`, `EmailActionToken`, `EmailRequestLimit`.

## Achados em mf_rls_staging (5437 local)
- RLS ativado em `User` com política `rls_user_self_tenant_admin` (self/tenant/admin). Funciona para acesso empresarial quando `app.user_id`/`app.tenant_id` definidos.
- RLS **desativado** neste protótipo para `Account,Session,VerificationToken,EmailActionToken` (mantidos sem RLS para não quebrar fluxos adapter sem desenho validado). `Admin/global` tables e business tables com RLS.

## Riscos para NextAuth+PrismaAdapter sob RLS
- Adapter executa operações sem GUC tenant; `User.tenantId` pode ser NULL (onboarding/OAuth).
- `Session`/`Account`/`VerificationToken` são domínio auth, não tenant empresarial — políticas tenant incorretas bloqueiam login/linking.
- `session` callback/refresh consultam `User` por `sub`; requer política self (`app.user_id=id`) e executor confiável.

## Protótipo recomendado (staging dedicado)
1. **Executor auth isolado** (`mf_auth_executor` já criado; grants mínimos): usar para adapter/auth routes, ou DB role dedicada com políticas auth-only.
2. **Políticas auth (proposta, não aplicada):**
   - `Account`: `userId = app.user_id` quando user conhecido; inserts controlados por adapter; service path para linking seguro.
   - `Session`: `userId = app.user_id` OR token match em fluxo controlado.
   - `VerificationToken`: acesso restrito por token/identifier em transações controladas (sem exposição ampla).
   - `EmailActionToken`: `userId = app.user_id` ou admin.
3. **Não usar `runWithTenant` no adapter.** Para callbacks com user conhecido, setar `app.user_id` (e não `app.is_admin`).
4. **Testes obrigatórios (bloqueados nesta sessão — sem harness auth automatizado contra DB RLS):** credentials login, Google OAuth, linking (`allowDangerousEmailAccountLinking`), forgot/reset/verify, register, onboarding (NULL->tenant), refresh, `sessionVersion` revogação, desktop offline grant.

## Conclusão
Compatibilidade NextAuth com RLS **não demonstrada**. Risco alto de regressão se ativado sem protótipo isolado + testes.
