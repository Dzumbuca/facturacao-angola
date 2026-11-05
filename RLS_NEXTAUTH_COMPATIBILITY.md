# Compatibilidade RLS — NextAuth / Prisma Adapter (ETAPA 2, análise; sem alterações)

**Estado:** NÃO ALTERADO. Alterar autenticação sem prova pode bloquear login, sessões, onboarding e callbacks OAuth.

## Inventário
- **Config:** `src/lib/auth.ts` — NextAuth com `PrismaAdapter(prisma)`, `session.strategy='jwt'`, providers Credentials + Google (`allowDangerousEmailAccountLinking: true`), callbacks `authorized/jwt/session`.
- **Tabelas Prisma (padrão adapter):** `User`, `Account`, `Session`, `VerificationToken` (e relações). `User.tenantId` pode ser `NULL` (onboarding pós-registo/OAuth).
- **Fluxos dependentes:** `/api/auth/*` (register, forgot/reset/verify password, change-unverified-email), onboarding company, `session/refresh`, middleware/authorized, desktop/offline grant depende de `sessionVersion`.

## Riscos sob RLS com role sem BYPASSRLS
| Fluxo | Risco | Motivo |
|---|---|---|
| Prisma Adapter CRUD | Alto | Adapter opera em `User/Account/Session/VerificationToken` sem `app.tenant_id`; GUC ausente. |
| Credentials authorize | Alto | Lookup por email antes de tenant/session plenamente estabelecido. |
| OAuth Google/linking | Alto | Criação/ligação de `Account`/`User` cross-contexto. |
| `session` callback DB lookup | Médio/Alto | Lê `User` por `token.sub`; precisa política por identidade própria, não por tenant empresarial genérico. |
| Password reset/verify tokens | Alto | Tokens são globais/por user; filtros por tenant incorretos. |
| Onboarding (tenant NULL→set) | Alto | Transição de estado identidade/empresa. |

## Solução técnica recomendada (a validar em staging preparado)
1. **Isolar executor de auth:** manter Prisma adapter/auth flows num cliente/role com privilégios controlados **não** sujeitos às políticas tenant empresariais genéricas, ou usar políticas explícitas por tabela:
   - `User`: permitir leitura/escrita mínima necessária ao adapter/auth por `id = current_setting('app.user_id')` quando aplicável, e caminhos de bootstrap controlados (service role/auth executor).
   - `Account/Session/VerificationToken`: políticas específicas do domínio auth (não tenant-scoped); `Session` por `userId/sessionToken`, `VerificationToken` por token/identifier com acesso restrito.
2. **Não usar `runWithTenant` no adapter:** adapter não conhece tenant em muitos callbacks; forçar tenant falso quebraria.
3. **`session` callback:** preferir claims JWT mínimas; se DB lookup necessário, executar no executor auth controlado (não tenant empresarial). Evitar depender de `app.tenant_id`.
4. **Onboarding:** operação transacional controlada que cria/associa tenant e atualiza `User.tenantId`; requer permissão explícita para estado pré-tenant.
5. **`app.is_admin`/service paths:** apenas para rotinas admin auditadas; nunca derivar de input cliente.
6. **Testes obrigatórios antes de aplicar RLS real:** login credentials, login Google, linking, logout, refresh, reset/verify email, register, onboarding, acesso tenant após atribuição, revogação `sessionVersion`, e regressão desktop/offline grant.

## Decisão
**Nenhuma alteração aplicada** ao mecanismo de autenticação neste passo. Próxima ação segura: protótipo em staging com role dedicada/políticas auth isoladas + matriz de testes acima.
